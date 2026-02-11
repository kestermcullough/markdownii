import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { AppState } from "./state";

interface OverlayController {
  show(): void;
  hide(): void;
  isVisible(): boolean;
}

type ChecklistState = "none" | "point" | "empty-box" | "checked-box";

const TASK_EMPTY_RE = /^[-*+]\s+\[ \]\s*/;
const TASK_CHECKED_RE = /^[-*+]\s+\[[xX]\]\s*/;
const POINT_RE = /^[-*+]\s+/;

let armedPointToNoneKey: string | null = null;

const isMac = navigator.platform.includes("Mac");

function modLabel(): string {
  return isMac ? "Cmd" : "Ctrl";
}

function showShortcutHelp() {
  const mod = modLabel();
  alert(
    [
      "Keyboard Shortcuts",
      "",
      `${mod}+P  Open file palette`,
      `${mod}+S  Save`,
      `${mod}+N  New file`,
      `${mod}+O  Open vault`,
      `${mod}+W  Close tab`,
      `${mod}+Tab / ${mod}+Shift+Tab  Next/Prev tab`,
      `${mod}+1..9  Jump to tab`,
      `${mod}+,  Font settings`,
      `${mod}+?  Show this shortcuts help`,
      `${mod}+Shift+E  Toggle sidebar`,
      `${mod}+Z / ${mod}+Shift+Z  Undo/Redo`,
      "",
      "Editor",
      "Shift+Enter  Cycle task state",
      `${mod}+B  Bold`,
      `${mod}+I  Italic`,
      mod + "+`  Inline code",
      `${mod}+K  Insert link`,
    ].join("\n")
  );
}

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

function splitIndent(lineText: string): { indent: string; rest: string } {
  const match = /^(\s*)(.*)$/.exec(lineText);
  if (!match) return { indent: "", rest: lineText };
  return { indent: match[1], rest: match[2] };
}

function parseChecklistState(rest: string): {
  state: ChecklistState;
  prefixLength: number;
  content: string;
} {
  const checked = TASK_CHECKED_RE.exec(rest);
  if (checked) {
    return {
      state: "checked-box",
      prefixLength: checked[0].length,
      content: rest.slice(checked[0].length),
    };
  }

  const empty = TASK_EMPTY_RE.exec(rest);
  if (empty) {
    return {
      state: "empty-box",
      prefixLength: empty[0].length,
      content: rest.slice(empty[0].length),
    };
  }

  const point = POINT_RE.exec(rest);
  if (point) {
    return {
      state: "point",
      prefixLength: point[0].length,
      content: rest.slice(point[0].length),
    };
  }

  return {
    state: "none",
    prefixLength: 0,
    content: rest,
  };
}

function remapCursorColumn(
  oldColumn: number,
  oldPrefixLength: number,
  newPrefixLength: number
): number {
  if (oldColumn <= oldPrefixLength) return newPrefixLength;
  return newPrefixLength + (oldColumn - oldPrefixLength);
}

function lineCycleKey(lineFrom: number, lineText: string): string {
  return `${lineFrom}:${lineText}`;
}

function cycleChecklistState(view: EditorView): boolean {
  const selection = view.state.selection;
  if (selection.ranges.length !== 1) {
    return false;
  }

  const head = selection.main.head;
  const line = view.state.doc.lineAt(head);
  const currentLineKey = lineCycleKey(line.from, line.text);
  const oldColumn = head - line.from;

  const { indent, rest } = splitIndent(line.text);
  const parsed = parseChecklistState(rest);

  let newPrefix = "- ";
  switch (parsed.state) {
    case "none":
      newPrefix = "- ";
      armedPointToNoneKey = null;
      break;
    case "point":
      if (armedPointToNoneKey === currentLineKey) {
        newPrefix = "";
        armedPointToNoneKey = null;
      } else {
        newPrefix = "- [ ] ";
        armedPointToNoneKey = null;
      }
      break;
    case "empty-box":
      newPrefix = "- [x] ";
      armedPointToNoneKey = null;
      break;
    case "checked-box":
      newPrefix = "- ";
      break;
  }

  const nextRest = `${newPrefix}${parsed.content}`;
  const nextLineText = `${indent}${nextRest}`;

  if (nextLineText === line.text) return false;

  const oldPrefixLength = indent.length + parsed.prefixLength;
  const newPrefixLength = indent.length + newPrefix.length;
  const newColumn = Math.min(
    Math.max(0, remapCursorColumn(oldColumn, oldPrefixLength, newPrefixLength)),
    nextLineText.length
  );

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: nextLineText },
    selection: { anchor: line.from + newColumn },
  });

  if (parsed.state === "checked-box") {
    armedPointToNoneKey = lineCycleKey(line.from, nextLineText);
  }

  return true;
}

export function registerGlobalShortcuts(
  state: AppState,
  palette: OverlayController,
  fontSelector: OverlayController
) {
  document.addEventListener(
    "keydown",
    (e) => {
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

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        showShortcutHelp();
        return;
      }

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
    },
    { capture: true }
  );
}

/** CM6 keymap extension for formatting shortcuts */
export function editorKeymap() {
  return Prec.highest(
    keymap.of([
      {
        key: "Shift-Enter",
        run: (view: EditorView) => cycleChecklistState(view),
      },
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
    ])
  );
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
      selection: {
        anchor: from + selected.length + 3,
        head: from + selected.length + 6,
      },
    });
  } else {
    const insert = "[](url)";
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 1 },
    });
  }
}
