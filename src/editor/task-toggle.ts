import { EditorView } from "@codemirror/view";

const TASK_PREFIX_RE = /^(\s*[-*+]\s+)\[( |x|X)\](\s*)/;

function toggleTaskAtPosition(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos);
  const match = TASK_PREFIX_RE.exec(line.text);
  if (!match) return false;

  const prefixLength = match[1].length;
  const bracketFrom = line.from + prefixLength;
  const bracketTo = bracketFrom + 3;
  const next = match[2].toLowerCase() === "x" ? "[ ]" : "[x]";

  view.dispatch({
    changes: { from: bracketFrom, to: bracketTo, insert: next },
  });

  return true;
}

function protectTaskPrefixDelete(
  view: EditorView,
  key: string
): boolean {
  if (key !== "Backspace" && key !== "Delete") return false;

  const selection = view.state.selection;
  if (selection.ranges.length !== 1) return false;

  const range = selection.main;
  const line = view.state.doc.lineAt(range.head);
  const match = TASK_PREFIX_RE.exec(line.text);
  if (!match) return false;

  const prefixFrom = line.from;
  const prefixTo = line.from + match[0].length;

  const touchesPrefix = range.empty
    ? key === "Backspace"
      ? range.head > prefixFrom && range.head <= prefixTo
      : range.head >= prefixFrom && range.head < prefixTo
    : range.from < prefixTo && range.to > prefixFrom;

  if (!touchesPrefix) return false;

  // Revert checklist marker to plain list marker when deleting into task prefix.
  const plainPrefix = match[1];
  const content = line.text.slice(match[0].length);
  const nextLine = `${plainPrefix}${content}`;
  const nextPos = line.from + plainPrefix.length;

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: nextLine },
    selection: { anchor: nextPos },
  });

  view.focus();
  return true;
}

export const taskToggleOnClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;

    const box = target.closest(".cm-md-task-box");
    if (!(box instanceof HTMLElement)) return false;

    event.preventDefault();

    let pos: number;
    try {
      pos = view.posAtDOM(box, 0);
    } catch {
      return true;
    }

    toggleTaskAtPosition(view, pos);
    view.focus();
    return true;
  },
  keydown(event, view) {
    if (!protectTaskPrefixDelete(view, event.key)) return false;
    event.preventDefault();
    return true;
  },
});
