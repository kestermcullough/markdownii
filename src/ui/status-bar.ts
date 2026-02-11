import type { AppState } from "../state";

export class StatusBar {
  root: HTMLElement;
  private lineCol: HTMLSpanElement;
  private wordCount: HTMLSpanElement;

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "status-bar";

    this.lineCol = document.createElement("span");
    this.lineCol.textContent = "Ln 1, Col 1";

    this.wordCount = document.createElement("span");
    this.wordCount.style.marginLeft = "auto";
    this.wordCount.textContent = "";

    this.root.appendChild(this.lineCol);
    this.root.appendChild(this.wordCount);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  update(line: number, col: number, words?: number) {
    this.lineCol.textContent = `Ln ${line}, Col ${col}`;
    if (words !== undefined) {
      this.wordCount.textContent = `${words} words`;
    }
  }
}
