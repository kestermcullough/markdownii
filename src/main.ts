import { EditorView } from "@codemirror/view";
import { getFileName } from "./path-utils";
import { AppState, countWords, type TabState } from "./state";
import { createEditor } from "./editor/setup";
import { Sidebar } from "./ui/sidebar";
import { TabBar } from "./ui/tab-bar";
import { StatusBar } from "./ui/status-bar";
import { registerGlobalShortcuts, editorKeymap } from "./keybindings";

const SAMPLE_MD = `# Welcome to MarkdownII

This is a **minimal markdown editor** with real-time inline rendering.

## Features

- Real-time *inline rendering*
- Folder-based vault with **tabbed editing**
- Keyboard-driven workflow

### Formatting Examples

Here's some **bold text** and some *italic text* and some ***bold italic***.

Inline \`code\` looks like this.

> This is a blockquote.
> It can span multiple lines.

A [link to something](https://example.com) renders inline.

---

1. Ordered list item
2. Another item
3. Third item

- Bullet point
- Another bullet
  - Nested bullet
`;

const WORD_COUNT_DEBOUNCE_MS = 220;

function init() {
  const app = document.getElementById("app")!;
  const state = new AppState();

  // Create layout container
  const layout = document.createElement("div");
  layout.className = "app-layout";
  app.appendChild(layout);

  // Sidebar
  const sidebar = new Sidebar(state);

  const tabBar = new TabBar(state);

  // Editor area
  const editorArea = document.createElement("div");
  editorArea.className = "editor-area";

  // Status bar
  const statusBar = new StatusBar(state);

  // Lazy-loaded overlays (keeps startup bundle smaller)
  let palette: {
    mount(parent: HTMLElement): void;
    show(): void;
    hide(): void;
    isVisible(): boolean;
  } | null = null;

  let fontSelector: {
    mount(parent: HTMLElement): void;
    show(): void;
    hide(): void;
    isVisible(): boolean;
  } | null = null;

  let paletteLoading: Promise<void> | null = null;
  let fontSelectorLoading: Promise<void> | null = null;

  const ensurePalette = async () => {
    if (palette) return;
    if (!paletteLoading) {
      paletteLoading = import("./ui/command-palette").then(({ CommandPalette }) => {
        palette = new CommandPalette(state);
        palette.mount(document.body);
      });
    }
    await paletteLoading;
  };

  const ensureFontSelector = async () => {
    if (fontSelector) return;
    if (!fontSelectorLoading) {
      fontSelectorLoading = import("./ui/font-selector").then(({ FontSelector }) => {
        fontSelector = new FontSelector(state);
        fontSelector.mount(document.body);
      });
    }
    await fontSelectorLoading;
  };

  const paletteController = {
    show() {
      void ensurePalette().then(() => palette?.show());
    },
    hide() {
      palette?.hide();
    },
    isVisible() {
      return palette?.isVisible() ?? false;
    },
  };

  const fontSelectorController = {
    show() {
      void ensureFontSelector().then(() => fontSelector?.show());
    },
    hide() {
      fontSelector?.hide();
    },
    isVisible() {
      return fontSelector?.isVisible() ?? false;
    },
  };

  // Assemble layout
  layout.appendChild(sidebar.root);
  layout.appendChild(tabBar.root);
  layout.appendChild(editorArea);
  layout.appendChild(statusBar.root);

  const updateWindowTitle = () => {
    const vaultName = state.vaultPath ? getFileName(state.vaultPath) : "MarkdownII";
    const active = state.getActiveTab();
    document.title = active
      ? `${active.name} — ${vaultName}`
      : `${vaultName} — MarkdownII`;
  };

  state.on("vault-loaded", updateWindowTitle);
  state.on("tabs-changed", updateWindowTitle);
  state.on("active-tab-changed", updateWindowTitle);
  updateWindowTitle();

  // Handle sidebar toggle
  state.on("sidebar-toggled", () => {
    layout.classList.toggle("sidebar-collapsed", !state.sidebarVisible);
  });

  // Track current editor
  let currentEditor: EditorView | null = null;
  let scratchWordCount = countWords(SAMPLE_MD);
  let scratchWordCountTimerId: number | null = null;

  const tabWordCountTimerIds = new Map<string, number>();

  const scheduleTabWordCount = (tab: TabState, text: string) => {
    const previousTimerId = tabWordCountTimerIds.get(tab.path);
    if (previousTimerId !== undefined) {
      window.clearTimeout(previousTimerId);
    }

    const timerId = window.setTimeout(() => {
      tab.wordCount = countWords(text);
      tabWordCountTimerIds.delete(tab.path);

      if (state.activeFilePath === tab.path && tab.editorView) {
        updateStatusBar(tab.editorView, statusBar, tab.wordCount);
      }
    }, WORD_COUNT_DEBOUNCE_MS);

    tabWordCountTimerIds.set(tab.path, timerId);
  };

  state.on("tabs-changed", () => {
    const openPaths = new Set(state.openTabs.map((tab) => tab.path));
    for (const [path, timerId] of tabWordCountTimerIds) {
      if (!openPaths.has(path)) {
        window.clearTimeout(timerId);
        tabWordCountTimerIds.delete(path);
      }
    }
  });

  // Handle tab switching: swap the editor view
  state.on("active-tab-changed", () => {
    const tab = state.getActiveTab();

    // Remove current editor from DOM (but don't destroy — it's stored in tab state)
    if (currentEditor) {
      currentEditor.dom.remove();
      currentEditor = null;
    }

    if (!tab) {
      // No active tab, show empty state
      editorArea.innerHTML =
        '<div class="empty-state"><span>Open a file to start editing</span></div>';
      statusBar.update(1, 1, 0);
      return;
    }

    // Clear any placeholder
    editorArea.innerHTML = "";

    // Create editor if this tab doesn't have one yet
    if (!tab.editorView) {
      tab.editorView = createEditor(
        editorArea,
        tab.content,
        undefined,
        editorKeymap(),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged && !update.selectionSet) return;
          if (update.docChanged) {
            const beforeText = update.startState.doc.toString();
            const nextText = update.state.doc.toString();
            scheduleTabWordCount(tab, nextText);
            state.recordDocChange(tab.path, beforeText, nextText);
            if (!state.isApplyingHistory(tab.path)) {
              state.syncDirtyFromContent(tab.path, nextText);
            }
          }
          updateStatusBar(update.view, statusBar, tab.wordCount);
        })
      );
    } else {
      // Re-attach existing editor
      editorArea.appendChild(tab.editorView.dom);
    }

    currentEditor = tab.editorView;

    // Restore scroll position
    if (tab.scrollTop) {
      currentEditor.scrollDOM.scrollTop = tab.scrollTop;
    }

    // Focus the editor
    currentEditor.focus();

    // Update status bar
    updateStatusBar(currentEditor, statusBar, tab.wordCount);
  });

  // Register global shortcuts
  registerGlobalShortcuts(state, paletteController, fontSelectorController);

  // Show a scratch editor on first load (before any vault is opened)
  const scratchEditor = createEditor(
    editorArea,
    SAMPLE_MD,
    undefined,
    editorKeymap(),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return;
      if (update.docChanged) {
        const nextText = update.state.doc.toString();
        if (scratchWordCountTimerId !== null) {
          window.clearTimeout(scratchWordCountTimerId);
        }
        scratchWordCountTimerId = window.setTimeout(() => {
          scratchWordCount = countWords(nextText);
          scratchWordCountTimerId = null;
          if (currentEditor === scratchEditor) {
            updateStatusBar(scratchEditor, statusBar, scratchWordCount);
          }
        }, WORD_COUNT_DEBOUNCE_MS);
      }
      updateStatusBar(update.view, statusBar, scratchWordCount);
    })
  );
  currentEditor = scratchEditor;
  updateStatusBar(scratchEditor, statusBar, scratchWordCount);
}

function updateStatusBar(view: EditorView, statusBar: StatusBar, words: number) {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  statusBar.update(line.number, pos - line.from + 1, words);
}

init();
