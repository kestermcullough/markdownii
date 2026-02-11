import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const obsidianDarkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
    },
    ".cm-content": {
      caretColor: "var(--accent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(127, 109, 242, 0.2)",
      },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
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

const obsidianHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "2em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.6em" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.3em" },
  { tag: tags.heading4, fontWeight: "600", fontSize: "1.1em" },
  { tag: tags.heading5, fontWeight: "600" },
  { tag: tags.heading6, fontWeight: "600", color: "var(--text-muted)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--link-color)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--text-muted)" },
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--code-bg)",
    borderRadius: "3px",
  },
  { tag: tags.quote, color: "var(--text-secondary)" },
  { tag: tags.meta, color: "var(--text-muted)" },
  { tag: tags.processingInstruction, color: "var(--text-muted)" },
]);

export const obsidianTheme = [
  obsidianDarkTheme,
  syntaxHighlighting(obsidianHighlight),
];
