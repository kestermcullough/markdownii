import { EditorView } from "@codemirror/view";

const WRAP_PAIRS: Record<string, [string, string]> = {
  "*": ["*", "*"],
  "_": ["_", "_"],
  "`": ["`", "`"],
  "'": ["'", "'"],
  '"': ['"', '"'],
  "=": ["==", "=="],
  "~": ["~~", "~~"],
};

function wrapMainSelection(
  view: EditorView,
  before: string,
  after: string
): boolean {
  const { main, ranges } = view.state.selection;
  if (ranges.length !== 1 || main.empty) return false;

  const { from, to } = main;
  const selected = view.state.doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  });
  return true;
}

export const selectionWrapOnType = EditorView.domEventHandlers({
  keydown(event, view) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.isComposing
    ) {
      return false;
    }

    const pair = WRAP_PAIRS[event.key];
    if (!pair) return false;

    const didWrap = wrapMainSelection(view, pair[0], pair[1]);
    if (didWrap) event.preventDefault();
    return didWrap;
  },
});
