# Obsidian-Lite: Minimal Markdown Editor

## Context

Build a standalone desktop markdown editor with Obsidian's signature feature: real-time inline rendering where markdown syntax is rendered in-place and revealed when the cursor enters the element. Cross-platform (Mac + Windows), no plugins/linking/graph — just a clean, keyboard-driven markdown editor.

## Tech Stack

- **Shell**: Tauri v2 (Rust backend + native webview, ~5-10MB binary)
- **Editor engine**: CodeMirror 6 (same engine Obsidian uses)
- **Frontend**: TypeScript + Vanilla DOM (no framework)
- **Bundler**: Vite
- **File watching**: `notify` crate (Rust)

## Architecture

```
┌────────────┬──────────────────────────┐
│            │  Tab Bar                 │
│  Sidebar   ├──────────────────────────┤
│  (file     │  Editor (CodeMirror 6)   │
│   tree)    │                          │
│            ├──────────────────────────┤
│            │  Status Bar              │
└────────────┴──────────────────────────┘
```

## Project Structure

```
obsidian-lite/
├── src/
│   ├── main.ts                    # App bootstrap
│   ├── state.ts                   # Centralized state + EventEmitter
│   ├── tauri-api.ts               # Thin wrappers around invoke()
│   ├── keybindings.ts             # Global + editor keyboard shortcuts
│   ├── editor/
│   │   ├── setup.ts              # CM6 EditorView factory + extensions
│   │   ├── theme.ts              # Dark Obsidian-like CM6 theme
│   │   ├── markdown-render.ts    # Core ViewPlugin orchestrating all decorations
│   │   ├── cursor-utils.ts       # isCursorInRange, isCursorOnLine helpers
│   │   └── decorations/
│   │       ├── headings.ts       # Hide ##, apply font-size via line deco
│   │       ├── emphasis.ts       # Bold/italic: hide markers, apply style
│   │       ├── inline-code.ts    # Hide backticks, apply code style
│   │       ├── links.ts         # Hide [](url) syntax, style link text
│   │       ├── lists.ts         # Replace -/* with bullet widget
│   │       ├── blockquotes.ts   # Hide >, add left border line deco
│   │       └── horizontal-rule.ts # Replace --- with <hr> widget
│   ├── ui/
│   │   ├── layout.ts            # CSS Grid shell
│   │   ├── sidebar.ts           # File tree (recursive, collapsible)
│   │   ├── tab-bar.ts           # Tabs with dirty indicator + close
│   │   ├── command-palette.ts   # Cmd+P fuzzy file switcher
│   │   └── status-bar.ts        # Line/col, word count
│   └── styles/
│       ├── variables.css         # CSS custom properties (colors, fonts)
│       ├── layout.css
│       ├── sidebar.css
│       ├── tabs.css
│       ├── editor.css            # CM6 overrides + markdown rendered styles
│       ├── command-palette.css
│       └── index.css             # Imports all above
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/
        ├── main.rs
        ├── lib.rs                # Tauri setup, invoke_handler registration
        ├── commands/
        │   ├── mod.rs
        │   ├── fs.rs            # read_file, write_file, create_file, delete_file, rename_file
        │   └── vault.rs         # open_vault (folder picker), get_vault_tree (recursive listing)
        └── watcher.rs           # notify crate file watcher, emits "fs-change" events
```

## Core Design: Inline Rendering (The Hard Part)

A single CM6 `ViewPlugin` walks the Lezer markdown syntax tree within visible ranges and generates decorations:

1. **On each update** (doc change, selection change, viewport change): iterate syntax tree nodes
2. **For each node**: check if cursor overlaps the node's range
   - **Cursor present**: skip decorations (show raw markdown syntax)
   - **Cursor absent**: hide syntax markers with `Decoration.replace()`, apply styling with `Decoration.mark()` or `Decoration.line()`
3. **Collect all decorations**, sort by position, build into `DecorationSet`

Per-element strategies:
- **Headings**: `Decoration.line()` for font-size, `Decoration.replace()` to hide `# ` prefix
- **Bold/Italic**: `Decoration.replace()` on `EmphasisMark` nodes (`**`, `*`), `Decoration.mark()` for styling. Nested emphasis works naturally because tree iteration visits both outer and inner nodes independently.
- **Inline code**: `Decoration.replace()` on backtick `CodeMark` nodes, `Decoration.mark()` for monospace+background
- **Links** `[text](url)`: `Decoration.replace()` on `[`, `](url)` portions, `Decoration.mark()` to style link text with underline+color
- **Lists**: `Decoration.replace({ widget: BulletWidget })` to swap `-`/`*` for a bullet dot
- **Blockquotes**: `Decoration.line()` for left border, `Decoration.replace()` to hide `>` markers
- **Horizontal rules**: `Decoration.replace({ widget: HRWidget, block: true })` to render actual `<hr>`

