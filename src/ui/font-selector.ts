import {
  DEFAULT_EDITOR_SETTINGS,
  type AppState,
  type EditorSettings,
} from "../state";

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
    label: "Consolas",
    value: 'Consolas, "Cascadia Code", monospace',
  },
];

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeSettingText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

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
  private draft: EditorSettings | null = null;

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
      "Pick a preset or type your own font stack. Changes apply only when you press Apply.";

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
    resetBtn.addEventListener("click", () => this.resetDraft());

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "font-selector-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.hide());

    const applyBtn = document.createElement("button");
    applyBtn.className = "font-selector-btn font-selector-btn-primary";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.applyAndClose());

    actions.appendChild(resetBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);
    this.panel.appendChild(actions);

    this.root.appendChild(this.panel);

    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.hide();
    });

    this.textSelect.addEventListener("change", () => {
      if (!this.draft) return;
      this.draft.fontText = this.textSelect.value;
      this.textCustomInput.value = this.textSelect.value;
      this.renderDraftValues();
    });

    this.monoSelect.addEventListener("change", () => {
      if (!this.draft) return;
      this.draft.fontMono = this.monoSelect.value;
      this.monoCustomInput.value = this.monoSelect.value;
      this.renderDraftValues();
    });

    this.textCustomInput.addEventListener("input", () => {
      if (!this.draft) return;
      this.draft.fontText = this.textCustomInput.value;
    });

    this.monoCustomInput.addEventListener("input", () => {
      if (!this.draft) return;
      this.draft.fontMono = this.monoCustomInput.value;
    });

    this.sizeInput.addEventListener("input", () => {
      if (!this.draft) return;
      const next = Number.parseFloat(this.sizeInput.value);
      if (!Number.isFinite(next)) return;
      this.draft.fontSize = next;
      this.renderDraftValues();
    });

    this.lineHeightInput.addEventListener("input", () => {
      if (!this.draft) return;
      const next = Number.parseFloat(this.lineHeightInput.value);
      if (!Number.isFinite(next)) return;
      this.draft.lineHeight = next;
      this.renderDraftValues();
    });
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  show() {
    this.draft = { ...this.state.settings };
    this.syncControlsFromDraft();
    this.visible = true;
    this.root.style.display = "flex";
    this.textSelect.focus();
  }

  hide() {
    this.visible = false;
    this.root.style.display = "none";
    this.draft = null;
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

  private renderDraftValues() {
    if (!this.draft) return;
    this.sizeValue.textContent = `${Math.round(this.draft.fontSize)}px`;
    this.lineHeightValue.textContent = this.draft.lineHeight.toFixed(2);
  }

  private syncControlsFromDraft() {
    if (!this.draft) return;

    ensureValueOption(this.textSelect, this.draft.fontText);
    ensureValueOption(this.monoSelect, this.draft.fontMono);
    this.textCustomInput.value = this.draft.fontText;
    this.monoCustomInput.value = this.draft.fontMono;
    this.sizeInput.value = String(this.draft.fontSize);
    this.lineHeightInput.value = String(this.draft.lineHeight);
    this.renderDraftValues();
  }

  private resetDraft() {
    if (!this.draft) return;
    this.draft = { ...DEFAULT_EDITOR_SETTINGS };
    this.syncControlsFromDraft();
  }

  private applyAndClose() {
    if (!this.draft) {
      this.hide();
      return;
    }

    const next: EditorSettings = {
      fontText: normalizeSettingText(
        this.draft.fontText,
        DEFAULT_EDITOR_SETTINGS.fontText
      ),
      fontMono: normalizeSettingText(
        this.draft.fontMono,
        DEFAULT_EDITOR_SETTINGS.fontMono
      ),
      fontSize: clampNumber(
        this.draft.fontSize,
        12,
        26,
        DEFAULT_EDITOR_SETTINGS.fontSize
      ),
      lineHeight: clampNumber(
        this.draft.lineHeight,
        1.2,
        2.2,
        DEFAULT_EDITOR_SETTINGS.lineHeight
      ),
    };

    this.state.updateSettings(next);
    this.hide();
  }
}
