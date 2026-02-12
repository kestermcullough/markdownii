import { Decoration, WidgetType } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import type { EditorState } from "@codemirror/state";

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = "\u2022";
    return span;
  }

  eq(): boolean {
    return true;
  }
}

class TaskBoxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.checked ? "cm-md-task-box is-checked" : "cm-md-task-box";
    return span;
  }

  eq(other: WidgetType): boolean {
    return other instanceof TaskBoxWidget && other.checked === this.checked;
  }
}

const bulletWidget = new BulletWidget();
const taskEmptyWidget = new TaskBoxWidget(false);
const taskCheckedWidget = new TaskBoxWidget(true);
const taskDoneMark = Decoration.mark({ class: "cm-md-task-line-done" });

export function parseTaskPrefix(
  lineText: string,
  lineFrom: number,
  listMarkFrom: number
): { checked: boolean; replaceTo: number } | null {
  const listMarkOffset = listMarkFrom - lineFrom;
  if (listMarkOffset < 0 || listMarkOffset >= lineText.length) return null;

  const segment = lineText.slice(listMarkOffset);
  const match = /^[-*+]\s+\[( |x|X)\]\s*/.exec(segment);
  if (!match) return null;

  return {
    checked: match[1].toLowerCase() === "x",
    replaceTo: listMarkFrom + match[0].length,
  };
}

export function buildListDecos(
  node: SyntaxNodeRef,
  state: EditorState
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  const cursor = node.node.cursor();
  const line = state.doc.lineAt(node.from);

  if (cursor.firstChild()) {
    do {
      if (cursor.type.name !== "ListMark") continue;

      const markText = state.doc.sliceString(cursor.from, cursor.to);
      if (markText !== "-" && markText !== "*" && markText !== "+") {
        break;
      }

      const taskPrefix = parseTaskPrefix(line.text, line.from, cursor.from);
      if (taskPrefix) {
        const replaceTo = Math.min(taskPrefix.replaceTo, line.to);
        result.push(
          Decoration.replace({
            widget: taskPrefix.checked ? taskCheckedWidget : taskEmptyWidget,
          }).range(cursor.from, replaceTo)
        );

        if (taskPrefix.checked && replaceTo < line.to) {
          result.push(taskDoneMark.range(replaceTo, line.to));
        }

        break;
      }

      const replaceEnd = Math.min(cursor.to + 1, line.to);
      result.push(
        Decoration.replace({
          widget: bulletWidget,
        }).range(cursor.from, replaceEnd)
      );
      break;
    } while (cursor.nextSibling());
  }

  return result;
}
