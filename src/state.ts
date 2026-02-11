import { EditorView } from "@codemirror/view";
import { getFileName } from "./path-utils";
import type { FileEntry } from "./tauri-api";
import {
  openVaultDialog,
  getVaultTree,
  readFile,
  writeFile,
  createFile as createFileOnDisk,
} from "./tauri-api";

type EventCallback = (...args: any[]) => void;

const SETTINGS_STORAGE_KEY = "markdownii.settings.v1";
const HISTORY_DEBOUNCE_MS = 900;
const MAX_HISTORY_PATCHES = 10000;

export interface EditorSettings {
  fontText: string;
  fontMono: string;
  fontSize: number;
  lineHeight: number;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontText:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontMono:
    '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Courier, monospace',
  fontSize: 16,
  lineHeight: 1.6,
};

interface DiffPatch {
  start: number;
  deleteCount: number;
  insert: string;
  deleted: string;
}

interface TabHistory {
  done: DiffPatch[];
  undone: DiffPatch[];
  pendingBaseline: string | null;
  pendingLatest: string | null;
  timerId: number | null;
  applying: boolean;
}

function createTabHistory(): TabHistory {
  return {
    done: [],
    undone: [],
    pendingBaseline: null,
    pendingLatest: null,
    timerId: null,
    applying: false,
  };
}

function computePatch(before: string, after: string): DiffPatch | null {
  if (before === after) return null;

  let start = 0;
  const maxPrefix = Math.min(before.length, after.length);
  while (start < maxPrefix && before[start] === after[start]) {
    start++;
  }

  let beforeEnd = before.length - 1;
  let afterEnd = after.length - 1;
  while (
    beforeEnd >= start &&
    afterEnd >= start &&
    before[beforeEnd] === after[afterEnd]
  ) {
    beforeEnd--;
    afterEnd--;
  }

  const deleted = before.slice(start, beforeEnd + 1);
  const insert = after.slice(start, afterEnd + 1);
  return {
    start,
    deleteCount: deleted.length,
    insert,
    deleted,
  };
}

function applyPatch(text: string, patch: DiffPatch): string | null {
  const end = patch.start + patch.deleteCount;
  if (patch.start < 0 || end > text.length || patch.start > end) {
    return null;
  }
  return text.slice(0, patch.start) + patch.insert + text.slice(end);
}

