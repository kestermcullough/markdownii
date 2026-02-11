import { Decoration } from "@codemirror/view";
import type { EditorState, Range } from "@codemirror/state";

const strikeMark = Decoration.mark({ class: "cm-md-strike" });
const hideMarker = Decoration.replace({});
const STRIKE_PATTERN = /~~(.+?)~~/g;

function* lineStrikeRanges(
  lineText: string,
  lineFrom: number
): Generator<{ from: number; to: number; textFrom: number; textTo: number }> {
  if (!lineText.includes("~~")) return;

  STRIKE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STRIKE_PATTERN.exec(lineText)) !== null) {
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

export function isCursorInsideStrikethrough(
  state: EditorState,
  pos: number
): boolean {
  const line = state.doc.lineAt(pos);
  for (const range of lineStrikeRanges(line.text, line.from)) {
    if (range.from <= pos && pos <= range.to) return true;
  }
  return false;
}

export function buildStrikethroughDecos(
  state: EditorState,
  from: number,
  to: number,
  isEditingRange: (from: number, to: number) => boolean
): Range<Decoration>[] {
  const result: Range<Decoration>[] = [];
  let linePos = state.doc.lineAt(from).from;

  while (linePos <= to) {
    const line = state.doc.lineAt(linePos);
    for (const range of lineStrikeRanges(line.text, line.from)) {
      if (isEditingRange(range.from, range.to)) continue;
      result.push(hideMarker.range(range.from, range.textFrom));
      result.push(hideMarker.range(range.textTo, range.to));
      result.push(strikeMark.range(range.textFrom, range.textTo));
    }

    if (line.to >= to) break;
    linePos = line.to + 1;
  }

  return result;
}
