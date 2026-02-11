import {
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
  Decoration,
  EditorView,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";
import { buildHeadingDecos } from "./decorations/headings";
import { buildEmphasisDecos } from "./decorations/emphasis";
import { buildInlineCodeDecos } from "./decorations/inline-code";
import { buildLinkDecos } from "./decorations/links";
import { buildListDecos } from "./decorations/lists";
import { buildBlockquoteDecos } from "./decorations/blockquotes";
import { buildHorizontalRuleDecos } from "./decorations/horizontal-rule";
import { isCursorInRange, isCursorOnLine } from "./cursor-utils";

class MarkdownRenderPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged
    ) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const state = view.state;
    const tree = syntaxTree(state);
    const cursorRanges = state.selection.ranges;
    const decos: Range<Decoration>[] = [];

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
            decos.push(...buildHeadingDecos(node, state));
            return;
          }

          switch (typeName) {
            case "Emphasis": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              decos.push(...buildEmphasisDecos(node, state, "italic"));
              break;
            }
            case "StrongEmphasis": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              decos.push(...buildEmphasisDecos(node, state, "bold"));
              break;
            }
            case "InlineCode": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              decos.push(...buildInlineCodeDecos(node, state));
              break;
            }
            case "Link": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              decos.push(...buildLinkDecos(node, state));
              break;
            }
            case "ListItem": {
              if (isCursorOnLine(cursorRanges, node.from, node.from, state))
                return;
              decos.push(...buildListDecos(node, state));
              break;
            }
            case "Blockquote": {
              if (isCursorInRange(cursorRanges, node.from, node.to))
                return;
              decos.push(...buildBlockquoteDecos(node, state));
              return false; // We handle children ourselves inside buildBlockquoteDecos
            }
            case "HorizontalRule": {
              if (
                isCursorOnLine(cursorRanges, node.from, node.to, state)
              )
                return;
              decos.push(...buildHorizontalRuleDecos(node, state));
              break;
            }
          }
        },
      });
    }

    // Sort by position (required by RangeSetBuilder)
    decos.sort(
      (a, b) => a.from - b.from || a.value.startSide - b.value.startSide
    );

    const builder = new RangeSetBuilder<Decoration>();
    for (const d of decos) {
      try {
        builder.add(d.from, d.to, d.value);
      } catch {
        // Skip overlapping/invalid ranges
      }
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
