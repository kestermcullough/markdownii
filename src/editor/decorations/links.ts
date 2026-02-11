import { Decoration } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

const hideMarker = Decoration.replace({});

export function buildLinkDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const cursor = node.node.cursor();

  let urlText = "";
  const linkMarks: { from: number; to: number }[] = [];

  if (cursor.firstChild()) {
    do {
      if (cursor.type.name === "LinkMark") {
        linkMarks.push({ from: cursor.from, to: cursor.to });
      } else if (cursor.type.name === "URL") {
        urlText = state.doc.sliceString(cursor.from, cursor.to);
      }
    } while (cursor.nextSibling());
  }

  // Link structure: [text](url)
  // LinkMarks are: [, ], (, )
  if (linkMarks.length >= 4) {
    // Hide "["
    result.push(hideMarker.range(linkMarks[0].from, linkMarks[0].to));
    // Hide "](url)" — from "]" to final ")"
    result.push(hideMarker.range(linkMarks[1].from, linkMarks[3].to));

    // Style the text between "[" and "]"
    const textFrom = linkMarks[0].to;
    const textTo = linkMarks[1].from;

    if (textFrom < textTo) {
      const styledMark = Decoration.mark({
        class: "cm-md-link",
        attributes: { title: urlText },
      });
      result.push(styledMark.range(textFrom, textTo));
    }
  }

  return result;
}
