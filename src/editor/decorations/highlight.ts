import { Decoration } from "@codemirror/view";
import type { EditorState, Range } from "@codemirror/state";

const highlightMark = Decoration.mark({ class: "cm-md-highlight" });
const hideMarker = Decoration.replace({});
const HIGHLIGHT_PATTERN = /==(.+?)==/g;

function* lineHighlightRanges(
  lineText: string,
  lineFrom: number
): Generator<{ from: number; to: number; textFrom: number; textTo: number }> {
  if (!lineText.includes("==")) return;

  HIGHLIGHT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HIGHLIGHT_PATTERN.exec(lineText)) !== null) {
    const openFrom = lineFrom + match.index;
    const closeFrom = openFrom + match[0].length - 2;
    const textFrom = openFrom + 2;
    const textTo = closeFrom;
    if (textFrom >= textTo) continue;
    if (!match[1].trim()) continue;
    yield {
      from: openFrom,
      to: closeFrom + 2,
      textFrom,
      textTo,
    };
  }
}

export function isCursorInsideHighlight(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  for (const range of lineHighlightRanges(line.text, line.from)) {
    if (range.from <= pos && pos <= range.to) return true;
  }
  return false;
}

export function buildHighlightDecos(
  state: EditorState,
  from: number,
  to: number,
  isEditingRange: (from: number, to: number) => boolean
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  let linePos = state.doc.lineAt(from).from;

  while (linePos <= to) {
    const line = state.doc.lineAt(linePos);
    for (const range of lineHighlightRanges(line.text, line.from)) {
      if (isEditingRange(range.from, range.to)) continue;
      result.push(hideMarker.range(range.from, range.textFrom));
      result.push(hideMarker.range(range.textTo, range.to));
      result.push(highlightMark.range(range.textFrom, range.textTo));
    }

    if (line.to >= to) break;
    linePos = line.to + 1;
  }

  return result;
}
