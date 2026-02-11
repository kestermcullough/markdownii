import type { AppState } from "../state";
import { flattenTree } from "../state";
import type { FileEntry } from "../tauri-api";

export class CommandPalette {
  root: HTMLElement;
  private input: HTMLInputElement;
  private resultsList: HTMLElement;
  private visible = false;
  private selectedIndex = 0;
  private currentResults: FileEntry[] = [];
  private allFiles: FileEntry[] = [];
  private searchIndex: { file: FileEntry; nameLower: string; pathLower: string }[] =
    [];

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "command-palette-overlay";
    this.root.style.display = "none";

    const container = document.createElement("div");
    container.className = "command-palette";

    this.input = document.createElement("input");
    this.input.className = "command-palette-input";
    this.input.placeholder = "Open file...";
    this.input.addEventListener("input", () => this.onInput());
    this.input.addEventListener("keydown", (e) => this.onKeydown(e));

    this.resultsList = document.createElement("div");
    this.resultsList.className = "command-palette-results";

    container.appendChild(this.input);
    container.appendChild(this.resultsList);
    this.root.appendChild(container);

    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide();
    });

    this.state.on("vault-loaded", () => {
      this.rebuildFileCache();
      if (this.visible) {
        this.currentResults = this.getAllFiles();
        this.selectedIndex = 0;
        this.renderResults();
      }
    });
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  show() {
    this.rebuildFileCache();
    this.visible = true;
    this.root.style.display = "flex";
    this.input.value = "";
    this.selectedIndex = 0;
    this.currentResults = this.getAllFiles();
    this.renderResults();
    this.input.focus();
  }

  hide() {
    this.visible = false;
    this.root.style.display = "none";
  }

  isVisible() {
    return this.visible;
  }

  private onInput() {
    const query = this.input.value.toLowerCase();
    if (!query) {
      this.currentResults = this.getAllFiles();
    } else {
      this.currentResults = this.searchIndex
        .filter(
          ({ nameLower, pathLower }) =>
            nameLower.includes(query) || pathLower.includes(query)
        )
        .map(({ file }) => file);
    }
    this.selectedIndex = 0;
    this.renderResults();
  }

  private onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        this.currentResults.length - 1
      );
      this.highlightSelected();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.highlightSelected();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = this.currentResults[this.selectedIndex];
      if (selected) {
        this.state.openFile(selected.path);
        this.hide();
      }
    } else if (e.key === "Escape") {
      this.hide();
    }
  }

  private getAllFiles(): FileEntry[] {
    return this.allFiles;
  }

  private rebuildFileCache() {
    this.allFiles = flattenTree(this.state.vaultTree);
    this.searchIndex = this.allFiles.map((file) => ({
      file,
      nameLower: file.name.toLowerCase(),
      pathLower: file.path.toLowerCase(),
    }));
  }

  private renderResults() {
    this.resultsList.innerHTML = "";
    const display = this.currentResults.slice(0, 20);

    for (let i = 0; i < display.length; i++) {
      const file = display[i];
      const item = document.createElement("div");
      item.className = "command-palette-item";
      if (i === this.selectedIndex) item.classList.add("selected");

      const name = document.createElement("span");
      name.textContent = file.name;
      item.appendChild(name);

      // Show relative path
      if (this.state.vaultPath) {
        const relPath = file.path.replace(this.state.vaultPath, "");
        const pathEl = document.createElement("span");
        pathEl.className = "command-palette-item-path";
        pathEl.textContent = relPath;
        item.appendChild(pathEl);
      }

      item.addEventListener("click", () => {
        this.state.openFile(file.path);
        this.hide();
      });

      item.addEventListener("mouseenter", () => {
        this.selectedIndex = i;
        this.highlightSelected();
      });

      this.resultsList.appendChild(item);
    }
  }

  private highlightSelected() {
    const items = this.resultsList.querySelectorAll(".command-palette-item");
    items.forEach((el, i) => {
      el.classList.toggle("selected", i === this.selectedIndex);
    });
    // Scroll selected into view
    items[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
  }
}
