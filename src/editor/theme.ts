import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Tokyo Night - Night variant
const tokyoNightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
    },
    ".cm-content": {
      caretColor: "var(--text-primary)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--text-primary)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "#283457",
      },
    ".cm-activeLine": {
      backgroundColor: "rgba(192, 202, 245, 0.03)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-faint)",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
    },
  },
  { dark: true }
);

const tokyoNightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "2em", color: "#7aa2f7" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.6em", color: "#7dcfff" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.3em", color: "#bb9af7" },
  { tag: tags.heading4, fontWeight: "600", fontSize: "1.1em", color: "#9d7cd8" },
  { tag: tags.heading5, fontWeight: "600", color: "#73daca" },
  { tag: tags.heading6, fontWeight: "600", color: "var(--text-muted)" },
  { tag: tags.strong, fontWeight: "700", color: "#ff9e64" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#bb9af7" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--text-muted)" },
  { tag: tags.link, color: "#7aa2f7", textDecoration: "underline" },
  { tag: tags.url, color: "#565f89" },
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--code-bg)",
    borderRadius: "3px",
    color: "#9ece6a",
  },
  { tag: tags.quote, color: "var(--text-secondary)" },
  { tag: tags.meta, color: "#565f89" },
  { tag: tags.processingInstruction, color: "#565f89" },
]);

export const obsidianTheme = [
  tokyoNightTheme,
  syntaxHighlighting(tokyoNightHighlight),
];
