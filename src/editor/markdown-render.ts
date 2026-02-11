import {
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
  Decoration,
  EditorView,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import { buildHeadingDecos } from "./decorations/headings";
import { buildEmphasisDecos } from "./decorations/emphasis";
import { buildInlineCodeDecos } from "./decorations/inline-code";
import { buildLinkDecos } from "./decorations/links";
import { buildListDecos } from "./decorations/lists";
import { buildBlockquoteDecos } from "./decorations/blockquotes";
import { buildHorizontalRuleDecos } from "./decorations/horizontal-rule";
import {
  buildHighlightDecos,
  isCursorInsideHighlight,
} from "./decorations/highlight";
import {
  buildStrikethroughDecos,
  isCursorInsideStrikethrough,
} from "./decorations/strikethrough";
import { isCursorInRange, isCursorOnLine } from "./cursor-utils";

const INLINE_RENDER_MARKER_RE = /[#*_`\[\]()~>=-]/;

function lineMayNeedInlineRendering(lineText: string): boolean {
  return INLINE_RENDER_MARKER_RE.test(lineText);
}

function cursorContextSignature(
  state: EditorState,
  pos: number,
  tree = syntaxTree(state)
): string {
  const lineNumber = state.doc.lineAt(pos).number;
  const isInHighlight = isCursorInsideHighlight(state, pos) ? "1" : "0";
  const isInStrike = isCursorInsideStrikethrough(state, pos) ? "1" : "0";
  const interestingAncestors: string[] = [];
  let node = tree.resolveInner(pos, -1);
  while (true) {
    const typeName = node.type.name;
    if (
      typeName.startsWith("ATXHeading") ||
      typeName === "Emphasis" ||
      typeName === "StrongEmphasis" ||
      typeName === "InlineCode" ||
      typeName === "Link" ||
      typeName === "ListItem" ||
      typeName === "Blockquote" ||
      typeName === "HorizontalRule"
    ) {
      interestingAncestors.push(typeName);
    }
    const parent = node.parent;
    if (!parent) break;
    node = parent;
  }

  return `${lineNumber}|hl:${isInHighlight}|st:${isInStrike}|${interestingAncestors.join(">")}`;
}

function shouldRebuildForSelection(update: ViewUpdate): boolean {
  const prevSelection = update.startState.selection;
  const nextSelection = update.state.selection;

  if (prevSelection.ranges.length !== nextSelection.ranges.length) {
    return true;
  }

  const prevMain = prevSelection.main;
  const nextMain = nextSelection.main;
  if (
    prevMain.anchor === nextMain.anchor &&
    prevMain.head === nextMain.head
  ) {
    return false;
  }

  if (prevMain.empty !== nextMain.empty) {
    return true;
  }

  // Fast path: moving around plain text on a single line does not affect inline
  // rendering, so skip syntax-tree work.
  if (prevMain.empty && nextMain.empty) {
    const prevLine = update.state.doc.lineAt(prevMain.head);
    const nextLine = update.state.doc.lineAt(nextMain.head);
    if (
      prevLine.number === nextLine.number &&
      !lineMayNeedInlineRendering(nextLine.text)
    ) {
      return false;
    }
  }

  const prevTree = syntaxTree(update.startState);
  const nextTree = syntaxTree(update.state);

  const prevAnchorSig = cursorContextSignature(
    update.startState,
    prevMain.anchor,
    prevTree
  );
  const nextAnchorSig = cursorContextSignature(update.state, nextMain.anchor, nextTree);
  if (prevAnchorSig !== nextAnchorSig) {
    return true;
  }

  const prevHeadSig = cursorContextSignature(update.startState, prevMain.head, prevTree);
  const nextHeadSig = cursorContextSignature(update.state, nextMain.head, nextTree);
  return prevHeadSig !== nextHeadSig;
}

class MarkdownRenderPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
      return;
    }

    if (update.selectionSet && shouldRebuildForSelection(update)) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const state = view.state;
    const tree = syntaxTree(state);
    const cursorRanges = state.selection.ranges;
    const decos: Range<Decoration>[] = [];

    let maybeSorted = true;
    let lastFrom = -1;
    let lastStartSide = Number.NEGATIVE_INFINITY;

    const pushRange = (range: Range<Decoration>) => {
      if (
        range.from < lastFrom ||
        (range.from === lastFrom && range.value.startSide < lastStartSide)
      ) {
        maybeSorted = false;
      }
      lastFrom = range.from;
      lastStartSide = range.value.startSide;
      decos.push(range);
    };

    const pushRanges = (ranges: Range<Decoration>[]) => {
      for (const range of ranges) {
        pushRange(range);
      }
    };

    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from,
        to,
        enter: (node: SyntaxNodeRef) => {
          const typeName = node.type.name;

          // Headings: use line-level cursor check
          if (typeName.startsWith("ATXHeading")) {
            if (isCursorOnLine(cursorRanges, node.from, node.to, state)) {
              return;
            }
            pushRanges(buildHeadingDecos(node, state));
            return;
          }

          switch (typeName) {
            case "Emphasis": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              pushRanges(buildEmphasisDecos(node, state, "italic"));
              break;
            }
            case "StrongEmphasis": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              pushRanges(buildEmphasisDecos(node, state, "bold"));
              break;
            }
            case "InlineCode": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              pushRanges(buildInlineCodeDecos(node, state));
              break;
            }
            case "Link": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              pushRanges(buildLinkDecos(node, state));
              break;
            }
            case "ListItem": {
              if (isCursorOnLine(cursorRanges, node.from, node.from, state))
                return;
              pushRanges(buildListDecos(node, state));
              break;
            }
            case "Blockquote": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              pushRanges(buildBlockquoteDecos(node, state));
              return false; // We handle children ourselves inside buildBlockquoteDecos
            }
            case "HorizontalRule": {
              if (
                isCursorOnLine(cursorRanges, node.from, node.to, state)
              )
                return;
              pushRanges(buildHorizontalRuleDecos(node, state));
              break;
            }
          }
        },
      });

      pushRanges(
        buildHighlightDecos(
          state,
          from,
          to,
          (rangeFrom, rangeTo) =>
            isCursorInRange(cursorRanges, rangeFrom, rangeTo)
        )
      );

      pushRanges(
        buildStrikethroughDecos(
          state,
          from,
          to,
          (rangeFrom, rangeTo) =>
            isCursorInRange(cursorRanges, rangeFrom, rangeTo)
        )
      );
    }

    if (!maybeSorted) {
      decos.sort(
        (a, b) => a.from - b.from || a.value.startSide - b.value.startSide
      );
    }

    const builder = new RangeSetBuilder<Decoration>();
    for (const d of decos) {
      builder.add(d.from, d.to, d.value);
    }
    return builder.finish();
  }
}

export const markdownRenderPlugin = ViewPlugin.fromClass(
  MarkdownRenderPlugin,
  {
    decorations: (instance) => instance.decorations,
  }
);
