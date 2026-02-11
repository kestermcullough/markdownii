import { Decoration, WidgetType } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = "\u2022"; // bullet dot
    return span;
  }

  eq(): boolean {
    return true;
  }
}

const bulletWidget = new BulletWidget();

export function buildListDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const cursor = node.node.cursor();

  if (cursor.firstChild()) {
    do {
      if (cursor.type.name === "ListMark") {
        const markText = state.doc.sliceString(cursor.from, cursor.to);

        if (markText === "-" || markText === "*" || markText === "+") {
          // Replace "- " with bullet widget
          const replaceEnd = Math.min(cursor.to + 1, node.to);
          result.push(
            Decoration.replace({
              widget: bulletWidget,
            }).range(cursor.from, replaceEnd)
          );
        }
        // For ordered lists (1., 2., etc.) we leave them as-is for now
        break;
      }
    } while (cursor.nextSibling());
  }

  return result;
}
