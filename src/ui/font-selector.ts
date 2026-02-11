import type { AppState } from "../state";

interface FontOption {
  label: string;
  value: string;
}

const TEXT_FONT_OPTIONS: FontOption[] = [
  {
    label: "System UI",
    value:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
  {
    label: "Serif",
    value: 'Charter, "Iowan Old Style", "Times New Roman", serif',
  },
  {
    label: "Humanist Sans",
    value: '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif',
  },
  {
    label: "Source Sans",
    value: '"Source Sans 3", "Segoe UI", Roboto, sans-serif',
  },
];

const MONO_FONT_OPTIONS: FontOption[] = [
  {
    label: "SF Mono / Fira",
    value:
      '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Courier, monospace',
  },
  {
    label: "JetBrains Mono",
    value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  },
  {
    label: "IBM Plex Mono",
    value: '"IBM Plex Mono", "Fira Mono", Menlo, monospace',
  },
  {
    label: "Courier",
    value: '"Courier Prime", "Courier New", Courier, monospace',
  },
];

function createOptions(select: HTMLSelectElement, options: FontOption[]) {
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    select.appendChild(el);
  }
}

function ensureValueOption(select: HTMLSelectElement, value: string) {
  const exists = Array.from(select.options).some((o) => o.value === value);
  if (!exists) {
    const custom = document.createElement("option");
    custom.value = value;
    custom.textContent = `Custom (${value.slice(0, 24)}${value.length > 24 ? "..." : ""})`;
    select.appendChild(custom);
  }
  select.value = value;
}

function normalizedFontInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export class FontSelector {
  root: HTMLElement;
  private panel: HTMLElement;
  private textSelect: HTMLSelectElement;
  private monoSelect: HTMLSelectElement;
  private textCustomInput: HTMLInputElement;
  private monoCustomInput: HTMLInputElement;
  private sizeInput: HTMLInputElement;
  private lineHeightInput: HTMLInputElement;
  private sizeValue: HTMLElement;
  private lineHeightValue: HTMLElement;
  private visible = false;

  constructor(private state: AppState) {
    this.root = document.createElement("div");
    this.root.className = "font-selector-overlay";
    this.root.style.display = "none";

    this.panel = document.createElement("div");
    this.panel.className = "font-selector-panel";

    const title = document.createElement("h3");
    title.className = "font-selector-title";
    title.textContent = "Font Settings";

    const subtitle = document.createElement("p");
    subtitle.className = "font-selector-subtitle";
    subtitle.textContent =
      "Preview applies instantly and is saved automatically. You can type any system font stack.";

    this.textSelect = document.createElement("select");
    this.textSelect.className = "font-selector-select";
    createOptions(this.textSelect, TEXT_FONT_OPTIONS);

    this.monoSelect = document.createElement("select");
    this.monoSelect.className = "font-selector-select";
    createOptions(this.monoSelect, MONO_FONT_OPTIONS);

    this.textCustomInput = document.createElement("input");
    this.textCustomInput.type = "text";
    this.textCustomInput.className = "font-selector-input";
    this.textCustomInput.placeholder =
      'Custom text font stack (e.g. "Segoe UI", Arial, sans-serif)';

    this.monoCustomInput = document.createElement("input");
    this.monoCustomInput.type = "text";
    this.monoCustomInput.className = "font-selector-input";
    this.monoCustomInput.placeholder =
      'Custom code font stack (e.g. "Cascadia Code", Consolas, monospace)';

    this.sizeInput = document.createElement("input");
    this.sizeInput.type = "range";
    this.sizeInput.min = "12";
    this.sizeInput.max = "26";
    this.sizeInput.step = "1";
    this.sizeInput.className = "font-selector-range";

    this.lineHeightInput = document.createElement("input");
    this.lineHeightInput.type = "range";
    this.lineHeightInput.min = "1.2";
    this.lineHeightInput.max = "2.2";
    this.lineHeightInput.step = "0.05";
    this.lineHeightInput.className = "font-selector-range";

    this.sizeValue = document.createElement("span");
    this.sizeValue.className = "font-selector-value";
    this.lineHeightValue = document.createElement("span");
    this.lineHeightValue.className = "font-selector-value";

    this.panel.appendChild(title);
    this.panel.appendChild(subtitle);
    this.panel.appendChild(
      this.makeFontRow("Text Font", this.textSelect, this.textCustomInput)
    );
    this.panel.appendChild(
      this.makeFontRow("Code Font", this.monoSelect, this.monoCustomInput)
    );
    this.panel.appendChild(
      this.makeRangeRow("Font Size", this.sizeInput, this.sizeValue)
    );
    this.panel.appendChild(
      this.makeRangeRow("Line Height", this.lineHeightInput, this.lineHeightValue)
    );

    const actions = document.createElement("div");
    actions.className = "font-selector-actions";

    const resetBtn = document.createElement("button");
    resetBtn.className = "font-selector-btn";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => this.state.resetSettings());

    const closeBtn = document.createElement("button");
    closeBtn.className = "font-selector-btn font-selector-btn-primary";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => this.hide());

    actions.appendChild(resetBtn);
    actions.appendChild(closeBtn);
    this.panel.appendChild(actions);

    this.root.appendChild(this.panel);

    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide();
    });

    this.textSelect.addEventListener("change", () => {
      this.textCustomInput.value = this.textSelect.value;
      this.applyCurrent();
    });
    this.monoSelect.addEventListener("change", () => {
      this.monoCustomInput.value = this.monoSelect.value;
      this.applyCurrent();
    });

    this.textCustomInput.addEventListener("input", () => this.applyCurrent());
    this.monoCustomInput.addEventListener("input", () => this.applyCurrent());

    this.sizeInput.addEventListener("input", () => this.applyCurrent());
    this.lineHeightInput.addEventListener("input", () => this.applyCurrent());

    this.state.on("settings-changed", () => this.syncFromState());
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  show() {
    this.syncFromState();
    this.visible = true;
    this.root.style.display = "flex";
    this.textSelect.focus();
  }

  hide() {
    this.visible = false;
    this.root.style.display = "none";
  }

  isVisible() {
    return this.visible;
  }

  private makeFontRow(
    label: string,
    select: HTMLSelectElement,
    customInput: HTMLInputElement
  ) {
    const row = document.createElement("label");
    row.className = "font-selector-row";

    const name = document.createElement("span");
    name.className = "font-selector-label";
    name.textContent = label;

    row.appendChild(name);
    row.appendChild(select);
    row.appendChild(customInput);
    return row;
  }

  private makeRangeRow(
    label: string,
    input: HTMLInputElement,
    valueEl: HTMLElement
  ) {
    const row = document.createElement("label");
    row.className = "font-selector-row";

    const header = document.createElement("div");
    header.className = "font-selector-range-header";

    const name = document.createElement("span");
    name.className = "font-selector-label";
    name.textContent = label;

    header.appendChild(name);
    header.appendChild(valueEl);

    row.appendChild(header);
    row.appendChild(input);
    return row;
  }

  private syncFromState() {
    const settings = this.state.settings;
    ensureValueOption(this.textSelect, settings.fontText);
    ensureValueOption(this.monoSelect, settings.fontMono);
    this.textCustomInput.value = settings.fontText;
    this.monoCustomInput.value = settings.fontMono;
    this.sizeInput.value = String(settings.fontSize);
    this.lineHeightInput.value = String(settings.lineHeight);
    this.sizeValue.textContent = `${settings.fontSize}px`;
    this.lineHeightValue.textContent = settings.lineHeight.toFixed(2);
  }

  private applyCurrent() {
    const fontSize = Number.parseFloat(this.sizeInput.value);
    const lineHeight = Number.parseFloat(this.lineHeightInput.value);
    this.state.updateSettings({
      fontText: normalizedFontInput(this.textCustomInput.value, this.textSelect.value),
      fontMono: normalizedFontInput(this.monoCustomInput.value, this.monoSelect.value),
      fontSize: Number.isFinite(fontSize) ? fontSize : undefined,
      lineHeight: Number.isFinite(lineHeight) ? lineHeight : undefined,
    });
  }
}
