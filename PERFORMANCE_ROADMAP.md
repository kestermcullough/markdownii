# MarkdownII Performance Roadmap

## Phase 1 (now)

Goal: improve responsiveness and startup without changing core UX.

### Completed
- [x] **Editor render hot path cleanup** (`src/editor/markdown-render.ts`)
  - Added a fast path to skip expensive syntax-context checks when cursor moves on plain-text lines.
  - Reduced unnecessary sorting work by tracking whether decoration ranges are already ordered.
  - Removed exception-driven decoration building in the tight loop.
- [x] **Inline decoration micro-optimizations**
  - `src/editor/decorations/highlight.ts`: skip regex parsing on lines without `==`.
  - `src/editor/decorations/strikethrough.ts`: skip regex parsing on lines without `~~`.
  - `src/editor/decorations/links.ts`: cache link decoration instances by URL to reduce per-frame allocations.
- [x] **Startup bundle split for non-core UI** (`src/main.ts`, `src/keybindings.ts`)
  - Command palette and font selector are now lazy-loaded on first use.
- [x] **Backend dependency slimming** (`src-tauri/Cargo.toml`)
  - Reduced `tokio` feature set from `full` to `fs`.

### Validation checklist
- [ ] Typing latency with large markdown files feels smooth.
- [ ] Cursor movement in rendered markdown remains correct.
- [ ] Cmd/Ctrl+P still opens command palette.
- [ ] Cmd/Ctrl+, still opens font selector.
- [ ] `npm run build` passes.

---

## Phase 2 (next)

Goal: reduce work per edit and avoid full rescans for file-system updates.

### Planned improvements
- [ ] **Incremental decoration updates**
  - Rebuild only affected viewport spans using `ViewUpdate.changes` instead of rebuilding all visible ranges.
- [ ] **Main-thread edit cost reduction**
  - Debounce full-document operations (word count + history snapshot conversions) so they don’t run on every keystroke.
- [ ] **Incremental vault index in Rust**
  - Keep an in-memory tree/index and apply watcher deltas instead of full `get_vault_tree()` recursion on each refresh.
- [ ] **Ignore heavy directories at source**
  - Skip `.git`, `node_modules`, `.obsidian`, `target`, etc., when indexing/watching.
- [ ] **Structured watcher events**
  - Emit typed file-change deltas (create/delete/rename/change) instead of raw path lists.

### Validation checklist
- [ ] Large vault refresh no longer causes visible sidebar stutter.
- [ ] External file edits update UI quickly without full tree churn.
- [ ] Typing in 1–5 MB files remains responsive.

---

## Phase 3 (native-speed push)

Goal: make the app feel "instant" at scale.

### Planned improvements
- [ ] **Background indexing + caching**
  - Persist vault index snapshots and warm-start on launch.
- [ ] **Large-file mode**
  - Disable expensive inline rendering features above a configurable size threshold.
- [ ] **Tab memory budget / LRU editor eviction**
  - Keep active/recent editors live; serialize dormant tabs to reduce memory pressure.
- [ ] **I/O batching + autosave strategy**
  - Coalesce frequent writes; atomic save with crash-safe temp-file swap.
- [ ] **Persistent edit history journal**
  - Snapshot + patch journal with checkpoint compaction for deep undo/redo across restarts.
- [ ] **Native profiling pass**
  - Measure Rust + frontend hot spots (CPU, allocs, fs latency) and tune with real traces.

### Validation checklist
- [ ] Cold-start to interactive is consistently fast.
- [ ] 100+ open tab scenarios remain stable.
- [ ] No significant frame drops during rapid edits.
- [ ] Release binaries stay compact and startup quickly.
