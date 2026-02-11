import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { obsidianTheme } from "./theme";
import { markdownRenderPlugin } from "./markdown-render";

export function createEditor(
  parent: HTMLElement,
  doc: string = "",
  onChange?: () => void,
  ...extraExtensions: Extension[]
): EditorView {
  const extensions: Extension[] = [
    // Core editing
    history(),
    closeBrackets(),
    drawSelection(),
    highlightActiveLine(),
    EditorView.lineWrapping,

    // Keymaps
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      indentWithTab,
    ]),

    // Markdown
    markdown({ base: markdownLanguage }),

    // Inline rendering (Obsidian-style)
    markdownRenderPlugin,

    // Theme
    ...obsidianTheme,
  ];

  if (onChange) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange();
        }
      })
    );
  }

  extensions.push(...extraExtensions);

  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions,
    }),
  });
}
