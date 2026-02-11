import { Decoration } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

const boldMark = Decoration.mark({ class: "cm-md-bold" });
const italicMark = Decoration.mark({ class: "cm-md-italic" });
const hideMarker = Decoration.replace({});

export function buildEmphasisDecos(
  node: SyntaxNodeRef,
  state: EditorState,
  kind: "bold" | "italic"
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const mark = kind === "bold" ? boldMark : italicMark;

  const cursor = node.node.cursor();
  const markers: { from: number; to: number }[] = [];

  if (cursor.firstChild()) {
    do {
      if (cursor.type.name === "EmphasisMark") {
        markers.push({ from: cursor.from, to: cursor.to });
      }
    } while (cursor.nextSibling());
  }

  if (markers.length >= 2) {
    const openMark = markers[0];
    const closeMark = markers[markers.length - 1];

    // Hide opening and closing markers
    result.push(hideMarker.range(openMark.from, openMark.to));
    result.push(hideMarker.range(closeMark.from, closeMark.to));

    // Apply style to content between markers
    if (openMark.to < closeMark.from) {
      result.push(mark.range(openMark.to, closeMark.from));
    }
  }

  return result;
}