Performance: only processes visible viewport lines (~50-80 lines). `EditorView.atomicRanges` makes cursor skip hidden markers cleanly.

## Tauri Backend

**Rust commands**:
- `open_vault()` → native folder picker dialog via `tauri-plugin-dialog`
- `get_vault_tree(path)` → recursive dir listing, filters `.md` files, sorts dirs-first
- `read_file(path)`, `write_file(path, content)`, `create_file(path)`, `delete_file(path)`, `rename_file(old, new)`

**File watcher**: `notify` + `notify-debouncer-mini` (500ms debounce) watches vault folder, emits `"fs-change"` events to frontend. Frontend refreshes sidebar tree and reloads non-dirty open files.

## State Management

Single `AppState` class with EventEmitter pattern. Holds: vault path, vault tree, open tabs (each with path, content, dirty flag, EditorView reference, scroll position), active file path, sidebar visibility. UI components subscribe to typed events (`vault-loaded`, `tabs-changed`, `active-tab-changed`, `fs-changed`).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+P` | Command palette (fuzzy file switcher) |
| `Cmd/Ctrl+S` | Save |
| `Cmd/Ctrl+W` | Close tab |
| `Cmd/Ctrl+N` | New file |
| `Cmd/Ctrl+O` | Open vault |
| `Cmd/Ctrl+Shift+E` | Toggle sidebar |
| `Cmd/Ctrl+Tab` / `+Shift+Tab` | Next/prev tab |
| `Cmd/Ctrl+1-9` | Jump to tab by index |
| `Cmd/Ctrl+B` | Toggle bold |
| `Cmd/Ctrl+I` | Toggle italic |
| `Cmd/Ctrl+K` | Insert link |

## Dependencies

**npm**: `@tauri-apps/api@^2`, `@tauri-apps/plugin-dialog@^2`, `@codemirror/view@^6`, `@codemirror/state@^6`, `@codemirror/lang-markdown@^6`, `@codemirror/language@^6`, `@codemirror/commands@^6`, `@codemirror/autocomplete@^6`, `@lezer/markdown@^1`, `@lezer/common@^1`
**dev**: `@tauri-apps/cli@^2`, `typescript@^5`, `vite@^6`

**Cargo**: `tauri@2`, `tauri-plugin-dialog@2`, `serde@1` (derive), `serde_json@1`, `tokio@1` (full), `notify@7`, `notify-debouncer-mini@0.5`

## Implementation Phases

### Phase 1: Scaffold + Basic Editor
- `npm create tauri-app@latest` with vanilla TS template
- CSS grid layout with placeholder containers
- CodeMirror 6 with markdown syntax highlighting (no inline rendering)
- Dark theme
- Verify `tauri dev` works

### Phase 2: File I/O + Vault Model
- Rust commands: open_vault, get_vault_tree, read/write/create/delete/rename file
- AppState class with EventEmitter
- Sidebar file tree (recursive, collapsible dirs)
- Tab bar (open/switch/close tabs, dirty indicator)
- Save with Cmd+S

### Phase 3: Inline Rendering (core of the project)
- cursor-utils.ts helpers
- MarkdownRenderPlugin ViewPlugin skeleton
- Implement each decoration builder: headings → bold/italic → inline code → links → lists → blockquotes → horizontal rules
- Wire up atomicRanges for cursor behavior
- Test nested formatting, boundary cursor positions

### Phase 4: Command Palette + Shortcuts
- Command palette overlay with fuzzy search
- All global shortcuts (save, close, new, vault, sidebar toggle, tab switching)
- Editor formatting shortcuts (bold, italic, code, link toggle)

### Phase 5: File Watching + Polish
- Rust file watcher with notify + debounce
- Sidebar auto-refresh on external changes
- Reload non-dirty open files on external change
- Status bar (line/col, word count)
- Dirty state: prompt on close, unsaved indicator

### Phase 6: Cross-Platform Polish
- Test on Windows (Ctrl vs Cmd, backslash paths)
- App icon + metadata
- Window title: vault name + active file
- Remember last vault on relaunch
- Build release binaries

## Verification

1. `npm run tauri dev` — app launches with editor
2. Open a folder with .md files — sidebar populates, files open in tabs
3. Edit markdown — inline rendering works (bold renders bold, headings resize, syntax hides when cursor moves away)
4. Navigate cursor through rendered elements — syntax reveals on entry, re-renders on exit
5. `Cmd+P` — palette opens, fuzzy search finds files, Enter opens them
6. `Cmd+S` — saves, dirty indicator clears
7. Modify a file externally — sidebar refreshes, open non-dirty file reloads
8. Build with `npm run tauri build` — produces installable binary
