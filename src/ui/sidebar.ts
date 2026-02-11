import { getFileName, getRelativePath } from "../path-utils";
import type { AppState } from "../state";
import type { FileEntry } from "../tauri-api";

export class Sidebar {
  root: HTMLElement;
  private header: HTMLElement;
  private treeRoot: HTMLElement;
  private emptyState: HTMLElement;
  private emptyLabel: HTMLSpanElement;
  private openButton: HTMLButtonElement;

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "sidebar";

    this.header = document.createElement("div");
    this.header.className = "sidebar-header";
    this.header.innerHTML = `<span>Explorer</span>`;
    this.root.appendChild(this.header);

    this.treeRoot = document.createElement("div");
    this.treeRoot.className = "file-tree";
    this.root.appendChild(this.treeRoot);

    this.emptyState = document.createElement("div");
    this.emptyState.className = "empty-state";

    this.emptyLabel = document.createElement("span");
    this.emptyLabel.textContent = "No vault open";

    this.openButton = document.createElement("button");
    this.openButton.className = "empty-state-action";
    this.openButton.textContent = "Open Folder";
    this.openButton.addEventListener("click", () => this.state.openVault());

    this.emptyState.appendChild(this.emptyLabel);
    this.emptyState.appendChild(this.openButton);
    this.root.appendChild(this.emptyState);

    this.state.on("vault-loaded", () => this.renderTree());
    this.state.on("active-tab-changed", () => this.updateActive());

    this.updateVisibility();
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  private updateHeader() {
    const vaultPath = this.state.vaultPath;
    const vaultName = vaultPath ? getFileName(vaultPath) : "Explorer";
    this.header.innerHTML = `<span>${vaultName}</span>`;
    this.header.title = vaultPath ?? "";
  }

  private updateEmptyState() {
    if (!this.state.vaultPath) {
      this.emptyLabel.textContent = "No vault open";
      this.openButton.textContent = "Open Folder";
      this.openButton.style.display = "inline-flex";
      return;
    }

    const vaultName = getFileName(this.state.vaultPath);
    this.emptyLabel.textContent = `No markdown files in ${vaultName}`;
    this.openButton.textContent = "Open Different Folder";
    this.openButton.style.display = "inline-flex";
  }

  private renderTree() {
    this.updateHeader();

    if (!this.state.vaultTree.length) {
      this.treeRoot.style.display = "none";
      this.emptyState.style.display = "flex";
      this.updateEmptyState();
      return;
    }

    this.treeRoot.style.display = "block";
    this.emptyState.style.display = "none";

    this.treeRoot.innerHTML = "";
    this.renderEntries(this.state.vaultTree, this.treeRoot, 0);
  }

  private relativeTitle(path: string): string {
    if (!this.state.vaultPath) return path;
    const rel = getRelativePath(path, this.state.vaultPath);
    return rel || getFileName(path);
  }

  private renderEntries(entries: FileEntry[], parent: HTMLElement, depth: number) {
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "tree-item";
      row.style.paddingLeft = `${depth * 16 + 8}px`;
      row.title = this.relativeTitle(entry.path);

      if (entry.is_dir) {
        const chevron = document.createElement("span");
        chevron.className = "tree-chevron open";
        chevron.textContent = "\u25B6";
        row.appendChild(chevron);

        const label = document.createElement("span");
        label.textContent = " " + entry.name;
        row.appendChild(label);

        parent.appendChild(row);

        const children = document.createElement("div");
        children.className = "tree-children";

        row.addEventListener("click", () => {
          const collapsed = children.classList.toggle("collapsed");
          chevron.classList.toggle("open", !collapsed);
        });

        if (entry.children) {
          this.renderEntries(entry.children, children, depth + 1);
        }
        parent.appendChild(children);
      } else {
        const label = document.createElement("span");
        label.textContent = entry.name;
        row.appendChild(label);

        row.dataset.path = entry.path;

        if (entry.path === this.state.activeFilePath) {
          row.classList.add("active");
        }

        row.addEventListener("click", () => {
          this.state.openFile(entry.path);
        });

        parent.appendChild(row);
      }
    }
  }

  private updateActive() {
    this.treeRoot.querySelectorAll(".tree-item").forEach((el) => {
      const item = el as HTMLElement;
      item.classList.toggle(
        "active",
        item.dataset.path === this.state.activeFilePath
      );
    });
  }

  private updateVisibility() {
    if (!this.state.vaultTree.length) {
      this.treeRoot.style.display = "none";
      this.emptyState.style.display = "flex";
      this.updateEmptyState();
    }
  }
}
