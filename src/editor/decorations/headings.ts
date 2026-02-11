import { Decoration, type DecorationSet } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

const headingLineDecos: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "cm-md-heading1" }),
  ATXHeading2: Decoration.line({ class: "cm-md-heading2" }),
  ATXHeading3: Decoration.line({ class: "cm-md-heading3" }),
  ATXHeading4: Decoration.line({ class: "cm-md-heading4" }),
  ATXHeading5: Decoration.line({ class: "cm-md-heading5" }),
  ATXHeading6: Decoration.line({ class: "cm-md-heading6" }),
};

const hideMarker = Decoration.replace({});

export function buildHeadingDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const typeName = node.type.name;

  const lineDeco = headingLineDecos[typeName];
  if (!lineDeco) return result;

  // Apply line decoration for font sizing
  const line = state.doc.lineAt(node.from);
  result.push(lineDeco.range(line.from));

  // Find and hide the HeaderMark (the "# " prefix)
  const cursor = node.node.cursor();
  if (cursor.firstChild()) {
    do {
      if (cursor.type.name === "HeaderMark") {
        // Hide "## " — the mark plus one trailing space
        const hideEnd = Math.min(cursor.to + 1, node.to);
        result.push(hideMarker.range(cursor.from, hideEnd));
        break;
      }
    } while (cursor.nextSibling());
  }

  return result;
}
