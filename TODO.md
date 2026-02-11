# TODO

## 1) Font Selector

### Goal
Let users pick editor/UI fonts and keep that preference across app restarts.

### MVP tasks
- [ ] Add settings model in `src/state.ts`:
  - `fontText`, `fontMono`, optional `fontSize`, `lineHeight`
- [ ] Add persistence (start simple):
  - store settings in `localStorage` under one key (e.g. `markdownii.settings.v1`)
- [ ] Apply settings live:
  - set CSS vars on `document.documentElement` (`--font-text`, `--font-mono`, etc.)
- [ ] Add UI entry point:
  - command palette action like `Preferences: Fonts`
  - minimal modal/select UI with 6-10 curated font stacks
- [ ] Include `Reset to default` button

### Nice-to-have
- [ ] Per-vault font override (fallback to global default)
- [ ] Instant preview while dropdown is open
- [ ] Keyboard shortcuts for font size up/down/reset

### Suggested starter font presets
- [ ] System UI: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- [ ] Serif: `Charter, "Iowan Old Style", "Times New Roman", serif`
- [ ] Humanist Sans: `"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif`
- [ ] Mono A: `"SF Mono", "Fira Code", Menlo, monospace`
- [ ] Mono B: `"JetBrains Mono", "Cascadia Code", Consolas, monospace`


## 2) Background Diffing + Exhaustive Undo/Redo

### Goal
Keep a durable, lightweight edit history so undo/redo works deeply (including after restart).

### Recommended approach (lightweight + robust)
- [ ] Keep CodeMirror in-memory history for immediate UX (already there via `history()`).
- [ ] Add persistent history journal per file:
  - baseline snapshot + append-only patch records
  - patch record fields: `ts`, `filePath`, `baseRev`, `nextRev`, `patch`
- [ ] Compute patches in background on debounce (e.g. 750-1500ms idle):
  - diff previous text vs current text
  - skip record if no change
- [ ] Add periodic checkpoints:
  - every N patches (ex: 100), write full snapshot and reset patch chain
  - keeps replay fast
- [ ] On file open:
  - restore latest snapshot + apply remaining patches
- [ ] On undo/redo:
  - prefer in-memory CM undo while session is alive
  - if at boundary, pull from persistent journal

### Storage design (simple)
- [ ] Store under app data dir (`src-tauri` command side), not vault:
  - `history/<sha256(filePath)>/snapshot-<rev>.txt`
  - `history/<sha256(filePath)>/patches.jsonl`
- [ ] Add retention cap:
  - max patches per file
  - max disk budget for all history

### Branching behavior decision
- [ ] Decide redo policy after undo+new edit:
  - **Simple editor behavior**: clear redo branch (easy)
  - **Exhaustive behavior**: keep redo branches as DAG (more work, but truly exhaustive)

### Suggested implementation phases
- [ ] Phase 1: in-session deep undo tuning only (fast ship)
- [ ] Phase 2: persistent snapshot + patch append log
- [ ] Phase 3: checkpointing + retention + crash recovery tests
- [ ] Phase 4: optional branch-preserving redo DAG

### Validation checklist
- [ ] Undo/redo through 10k+ edits without UI lag
- [ ] App restart keeps history for unsaved and saved files
- [ ] Large file (1-5 MB) remains responsive during background diffing
- [ ] History corruption fallback: recover to last valid snapshot safely


## 3) Fast alternative (if you want to ship sooner)

- [ ] Skip custom patch format initially.
- [ ] Persist periodic full snapshots only (every X seconds or on blur/save).
- [ ] Keep undo/redo exhaustive only for current session first.
- [ ] Add patch-based persistence in v2 once UX is stable.


## 4) File name/path display cleanup

- [ ] Show just `filename.md` in UI title labels where full paths currently appear.
- [ ] Keep full path only where needed as secondary context (tooltip or muted sublabel).
- [ ] Normalize path separators for Windows/Linux so relative path rendering is consistent.