function invertPatch(patch: DiffPatch): DiffPatch {
  return {
    start: patch.start,
    deleteCount: patch.insert.length,
    insert: patch.deleted,
    deleted: patch.insert,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeSettingText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeSettings(input: unknown): EditorSettings {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }

  const raw = input as Partial<EditorSettings>;
  return {
    fontText: normalizeSettingText(raw.fontText, DEFAULT_EDITOR_SETTINGS.fontText),
    fontMono: normalizeSettingText(raw.fontMono, DEFAULT_EDITOR_SETTINGS.fontMono),
    fontSize: clampNumber(raw.fontSize, 12, 26, DEFAULT_EDITOR_SETTINGS.fontSize),
    lineHeight: clampNumber(
      raw.lineHeight,
      1.2,
      2.2,
      DEFAULT_EDITOR_SETTINGS.lineHeight
    ),
  };
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

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
  lastSavedContent: string;
  wordCount: number;
  dirty: boolean;
  editorView: EditorView | null;
  scrollTop: number;
  history: TabHistory;
}

export class AppState {
  vaultPath: string | null = null;
  vaultTree: FileEntry[] = [];
  openTabs: TabState[] = [];
  activeFilePath: string | null = null;
  sidebarVisible = true;
  settings: EditorSettings;

  private listeners = new Map<string, Set<EventCallback>>();

  constructor() {
    this.settings = this.loadSettings();
    this.applySettingsToDocument();
  }

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

  private loadSettings(): EditorSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_EDITOR_SETTINGS };
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_EDITOR_SETTINGS };
    }
  }

  private persistSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Best-effort persistence.
    }
  }

  private applySettingsToDocument() {
    const root = document.documentElement;
    root.style.setProperty("--font-text", this.settings.fontText);
    root.style.setProperty("--font-mono", this.settings.fontMono);
    root.style.setProperty("--font-size", `${this.settings.fontSize}px`);
    root.style.setProperty("--line-height", `${this.settings.lineHeight}`);
  }

  updateSettings(next: Partial<EditorSettings>) {
    this.settings = normalizeSettings({ ...this.settings, ...next });
    this.persistSettings();
    this.applySettingsToDocument();
    this.emit("settings-changed", this.settings);
  }

  resetSettings() {
    this.settings = { ...DEFAULT_EDITOR_SETTINGS };
    this.persistSettings();
    this.applySettingsToDocument();
    this.emit("settings-changed", this.settings);
  }

  private getTabByPath(path: string): TabState | undefined {
    return this.openTabs.find((t) => t.path === path);
  }

  private clearTabHistoryTimer(tab: TabState) {
    if (tab.history.timerId !== null) {
      window.clearTimeout(tab.history.timerId);
      tab.history.timerId = null;
    }
  }

  private enqueuePatch(tab: TabState, patch: DiffPatch) {
    tab.history.done.push(patch);
    tab.history.undone = [];
    if (tab.history.done.length > MAX_HISTORY_PATCHES) {
      tab.history.done.splice(0, tab.history.done.length - MAX_HISTORY_PATCHES);
    }
  }

  isApplyingHistory(path: string): boolean {
    return this.getTabByPath(path)?.history.applying ?? false;
  }

  recordDocChange(path: string, before: string, after: string) {
    const tab = this.getTabByPath(path);
    if (!tab || tab.history.applying || before === after) return;

    if (tab.history.pendingBaseline === null) {
      tab.history.pendingBaseline = before;
    }
    tab.history.pendingLatest = after;

    this.clearTabHistoryTimer(tab);
    tab.history.timerId = window.setTimeout(() => {
      this.flushTabHistory(path);
    }, HISTORY_DEBOUNCE_MS);
  }

  flushTabHistory(path: string) {
    const tab = this.getTabByPath(path);
    if (!tab) return;

    this.clearTabHistoryTimer(tab);

    const baseline = tab.history.pendingBaseline;
    const latest = tab.history.pendingLatest;
    tab.history.pendingBaseline = null;
    tab.history.pendingLatest = null;

    if (baseline === null || latest === null) return;

    const patch = computePatch(baseline, latest);
    if (!patch) return;

    this.enqueuePatch(tab, patch);
  }

  undoActiveFile() {
    const tab = this.getActiveTab();
    if (!tab?.editorView) return;

    this.flushTabHistory(tab.path);

    const patch = tab.history.done.pop();
    if (!patch) return;

    const inverse = invertPatch(patch);
    const from = inverse.start;
    const to = inverse.start + inverse.deleteCount;
    const currentText = tab.editorView.state.doc.toString();

    if (from < 0 || to > currentText.length || from > to) {
      tab.history.done.push(patch);
      return;
    }

    if (currentText.slice(from, to) !== inverse.deleted) {
      tab.history.done.push(patch);
      return;
    }

    tab.history.applying = true;
    try {
      tab.editorView.dispatch({
        changes: { from, to, insert: inverse.insert },
      });
    } finally {
      tab.history.applying = false;
    }

    const nextText = tab.editorView.state.doc.toString();
    tab.history.undone.push(patch);
    tab.content = nextText;
    tab.wordCount = countWords(nextText);
    tab.dirty = nextText !== tab.lastSavedContent;
    this.emit("tabs-changed");
  }

  redoActiveFile() {
    const tab = this.getActiveTab();
    if (!tab?.editorView) return;

    this.flushTabHistory(tab.path);

    const patch = tab.history.undone.pop();
    if (!patch) return;

    const from = patch.start;
    const to = patch.start + patch.deleteCount;
    const currentText = tab.editorView.state.doc.toString();

    if (from < 0 || to > currentText.length || from > to) {
      tab.history.undone.push(patch);
      return;
    }

    if (currentText.slice(from, to) !== patch.deleted) {
      tab.history.undone.push(patch);
      return;
    }

    tab.history.applying = true;
    try {
      tab.editorView.dispatch({
        changes: { from, to, insert: patch.insert },
      });
    } finally {
      tab.history.applying = false;
    }

    const nextText = tab.editorView.state.doc.toString();
    tab.history.done.push(patch);
    tab.content = nextText;
    tab.wordCount = countWords(nextText);
    tab.dirty = nextText !== tab.lastSavedContent;
    this.emit("tabs-changed");
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
    const name = getFileName(path);

    this.openTabs.push({
      path,
      name,
      content,
      lastSavedContent: content,
      wordCount: countWords(content),
      dirty: false,
      editorView: null,
      scrollTop: 0,
      history: createTabHistory(),
    });

    this.emit("tabs-changed");
    this.switchToTab(path);
  }

  switchToTab(path: string) {
    // Save current editor scroll position
    const current = this.getActiveTab();
    if (current?.editorView) {
      this.flushTabHistory(current.path);
      current.scrollTop = current.editorView.scrollDOM.scrollTop;
    }

    this.activeFilePath = path;
    this.emit("active-tab-changed");
  }

  closeTab(path: string) {
    const idx = this.openTabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const tab = this.openTabs[idx];
    this.flushTabHistory(tab.path);
    this.clearTabHistoryTimer(tab);

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

    this.flushTabHistory(tab.path);

    const content = tab.editorView.state.doc.toString();
    await writeFile(tab.path, content);
    tab.content = content;
    tab.lastSavedContent = content;
    tab.wordCount = countWords(content);
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

  syncDirtyFromContent(path: string, content: string) {
    const tab = this.getTabByPath(path);
    if (!tab) return;
    const nextDirty = content !== tab.lastSavedContent;
    if (tab.dirty !== nextDirty) {
      tab.dirty = nextDirty;
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

    try {
      const createdPath = await createFileOnDisk(fileName);
      await this.refreshVaultTree();
      await this.openFile(createdPath);
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
