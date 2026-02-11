import { Decoration } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

const codeMark = Decoration.mark({ class: "cm-md-inline-code" });
const hideMarker = Decoration.replace({});

export function buildInlineCodeDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const cursor = node.node.cursor();
  const marks: { from: number; to: number }[] = [];

  if (cursor.firstChild()) {
    do {
      if (cursor.type.name === "CodeMark") {
        marks.push({ from: cursor.from, to: cursor.to });
      }
    } while (cursor.nextSibling());
  }

  if (marks.length >= 2) {
    const open = marks[0];
    const close = marks[marks.length - 1];

    // Hide backticks
    result.push(hideMarker.range(open.from, open.to));
    result.push(hideMarker.range(close.from, close.to));

    // Style content between backticks
    if (open.to < close.from) {
      result.push(codeMark.range(open.to, close.from));
    }
  }

  return result;
}
