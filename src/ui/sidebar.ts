import { getFileName } from "../path-utils";
import type { AppState } from "../state";
import type { FileEntry } from "../tauri-api";

export class Sidebar {
  root: HTMLElement;
  private header: HTMLElement;
  private treeRoot: HTMLElement;
  private emptyState: HTMLElement;

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
    this.emptyState.innerHTML = `
      <span>No vault open</span>
      <button class="empty-state-action">Open Folder</button>
    `;
    this.emptyState
      .querySelector("button")!
      .addEventListener("click", () => this.state.openVault());
    this.root.appendChild(this.emptyState);

    this.state.on("vault-loaded", () => this.renderTree());
    this.state.on("active-tab-changed", () => this.updateActive());

    this.updateVisibility();
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  private renderTree() {
    if (!this.state.vaultTree.length) {
      this.treeRoot.style.display = "none";
      this.emptyState.style.display = "flex";
      return;
    }

    this.treeRoot.style.display = "block";
    this.emptyState.style.display = "none";

    // Update header with vault name
    const vaultName = this.state.vaultPath
      ? getFileName(this.state.vaultPath)
      : "Vault";
    this.header.innerHTML = `<span>${vaultName}</span>`;

    this.treeRoot.innerHTML = "";
    this.renderEntries(this.state.vaultTree, this.treeRoot, 0);
  }

  private renderEntries(
    entries: FileEntry[],
    parent: HTMLElement,
    depth: number
  ) {
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "tree-item";
      row.style.paddingLeft = `${depth * 16 + 8}px`;

      if (entry.is_dir) {
        const chevron = document.createElement("span");
        chevron.className = "tree-chevron open";
        chevron.textContent = "\u25B6"; // right triangle
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
        const icon = document.createElement("span");
        icon.className = "tree-file-icon";
        icon.textContent = "\u{1F4C4}"; // page icon
        // Use a simple text marker instead of emoji for consistency
        icon.textContent = "";

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
    // Initial state
    if (!this.state.vaultTree.length) {
      this.treeRoot.style.display = "none";
      this.emptyState.style.display = "flex";
    }
  }
}
