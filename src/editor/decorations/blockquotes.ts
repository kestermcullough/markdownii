import { Decoration } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

const quoteLine = Decoration.line({ class: "cm-md-blockquote" });
const hideMarker = Decoration.replace({});

export function buildBlockquoteDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];

  // Apply line decoration to every line in the blockquote
  let pos = node.from;
  while (pos <= node.to) {
    const line = state.doc.lineAt(pos);
    result.push(quoteLine.range(line.from));
    if (line.to >= node.to) break;
    pos = line.to + 1;
  }

  // Walk the tree to find and hide QuoteMark children (the ">" characters)
  const walk = node.node.cursor();
  if (walk.firstChild()) {
    do {
      if (walk.type.name === "QuoteMark") {
        // Hide "> " (mark + space after it)
        const hideEnd = Math.min(walk.to + 1, node.to);
        result.push(hideMarker.range(walk.from, hideEnd));
      }
    } while (walk.next());
  }

  return result;
}
