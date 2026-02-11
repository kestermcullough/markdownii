import { EditorView } from "@codemirror/view";
import type { FileEntry } from "./tauri-api";
import {
  openVaultDialog,
  getVaultTree,
  readFile,
  writeFile,
  createFile as createFileOnDisk,
} from "./tauri-api";

type EventCallback = (...args: any[]) => void;

function normalizeNewFileName(rawName: string): string | null {
  const name = rawName.trim();
  if (!name) return null;
  if (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    name.includes("\0")
  ) {
    return null;
  }
  return name.endsWith(".md") ? name : `${name}.md`;
}

export interface TabState {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  editorView: EditorView | null;
  scrollTop: number;
}

export class AppState {
  vaultPath: string | null = null;
  vaultTree: FileEntry[] = [];
  openTabs: TabState[] = [];
  activeFilePath: string | null = null;
  sidebarVisible = true;

  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, fn: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: EventCallback) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  async openVault() {
    const path = await openVaultDialog();
    if (!path) return;
    this.vaultPath = path;
    this.vaultTree = await getVaultTree();
    this.emit("vault-loaded");
  }

  async refreshVaultTree() {
    if (!this.vaultPath) return;
    this.vaultTree = await getVaultTree();
    this.emit("vault-loaded");
  }

  async openFile(path: string) {
    // If already open, just switch to it
    const existing = this.openTabs.find((t) => t.path === path);
    if (existing) {
      this.switchToTab(path);
      return;
    }

    const content = await readFile(path);
    const name = path.split("/").pop() || path.split("\\").pop() || path;

    this.openTabs.push({
      path,
      name,
      content,
      dirty: false,
      editorView: null,
      scrollTop: 0,
    });

    this.emit("tabs-changed");
    this.switchToTab(path);
  }

  switchToTab(path: string) {
    // Save current editor scroll position
    const current = this.getActiveTab();
    if (current?.editorView) {
      current.scrollTop = current.editorView.scrollDOM.scrollTop;
    }

    this.activeFilePath = path;
    this.emit("active-tab-changed");
  }

  closeTab(path: string) {
    const idx = this.openTabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const tab = this.openTabs[idx];
    if (tab.editorView) {
      tab.editorView.destroy();
      tab.editorView = null;
    }

    this.openTabs.splice(idx, 1);

    if (this.activeFilePath === path) {
      const newIdx = Math.min(idx, this.openTabs.length - 1);
      this.activeFilePath =
        newIdx >= 0 ? this.openTabs[newIdx].path : null;
    }

    this.emit("tabs-changed");
    this.emit("active-tab-changed");
  }

  async saveActiveFile() {
    const tab = this.getActiveTab();
    if (!tab || !tab.editorView) return;

    const content = tab.editorView.state.doc.toString();
    await writeFile(tab.path, content);
    tab.content = content;
    tab.dirty = false;
    this.emit("tabs-changed");
  }

  markDirty(path: string) {
    const tab = this.openTabs.find((t) => t.path === path);
    if (tab && !tab.dirty) {
      tab.dirty = true;
      this.emit("tabs-changed");
    }
  }

  getActiveTab(): TabState | undefined {
    return this.openTabs.find((t) => t.path === this.activeFilePath);
  }

  nextTab() {
    if (this.openTabs.length <= 1) return;
    const idx = this.openTabs.findIndex(
      (t) => t.path === this.activeFilePath
    );
    const next = (idx + 1) % this.openTabs.length;
    this.switchToTab(this.openTabs[next].path);
  }

  prevTab() {
    if (this.openTabs.length <= 1) return;
    const idx = this.openTabs.findIndex(
      (t) => t.path === this.activeFilePath
    );
    const prev =
      (idx - 1 + this.openTabs.length) % this.openTabs.length;
    this.switchToTab(this.openTabs[prev].path);
  }

  async createNewFile() {
    if (!this.vaultPath) return;
    const name = prompt("File name:", "Untitled.md");
    if (name === null) return;

    const fileName = normalizeNewFileName(name);
    if (!fileName) {
      alert("Use a simple file name without slashes or '..'.");
      return;
    }

    const path = this.vaultPath + "/" + fileName;

    try {
      await createFileOnDisk(path);
      await this.refreshVaultTree();
      await this.openFile(path);
    } catch (err) {
      alert(
        `Could not create file: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    this.emit("sidebar-toggled");
  }
}

/** Flatten a FileEntry tree into a flat list (files only) */
export function flattenTree(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.is_dir && entry.children) {
      result.push(...flattenTree(entry.children));
    } else if (!entry.is_dir) {
      result.push(entry);
    }
  }
  return result;
}
