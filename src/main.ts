import { EditorView } from "@codemirror/view";
import { AppState } from "./state";
import { createEditor } from "./editor/setup";
import { Sidebar } from "./ui/sidebar";
import { TabBar } from "./ui/tab-bar";
import { CommandPalette } from "./ui/command-palette";
import { StatusBar } from "./ui/status-bar";
import { registerGlobalShortcuts, editorKeymap } from "./keybindings";

const SAMPLE_MD = `# Welcome to Obsidian Lite

This is a **minimal markdown editor** inspired by Obsidian.

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

function init() {
  const app = document.getElementById("app")!;
  const state = new AppState();

  // Create layout container
  const layout = document.createElement("div");
  layout.className = "app-layout";
  app.appendChild(layout);

  // Sidebar
  const sidebar = new Sidebar(state);

  // Tab bar container
  const tabBarContainer = document.createElement("div");
  tabBarContainer.className = "tab-bar";
  tabBarContainer.style.gridArea = "tabbar";

  const tabBar = new TabBar(state);

  // Editor area
  const editorArea = document.createElement("div");
  editorArea.className = "editor-area";

  // Status bar
  const statusBar = new StatusBar(state);

  // Command palette
  const palette = new CommandPalette(state);

  // Assemble layout
  layout.appendChild(sidebar.root);
  layout.appendChild(tabBar.root);
  layout.appendChild(editorArea);
  layout.appendChild(statusBar.root);
  palette.mount(document.body);

  // Handle sidebar toggle
  state.on("sidebar-toggled", () => {
    layout.classList.toggle("sidebar-collapsed", !state.sidebarVisible);
  });

  // Track current editor
  let currentEditor: EditorView | null = null;

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
        () => state.markDirty(tab.path),
        editorKeymap()
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
    updateStatusBar(currentEditor, statusBar);
  });

  // Register global shortcuts
  registerGlobalShortcuts(state, palette);

  // Show a scratch editor on first load (before any vault is opened)
  const scratchEditor = createEditor(
    editorArea,
    SAMPLE_MD,
    undefined,
    editorKeymap()
  );
  currentEditor = scratchEditor;

  // Update status bar on editor changes
  editorArea.addEventListener("keyup", () => {
    if (currentEditor) updateStatusBar(currentEditor, statusBar);
  });
  editorArea.addEventListener("click", () => {
    if (currentEditor) updateStatusBar(currentEditor, statusBar);
  });
}

function updateStatusBar(view: EditorView, statusBar: StatusBar) {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const text = view.state.doc.toString();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  statusBar.update(line.number, pos - line.from + 1, words);
}

init();
