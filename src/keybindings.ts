import { keymap, EditorView } from "@codemirror/view";
import type { AppState } from "./state";
import type { CommandPalette } from "./ui/command-palette";
import type { FontSelector } from "./ui/font-selector";

const isMac = navigator.platform.includes("Mac");

function isModKey(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

function isFormControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function registerGlobalShortcuts(
  state: AppState,
  palette: CommandPalette,
  fontSelector: FontSelector
) {
  document.addEventListener("keydown", (e) => {
    // Escape: close palette
    if (e.key === "Escape") {
      if (fontSelector.isVisible()) {
        fontSelector.hide();
        e.preventDefault();
      }
      if (palette.isVisible()) {
        palette.hide();
        e.preventDefault();
      }
      return;
    }

    if (isFormControlTarget(e.target)) return;

    if (!isModKey(e)) return;

    switch (e.key.toLowerCase()) {
      case "p":
        e.preventDefault();
        palette.show();
        break;
      case "s":
        e.preventDefault();
        state.saveActiveFile();
        break;
      case "z":
        e.preventDefault();
        if (e.shiftKey) state.redoActiveFile();
        else state.undoActiveFile();
        break;
      case "y":
        if (!isMac) {
          e.preventDefault();
          state.redoActiveFile();
        }
        break;
      case "w":
        e.preventDefault();
        if (state.activeFilePath) state.closeTab(state.activeFilePath);
        break;
      case "n":
        e.preventDefault();
        state.createNewFile();
        break;
      case "o":
        e.preventDefault();
        state.openVault();
        break;
      case ",":
        e.preventDefault();
        fontSelector.show();
        break;
      case "tab":
        e.preventDefault();
        if (e.shiftKey) state.prevTab();
        else state.nextTab();
        break;
      default:
        // Cmd+1..9: switch to tab by index
        if (e.key >= "1" && e.key <= "9") {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          if (state.openTabs[idx]) {
            state.switchToTab(state.openTabs[idx].path);
          }
        }
        break;
    }

    // Cmd+Shift+E: toggle sidebar
    if (e.key.toLowerCase() === "e" && e.shiftKey) {
      e.preventDefault();
      state.toggleSidebar();
    }
  }, { capture: true });
}

/** CM6 keymap extension for formatting shortcuts */
export function editorKeymap() {
  return keymap.of([
    {
      key: "Mod-b",
      run: (view: EditorView) => {
        wrapSelection(view, "**", "**");
        return true;
      },
    },
    {
      key: "Mod-i",
      run: (view: EditorView) => {
        wrapSelection(view, "_", "_");
        return true;
      },
    },
    {
      key: "Mod-`",
      run: (view: EditorView) => {
        wrapSelection(view, "`", "`");
        return true;
      },
    },
    {
      key: "Mod-k",
      run: (view: EditorView) => {
        insertLinkTemplate(view);
        return true;
      },
    },
  ]);
}

function wrapSelection(
  view: EditorView,
  before: string,
  after: string
) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);

  // Check if already wrapped — toggle off
  const textBefore = view.state.doc.sliceString(
    Math.max(0, from - before.length),
    from
  );
  const textAfter = view.state.doc.sliceString(
    to,
    Math.min(view.state.doc.length, to + after.length)
  );

  if (textBefore === before && textAfter === after) {
    // Unwrap
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: "" },
        { from: to, to: to + after.length, insert: "" },
      ],
      selection: {
        anchor: from - before.length,
        head: to - before.length,
      },
    });
  } else {
    // Wrap
    view.dispatch({
      changes: [
        { from, insert: before },
        { from: to, insert: after },
      ],
      selection: {
        anchor: from + before.length,
        head: to + before.length,
      },
    });
  }
}

function insertLinkTemplate(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.doc.sliceString(from, to);

  if (selected) {
    // Wrap selection as link text
    const insert = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert },
      // Place cursor at "url"
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
  } else {
    const insert = "[](url)";
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 1 },
    });
  }
}
