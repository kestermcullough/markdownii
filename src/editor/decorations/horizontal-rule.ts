import { Decoration, WidgetType } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

class HRWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-md-hr";
    return hr;
  }

  eq(): boolean {
    return true;
  }
}

const hrWidget = new HRWidget();

export function buildHorizontalRuleDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const line = state.doc.lineAt(node.from);
  return [
    Decoration.replace({
      widget: hrWidget,
      block: true,
    }).range(line.from, line.to),
  ];
}
