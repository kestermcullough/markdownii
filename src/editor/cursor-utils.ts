import type { EditorState, SelectionRange } from "@codemirror/state";

/**
 * Check if any cursor or selection overlaps with the range [from, to].
 * Used for inline elements like bold, italic, code, links.
 */
export function isCursorInRange(
  ranges: readonly SelectionRange[],
  from: number,
  to: number
): boolean {
  for (const range of ranges) {
    const selFrom = Math.min(range.anchor, range.head);
    const selTo = Math.max(range.anchor, range.head);
    if (from <= selTo && selFrom <= to) {
      return true;
    }
  }
  return false;
}

/**
 * Line-granularity cursor check for block elements like headings.
 * Returns true if the cursor is on any line that intersects the range.
 */
export function isCursorOnLine(
  ranges: readonly SelectionRange[],
  from: number,
  to: number,
  state: EditorState
): boolean {
  const lineStart = state.doc.lineAt(from).from;
  const lineEnd = state.doc.lineAt(to).to;
  return isCursorInRange(ranges, lineStart, lineEnd);
}
