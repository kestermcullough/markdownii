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
});
