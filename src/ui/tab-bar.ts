import type { AppState } from "../state";

export class TabBar {
  root: HTMLElement;

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "tab-bar";

    this.state.on("tabs-changed", () => this.render());
    this.state.on("active-tab-changed", () => this.render());
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  private render() {
    this.root.innerHTML = "";

    for (const tab of this.state.openTabs) {
      const tabEl = document.createElement("div");
      tabEl.className = "tab";

      if (tab.path === this.state.activeFilePath) {
        tabEl.classList.add("tab-active");
      }
      if (tab.dirty) {
        tabEl.classList.add("tab-dirty");
      }

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tab.name;
      tabEl.appendChild(label);

      const closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "\u00d7";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.state.closeTab(tab.path);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener("click", () => {
        this.state.switchToTab(tab.path);
      });

      this.root.appendChild(tabEl);
    }
  }
}
