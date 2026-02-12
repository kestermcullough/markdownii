import type { AppState } from "../state";

export class StatusBar {
  root: HTMLElement;
  private lineCol: HTMLSpanElement;
  private perfSummary: HTMLSpanElement;
  private wordCount: HTMLSpanElement;

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "status-bar";

    this.lineCol = document.createElement("span");
    this.lineCol.textContent = "Ln 1, Col 1";

    this.perfSummary = document.createElement("span");
    this.perfSummary.className = "status-perf";

    this.wordCount = document.createElement("span");
    this.wordCount.className = "status-words";
    this.wordCount.textContent = "";

    this.root.appendChild(this.lineCol);
    this.root.appendChild(this.perfSummary);
    this.root.appendChild(this.wordCount);

    this.state.on("perf-updated", () => this.renderPerfSummary());
    this.renderPerfSummary();
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

  private renderPerfSummary() {
    const summary = this.state.getPerfSummary();
    const parts: string[] = [];
    if (summary.appOpenMs !== null) {
      parts.push(`Open ${formatMs(summary.appOpenMs)}`);
    }
    if (summary.vaultOpenMs !== null) {
      parts.push(`Folder ${formatMs(summary.vaultOpenMs)}`);
    }
    if (summary.vaultTreeScanMs !== null) {
      parts.push(`Scan ${formatMs(summary.vaultTreeScanMs)}`);
    }
    if (summary.crashCount > 0) {
      parts.push(`Errors ${summary.crashCount}`);
    }
    this.perfSummary.textContent = parts.join("  |  ");
  }
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}
