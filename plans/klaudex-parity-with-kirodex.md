# Plan: Klaudex Parity with Kirodex (v0.40.4)

> Generated: 2026-05-06
> Branch: `feat/kirodex-parity`
> Mode: EXPANSION

## Overview

Bring Klaudex to full feature and behavioral parity with Kirodex v0.40.4. Klaudex should work exactly like Kirodex but pointed at Claude agents (via Claude CLI) instead of Kiro agents (via the agent-client-protocol SDK). Klaudex-ahead features (token usage tracking, ACP subagent display, `/undo` + `task_rollback`, `UserInputCard`, per-task model switching, `claude_login` flow) are preserved and integrate with the ported Kirodex UX. Includes a first-release pipeline so Klaudex can ship.

## Scope Challenge

**Considered:** Splitting into phased plans (P0 → P1 → polish) versus one comprehensive DAG. User selected the comprehensive option ("plan the entire thing").

**User decisions captured in Phase 0:**
- Watcher scope: watch BOTH `~/.claude/` (global) and project-local `.claude/` (project wins on merge), matching how Claude CLI itself resolves config.
- Release pipeline: include in this plan (Klaudex has never shipped; needs CHANGELOG, downloads.json, release config).
- Divergence policy: PRESERVE Klaudex-ahead features (token tracking, /undo, UserInputCard, AcpSubagentDisplay, model switching, claude_login). Do not regress these when porting Kirodex behavior.

**Newly discovered during exploration (not in original audit):**
- Klaudex is missing the entire **split-chat layout** (`PanelContext`, `SplitChatLayout`, `SplitDivider`, `SplitPanelHeader`, `SplitThreadPicker`).
- Klaudex is missing `UpdateAvailableDialog.tsx` and `WhatsNewDialog.tsx` entirely.
- ACP `client.rs:178-214` has 5 hardcoded `kiro.dev/*` ext_notification namespaces — needs verification against Claude CLI emit values (could be left as-is for compat, or renamed).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLAUDEX APP                                │
│                                                                         │
│  ┌──────────────────────── RENDERER (React) ────────────────────────┐  │
│  │                                                                  │  │
│  │  ┌─── App.tsx ─────────────────────────────────────────────┐    │  │
│  │  │  views: chat | code | diff | debug | dashboard          │    │  │
│  │  │  + analytics view  ◄── TASK-037                         │    │  │
│  │  └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                  │  │
│  │  Stores                Components                  Hooks         │  │
│  │  ──────                ──────────                  ─────         │  │
│  │  taskStore             chat/                       useZoomLimit  │  │
│  │  settingsStore           SplitChatLayout ◄─T-042   ◄── T-021     │  │
│  │  diffStore               PanelContext    ◄─T-040   useModifier   │  │
│  │  debugStore              CloneRepoDialog ◄─T-038   Keys ◄─T-022  │  │
│  │  updateStore           sidebar/                    useSession    │  │
│  │  claudeConfigStore       SidebarFooter+spike◄T-025 Tracker◄T-023 │  │
│  │    ◄── extends w/ watch  ProjectItem                             │  │
│  │       ◄── TASK-019     settings/                                 │  │
│  │  analyticsStore ◄T-018   memory-section  ◄─ T-024                │  │
│  │  + tokenUsage (kept)   analytics/        ◄─ TASK-026..036        │  │
│  │                          12 charts + dashboard                   │  │
│  │                        UpdateAvailableDialog ◄─ TASK-044         │  │
│  │                        WhatsNewDialog ◄────── TASK-045           │  │
│  │                                                                  │  │
│  │  lib/ipc.ts ◄─── TASK-013/014/015/016/017                        │  │
│  │  lib/thread-memory.ts ◄────────────────── TASK-020               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  │ Tauri invoke / listen                │
│  ┌──────────────────────── BACKEND (Rust) ──────────────────────────┐  │
│  │                                                                  │  │
│  │  lib.rs (commands registered) ◄────────────── TASK-012            │  │
│  │                                                                  │  │
│  │  commands/                                                       │  │
│  │    acp/        ─ unchanged (kept Klaudex)                        │  │
│  │       client.rs ◄──── TASK-002 verify kiro.dev/* namespaces      │  │
│  │    analytics.rs    ◄── TASK-004 (NEW, port from kirodex)         │  │
│  │    claude_watcher.rs ◄ TASK-005 (NEW, port from kiro_watcher.rs) │  │
│  │    claude_config.rs ◄  TASK-006 (extend to full feature parity)  │  │
│  │    git.rs          ◄── TASK-007 (+git_clone, +git_init)          │  │
│  │    settings.rs     ◄── TASK-008 (+recent projects)               │  │
│  │                    ◄── TASK-009 (+dock icon, +relaunch)          │  │
│  │    fs_ops.rs       ◄── TASK-010 (+5 commands)                    │  │
│  │    pty.rs          ◄── TASK-011 (+pty_count, +scrollback)        │  │
│  │                                                                  │  │
│  │  Persistence: confy (settings) + redb (token usage)              │  │
│  │             + sqlite (analytics, NEW via TASK-004)               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

Layered dependency flow:
  Foundation Rust (T-004..011) → IPC wrappers (T-013..017) → Stores (T-018..019)
                                                          → Hooks (T-021..023)
                                                          → Components (T-024..)
                                                          → Wiring (T-037, T-039, T-043)
```

## Existing Code Leverage

| Sub-problem | Existing Code (Klaudex) | Action |
|------------|--------------------------|--------|
| Token usage tracking | `src-tauri/src/commands/acp/token_store.rs` (redb) + `tokenUsageStore.ts` | Reuse — integrate with TokensChart in TASK-034 |
| ACP subagent display | `src/renderer/components/chat/AcpSubagentDisplay.tsx` | Keep — no changes |
| /undo and rollback | `task_rollback` command + `/undo` slash handler | Keep — no changes |
| UserInputCard | `src/renderer/components/chat/UserInputCard.tsx` | Keep — no changes |
| Per-task model switching | `task_set_model` command | Keep — no changes |
| claude_login flow | `claude_login` command + `claudeWhoami` IPC (with new fields) | Keep — no changes |
| StatsPanel | `src/renderer/components/chat/StatsPanel.tsx` | Keep alongside analytics dashboard (lighter view for in-chat) |
| Claude config parsing | `src-tauri/src/commands/claude_config.rs` | Extend (TASK-006) to match kiro_config.rs's full surface |
| Claude config store | `src/renderer/stores/claudeConfigStore.ts` | Extend (TASK-019) with watch subscriptions; do not delete |
| Git operations base | `src-tauri/src/commands/git.rs` (21 commands) | Extend (TASK-007) with git_clone and git_init |
| Settings persistence | `src-tauri/src/commands/settings.rs` (confy) | Extend (TASK-008/009) with recent projects + dock icon |
| PTY lifecycle | `src-tauri/src/commands/pty.rs` | Extend (TASK-011) with pty_count + scrollback |
| Sidebar footer | `src/renderer/components/sidebar/SidebarFooter.tsx` | Extend (TASK-025) with memory spike indicator |
| AppHeader / header-toolbar | `src/renderer/components/header-toolbar.tsx` | Reuse as-is; TASK-046 ports the test |
| Onboarding suite | `src/renderer/components/Onboarding*.tsx` (5 files) | Reuse — wire CloneRepoDialog (TASK-039) |
| New chat layout | (none — split layout missing) | Build (TASK-040..043) |
| Update / What's New UX | (none — both dialogs missing) | Build (TASK-044, TASK-045) |
| Analytics | (none) | Build (TASK-004, TASK-013, TASK-018, TASK-026..037) |
| File watcher | (none) | Build (TASK-005, TASK-017, TASK-019) |
| Memory monitoring | (none) | Build (TASK-020, TASK-024, TASK-025) |

## Tasks

### TASK-001: Rename `kiro` editor key to `claude` in OpenInEditorGroup

Replace the property key `kiro` with `claude` in `src/renderer/components/OpenInEditorGroup.tsx:49`. Verify all call sites that index the editor map (search for `editorMap.kiro`, `editors.kiro`, etc.) and update consistently. The label text remains "Claude" — only the object key changes.

**Type:** chore
**Effort:** S

**Acceptance Criteria:**
- [ ] `OpenInEditorGroup.tsx:49` uses `claude:` instead of `kiro:`
- [ ] No remaining references to the old key in the file
- [ ] `bun run check:ts` passes (no type errors from renamed key consumers)

**Agent:** react-vite-tailwind-engineer

**Priority:** P0

---

### TASK-002: Verify ACP `kiro.dev/*` namespaces against Claude CLI emit

Investigate whether the Claude CLI subprocess actually emits `kiro.dev/mcp/server_initialized`, `kiro.dev/mcp/oauth_request`, `kiro.dev/commands/available`, `kiro.dev/compaction/status`, and `kiro.dev/subagent/list_update` (lines 178–214 in `src-tauri/src/commands/acp/client.rs`), or whether Claude uses a different namespace prefix. Run a sample task end-to-end with debug logging on, capture the raw method names emitted, and either keep the namespaces (compat) or rename to `claude.dev/*`. Document the decision in the file as a comment.

**Type:** bug
**Effort:** M

**Acceptance Criteria:**
- [ ] Debug log captures real ext_notification method names from a live Claude CLI run
- [ ] Decision (keep `kiro.dev/*` or rename) is recorded in `client.rs` as a code comment
- [ ] If renamed: all 5 string matches updated and frontend listeners still receive the same events
- [ ] Failure case: if Claude CLI never emits any of these namespaces, that's documented and the corresponding handler branches stay (gated) for future use

**Agent:** general-purpose

**Priority:** P0

---

### TASK-003: Verify mode IDs and `<kiro_summary>` regex against Claude CLI

Mode IDs `kiro_default`, `kiro_planner`, `kiro_guide` are hardcoded in `src/renderer/components/chat/AcpSubagentDisplay.tsx:16-18`, and the regex `/<kiro_summary>[\s\S]*?<\/kiro_summary>/g` is used in `src/renderer/components/chat/TaskCompletionCard.tsx:16`. Verify Claude CLI emits these exact strings via a live capture; if Claude emits `claude_default`/`claude_planner` or `<claude_summary>`, update both files and the `useSlashAction.ts` `/plan` mode-toggle hardcodes to match. Cross-reference with whatever modes `list_models` / `set_mode` actually uses.

**Type:** bug
**Effort:** M

**Acceptance Criteria:**
- [ ] Live capture of mode IDs from a Claude CLI session is documented (debug log or written note)
- [ ] `AcpSubagentDisplay.tsx` mode-ID map matches what Claude CLI actually emits
- [ ] `TaskCompletionCard.tsx` summary tag matches what Claude CLI actually emits
- [ ] `useSlashAction.ts` `/plan` toggle uses the verified mode IDs
- [ ] Failure case: if Claude CLI emits an unexpected variant, code falls back gracefully (no UI crash, plan summary just renders inline text instead of being stripped)

**Agent:** general-purpose

**Priority:** P0

---

### TASK-004: Port `analytics.rs` Tauri module with SQLite event store

Port `kirodex/src-tauri/src/commands/analytics.rs` (258 LOC) to `Klaudex/src-tauri/src/commands/analytics.rs`. Implements `analytics_save` (batch insert events), `analytics_load` (range query by date), `analytics_clear` (truncate db), `analytics_db_size` (return byte size). Use SQLite via `rusqlite` or whatever Kirodex used (verify Cargo.toml). Schema must match Kirodex so analyticsStore aggregations work unchanged. Database file lives at confy/dirs-resolved app data dir, e.g. `~/Library/Application Support/com.klaudex.app/analytics.sqlite`.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] All four commands compile and are gated by `#[tauri::command]`
- [ ] Schema matches Kirodex (same columns, same types) so frontend aggregator can reuse logic untouched
- [ ] `analytics_save` is idempotent on duplicate event IDs (no duplicate rows)
- [ ] `bun run check:rust` passes
- [ ] Failure case: if SQLite open fails (e.g. corrupt db), commands return `AppError::Analytics(..)` instead of panicking, and `analytics_db_size` returns `Ok(0)` rather than crash

**Agent:** general-purpose

**Priority:** P0

---

### TASK-005: Port `kiro_watcher.rs` to `claude_watcher.rs` with dual-scope watching

Port `kirodex/src-tauri/src/commands/kiro_watcher.rs` (149 LOC) to `Klaudex/src-tauri/src/commands/claude_watcher.rs`. Spawn a debounced filesystem watcher via `notify` crate. Watch BOTH `~/.claude/` (resolved via `dirs::home_dir`) and the project-local `.claude/` dir for the active workspace. Emit a single `claude-config-changed` Tauri event with payload `{ scope: "global" | "project", path: string }` so the frontend can refresh selectively. Expose `watch_claude_path(path)`, `unwatch_claude_path(path)` Tauri commands. Project wins over global on merged config (Claude CLI behavior).

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] Watcher spawns one debouncer per registered path; `unwatch_claude_path` cleans up on drop
- [ ] Touching `~/.claude/agents/foo.md` emits `claude-config-changed` with `scope: "global"`
- [ ] Touching `<workspace>/.claude/agents/bar.md` emits `claude-config-changed` with `scope: "project"`
- [ ] Failure case: if `~/.claude` doesn't exist, watcher still starts (creates lazily on first event from project scope) and does not panic
- [ ] No duplicate events fired within the debounce window (300ms)

**Agent:** general-purpose

**Priority:** P0

---

### TASK-006: Extend `claude_config.rs` to full Kirodex `kiro_config.rs` parity

Klaudex's `claude_config.rs` is thinner than `kirodex/src-tauri/src/commands/kiro_config.rs` (428 LOC). Extend Klaudex's module to parse: agents (markdown frontmatter via serde_yaml), skills, MCP server entries, steering rules, and memory files. Return a single `ClaudeConfig` struct containing all categories, mirroring the `KiroConfig` shape. Resolve from both `~/.claude/` and project-local `.claude/` and merge with project precedence. Expose `get_claude_config(workspace?: string)` Tauri command.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] `ClaudeConfig` struct shape matches `KiroConfig` field-for-field (rename Kiro → Claude in type names only)
- [ ] Parsing handles missing dirs gracefully (returns empty arrays, no error)
- [ ] Frontmatter parse errors on a single file don't fail the whole config — that file is skipped with a logged warning
- [ ] Project entries override global entries with the same name
- [ ] `bun run test:rust` includes a new test for merge precedence

**Agent:** general-purpose

**Priority:** P0

---

### TASK-007: Add `git_clone` and `git_init` Tauri commands

Add two commands to `src-tauri/src/commands/git.rs`: `git_clone(url: string, target_dir: string, ssh_key_path?: string)` using `git2::Repository::clone` with credential callback for SSH/HTTPS, and `git_init(path: string, initial_branch?: string)` using `git2::Repository::init`. Emit progress events during clone for the UI (event name `git-clone-progress` with `{ received_objects, total_objects, indexed_deltas }`). Validate inputs: target_dir must be empty or non-existent for clone; URL must be a valid git URL.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `git_clone` succeeds for HTTPS public repos without credentials
- [ ] `git_clone` succeeds for SSH repos using SSH agent or `~/.ssh/id_ed25519`
- [ ] `git_init` creates a repo with the requested initial branch name (defaults to `main`)
- [ ] Failure case: cloning into a non-empty directory returns `AppError::Git(..)` with a clear message instead of corrupting the dir
- [ ] Failure case: invalid URL is rejected before any network call

**Agent:** general-purpose

**Priority:** P0

---

### TASK-008: Add recent projects commands to `settings.rs`

Add Tauri commands `get_recent_projects()`, `add_recent_project(path: string)`, `clear_recent_projects()`, `rebuild_recent_menu()` to `src-tauri/src/commands/settings.rs`. Persist a capped list (max 10) of recently-opened workspace paths via confy. `add_recent_project` deduplicates and moves the entry to the front. `rebuild_recent_menu` triggers a Tauri menu rebuild so File → Open Recent reflects the current list (use `app.menu().items()` API).

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] List capped at 10 entries, oldest evicted on overflow
- [ ] Adding an existing path re-orders to front (no duplicates)
- [ ] `rebuild_recent_menu` updates the macOS File menu without restart
- [ ] Failure case: `add_recent_project` with a non-existent path still records it (we don't validate disk; the menu hides missing entries on click via TASK-053)

**Agent:** general-purpose

**Priority:** P0

---

### TASK-009: Add macOS dock icon + relaunch flag commands

Add Tauri commands `set_dock_icon(image_data_b64: string)`, `reset_dock_icon()`, `set_relaunch_flag()` to `src-tauri/src/commands/settings.rs`. Use Cocoa `NSApp.setApplicationIconImage:` via objc on macOS only (no-op on other platforms). `set_relaunch_flag` writes a marker file so the next startup knows to skip the splash and reload the previous session.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Setting a custom dock icon updates immediately without app restart on macOS
- [ ] `reset_dock_icon` restores the bundled `.icns` icon
- [ ] `set_relaunch_flag` writes to `~/Library/Application Support/com.klaudex.app/relaunch` (or platform equivalent)
- [ ] Failure case: invalid base64 image data returns `AppError::InvalidInput` instead of panicking the objc bridge

**Agent:** general-purpose

**Priority:** P0

---

### TASK-010: Add 5 missing commands to `fs_ops.rs`

Add to `src-tauri/src/commands/fs_ops.rs`: `pick_image()` (dialog filter for png/jpg/webp), `detect_project_icon(path: string)` (probe for `.icon.png`, `icon.png`, `logo.png` in workspace root), `list_small_images(dir: string)` (return all png/jpg under `dir` ≤ 256KB), `is_directory(path: string)` (returns bool), `detect_editors_background()` (runs `detect_editors` work in a background thread, emits `editors-updated` event when done so the UI doesn't block). Mirror Kirodex signatures exactly.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] All 5 commands match Kirodex signatures (verify with `grep` in `kirodex/src-tauri/src/commands/fs_ops.rs`)
- [ ] `detect_editors_background` doesn't block the main runtime — uses `tokio::spawn_blocking`
- [ ] `list_small_images` enforces the 256KB cap; larger files are silently skipped
- [ ] Failure case: `is_directory` on a non-existent path returns `Ok(false)`, not an error

**Agent:** general-purpose

**Priority:** P0

---

### TASK-011: Add `pty_count` and terminal scrollback config

Extend `src-tauri/src/commands/pty.rs`: add `pty_count()` (returns active session count from `PtyState`), and parameterize `pty_create` to accept `scrollback_lines: u32` (default 5000, range 200..=20000) which the renderer respects when constructing xterm. Persist user preference via settings (`AppSettings.terminal_scrollback`, `AppSettings.terminal_idle_close_mins`).

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `pty_count` returns the right number after creating/killing sessions
- [ ] `pty_create` honors scrollback parameter when constructing the PTY ring buffer
- [ ] Settings struct gains `terminal_scrollback: u32` and `terminal_idle_close_mins: u32` with sensible defaults
- [ ] Failure case: scrollback < 200 or > 20000 is clamped silently to nearest bound

**Agent:** general-purpose

**Priority:** P0

---

### TASK-012: Register all new Tauri commands in `lib.rs`

Update `src-tauri/src/lib.rs` `invoke_handler!` macro to register every command added by TASK-004 through TASK-011. Add the analytics SQLite state and ClaudeWatcher state to `app.manage()`. Wire the `claude-config-changed` event to be re-emitted to the webview. Update `shutdown_app()` to drop the watcher and close the analytics db cleanly.

**Type:** chore
**Effort:** M

**Acceptance Criteria:**
- [ ] All new commands appear in `invoke_handler` and `bun run check:rust` passes
- [ ] Watcher state and analytics state survive a full app launch and graceful shutdown without leaks
- [ ] Failure case: if analytics db init fails on startup, the app logs a warning and continues (analytics features degrade silently)

**Depends on:** TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011

**Agent:** general-purpose

**Priority:** P0

---

### TASK-013: Add analytics IPC wrappers to `lib/ipc.ts`

Add to `src/renderer/lib/ipc.ts`: `analyticsSave(events)`, `analyticsLoad(range)`, `analyticsClear()`, `analyticsDbSize()`. Mirror the `tracedInvoke` instrumentation pattern used by other commands but add `analytics*` methods to the quiet list (high-volume save calls shouldn't flood the debug panel).

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Four methods exist on the `ipc` object with TypeScript types matching Rust signatures
- [ ] All four are in the quiet log list to avoid debug spam
- [ ] Failure case: a thrown Tauri error is caught and re-thrown with a wrapped message including the command name

**Depends on:** TASK-004

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-014: Add git clone/init IPC wrappers + progress listener

Add `gitClone(url, targetDir, sshKeyPath?)` and `gitInit(path, initialBranch?)` to `src/renderer/lib/ipc.ts`. Wire `onGitCloneProgress(cb)` listener for the `git-clone-progress` event. Throttle progress callbacks to ~10/sec via rAF or a manual gate so the UI doesn't drown.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `gitClone` returns once the clone completes, error on failure
- [ ] Progress listener fires while clone is in flight with a monotonically increasing `received_objects`
- [ ] Failure case: invalid URL bubbles a clear error message that the dialog (TASK-038) can display

**Depends on:** TASK-007

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-015: Add recent projects + dock icon IPC wrappers

Add to `src/renderer/lib/ipc.ts`: `getRecentProjects()`, `addRecentProject(path)`, `clearRecentProjects()`, `rebuildRecentMenu()`, `setDockIcon(b64)`, `resetDockIcon()`, `setRelaunchFlag()`.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] All seven methods present with types
- [ ] `setDockIcon` accepts a `string` (base64) and rejects non-string input at the type level
- [ ] Failure case: `getRecentProjects` returns `[]` (not throws) when settings file is missing

**Depends on:** TASK-008, TASK-009

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-016: Add fs_ops + pty IPC wrappers

Add to `src/renderer/lib/ipc.ts`: `pickImage()`, `detectProjectIcon(path)`, `listSmallImages(dir)`, `isDirectory(path)`, `detectEditorsBackground()`, `ptyCount()`. Add `onEditorsUpdated(cb)` listener for the background detection event.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Six command wrappers + one event listener present with types
- [ ] `detectEditorsBackground` is fire-and-forget (returns immediately); results arrive via `onEditorsUpdated`
- [ ] Failure case: if no images match `listSmallImages` filter, returns `[]`

**Depends on:** TASK-010, TASK-011

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-017: Wire `onClaudeConfigChanged` IPC + watch/unwatch wrappers

Add to `src/renderer/lib/ipc.ts`: `watchClaudePath(path)`, `unwatchClaudePath(path)`, `onClaudeConfigChanged(cb)`. The listener should auto-cleanup on unmount (return an unlisten fn). Payload type: `{ scope: 'global' | 'project'; path: string }`.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `onClaudeConfigChanged` callback fires when watcher (TASK-005) emits its event
- [ ] Returned unlisten fn correctly removes the listener
- [ ] Failure case: re-watching an already-watched path is a no-op (no duplicate events)

**Depends on:** TASK-005

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-018: Port `analyticsStore.ts`

Port `kirodex/src/renderer/stores/analyticsStore.ts` (57 LOC) to Klaudex. Zustand store managing in-memory event buffer, flush-to-disk via `analyticsSave`, hydrate-from-disk via `analyticsLoad`, aggregations for dashboard charts. Match Kirodex schema field-for-field so chart components (TASK-026..035) port unchanged.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Store shape matches Kirodex `analyticsStore.ts` exactly
- [ ] Buffered events flush in batches of 50 or every 30s (whichever first)
- [ ] Hydration loads last 30 days by default
- [ ] Failure case: if `analyticsLoad` throws, store starts empty and logs the error rather than crashing the app

**Depends on:** TASK-013

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-019: Extend `claudeConfigStore` with watcher subscription

Update `src/renderer/stores/claudeConfigStore.ts` to subscribe to `onClaudeConfigChanged` on init and call its existing `loadConfig()` action when the event fires. Add `watchedPaths: Set<string>` to state. On store init, call `watchClaudePath(homeClaude)` and `watchClaudePath(activeWorkspace + '/.claude')` when a workspace is selected. On workspace switch, unwatch the previous project path.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Store auto-refreshes when a `.claude/agents/foo.md` file is touched on disk
- [ ] Switching workspaces unwatches the old project `.claude` and watches the new one
- [ ] `~/.claude` is always watched once per app lifetime
- [ ] Failure case: HMR / store re-init does not leak duplicate watchers

**Depends on:** TASK-017

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-020: Port `lib/thread-memory.ts`

Port `kirodex/src/renderer/lib/thread-memory.ts` (268 LOC) verbatim to `Klaudex/src/renderer/lib/thread-memory.ts`. Estimates per-thread memory (messages, tool calls, attachments, streaming buffers) and exposes reclaim helpers. Update any imports that referenced `kiroStore` to use `claudeConfigStore` if relevant (likely just the import line, not the API).

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] File compiles and `bun run check:ts` passes
- [ ] `estimateThreadMemory(taskId)` returns a number ≥ 0 for any valid task
- [ ] `reclaimThread(taskId)` clears messages but keeps the task record (matches Kirodex behavior)
- [ ] Failure case: estimating an unknown task ID returns 0, not undefined or throw

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-021: Port `useZoomLimit` hook

Port `kirodex/src/renderer/hooks/useZoomLimit.ts` to Klaudex. Clamps webview zoom level between 50% and 100% (Cmd+/-/0 handlers). Listens for the Tauri webview zoom event and rejects values outside the range.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Cmd+= zooms in to a max of 100%
- [ ] Cmd+- zooms out to a min of 50%
- [ ] Cmd+0 resets to 100%
- [ ] Failure case: zoom level read on app startup that's already outside range gets re-clamped immediately

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-022: Port `useModifierKeys` hook

Port `kirodex/src/renderer/hooks/useModifierKeys.ts` to Klaudex. Tracks Shift/Cmd/Ctrl/Alt state across the window via global keydown/keyup listeners; exposes `{ shift, cmd, ctrl, alt }` booleans. Used by drag-and-drop UIs and command-palette-style shortcuts.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Hook returns booleans that flip on key down/up within ~16ms
- [ ] Window blur clears all modifier state (prevents stuck-key bug)
- [ ] Failure case: rapid alt+tab during a held modifier doesn't leave the flag stuck

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-023: Port `useSessionTracker` hook

Port `kirodex/src/renderer/hooks/useSessionTracker.ts` to Klaudex. Emits analytics events for: session_start (on mount), session_end (on unmount/window-close), task_created, message_sent, slash_command_used, mode_switched. Each event includes workspace path, task id (if any), and timestamp. Buffers via `analyticsStore.addEvent`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] All 6 event types fire at the right moments
- [ ] Event payload schema matches Kirodex exactly so dashboard charts read it correctly
- [ ] Hook is mounted at app root only (not per-component) — verify in App.tsx
- [ ] Failure case: if analyticsStore is uninitialized, events are silently dropped (no crash)

**Depends on:** TASK-018

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-024: Port Settings → Memory section

Port `kirodex/src/renderer/components/settings/memory-section.tsx` (558 LOC) to Klaudex's `src/renderer/components/settings/memory-section.tsx`. Includes: total app memory readout, per-thread memory breakdown table, "Reclaim" buttons per thread, "Purge soft-deleted threads" button, "Clear debug logs" button, terminal scrollback slider (200..20000), terminal idle-close minutes input. Wire to `lib/thread-memory.ts`, `taskStore`, `debugStore`, and settings save.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] Section renders inside `SettingsPanel` and shows memory stats updated live
- [ ] Reclaiming a thread reduces its memory estimate and triggers re-render
- [ ] Terminal scrollback slider value persists across app restarts
- [ ] Failure case: if `pty_count` returns 0 (no active terminals), the terminal section shows a placeholder instead of crashing

**Depends on:** TASK-020, TASK-016, TASK-011

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-025: Add memory spike indicator to `SidebarFooter`

Extend Klaudex's existing `src/renderer/components/sidebar/SidebarFooter.tsx` with a "Memory Spike" indicator (red dot + button) that appears when total estimated thread memory exceeds a threshold (default 500MB). Clicking it opens Settings → Memory section directly. Update `SidebarFooter.test.tsx` to cover the new indicator.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Indicator appears only when `estimateAllThreadsMemory()` exceeds threshold
- [ ] Click navigates to Settings → Memory and scrolls to the per-thread table
- [ ] Threshold is configurable via settings (defaults to 500MB)
- [ ] Test covers: appears above threshold, hidden below, click navigates correctly

**Depends on:** TASK-020, TASK-024

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-026: Port shared chart primitives `ChartCard` + `HorizontalBarSection`

Port `kirodex/src/renderer/components/analytics/ChartCard.tsx` and `HorizontalBarSection.tsx` to Klaudex. Establish the chart container styling that all 9 chart components (TASK-027..035) reuse. Create the `analytics/` directory under `src/renderer/components/`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Both components compile and export
- [ ] `ChartCard` accepts `title`, `children`, optional `actions` slot
- [ ] `HorizontalBarSection` renders a labeled bar with percentage, gracefully handles 0/0 (renders empty state)
- [ ] Failure case: passing empty data array renders an empty state, not a NaN/Infinity bar

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-027: Port `CodingHoursChart`

Port `kirodex/src/renderer/components/analytics/CodingHoursChart.tsx` to Klaudex. Hour-of-day heatmap of activity events from `analyticsStore`.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Heatmap renders 24 cells (0–23 hours)
- [ ] Color intensity scales to max value across the dataset
- [ ] Failure case: empty dataset renders empty grid, no errors

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-028: Port `DiffStatsChart`

Port `kirodex/src/renderer/components/analytics/DiffStatsChart.tsx` to Klaudex. Line chart of additions/deletions over time.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Two lines (additions, deletions) render correctly with a date X-axis
- [ ] Tooltip on hover shows exact daily counts
- [ ] Failure case: single data point still renders (no broken line)

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-029: Port `MessagesChart`

Port `kirodex/src/renderer/components/analytics/MessagesChart.tsx` to Klaudex. Trend of message count per day.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Bar/line chart of daily message totals
- [ ] Failure case: weekend gap days render as 0 (not skipped/interpolated)

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-030: Port `ModelPopularityChart`

Port `kirodex/src/renderer/components/analytics/ModelPopularityChart.tsx` to Klaudex. Distribution of model usage. Cross-reference with `availableModels` so unknown model IDs render with a fallback label.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Pie or horizontal bar showing per-model message counts
- [ ] Models not in `availableModels` render with raw ID + "(legacy)" suffix
- [ ] Failure case: zero usage renders empty state

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-031: Port `ModeUsageChart`

Port `kirodex/src/renderer/components/analytics/ModeUsageChart.tsx` to Klaudex. Stacked bar of plan vs default vs guide mode time/messages.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Stacked bar with plan/default/guide segments
- [ ] Mode IDs verified by TASK-003 are referenced (no hardcoded `kiro_*` strings)
- [ ] Failure case: unknown mode IDs are bucketed under "other"

**Depends on:** TASK-018, TASK-026, TASK-003

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-032: Port `ProjectStatsChart`

Port `kirodex/src/renderer/components/analytics/ProjectStatsChart.tsx` to Klaudex. Activity per project (messages, tool calls, time-spent).

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Horizontal bar listing projects sorted by total activity
- [ ] Project paths truncated with tooltip on hover
- [ ] Failure case: deleted projects (no longer in `projects`) still appear with their last-known name + "(deleted)" tag

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-033: Port `SlashCommandChart`

Port `kirodex/src/renderer/components/analytics/SlashCommandChart.tsx` to Klaudex. Heatmap or bar of slash command usage frequency.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Renders a chart of `/clear`, `/model`, `/plan`, `/undo`, etc. counts
- [ ] Includes Klaudex-only commands (`/undo`, `/stats`) — verify they appear when used
- [ ] Failure case: no slash command events renders empty state

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-034: Port `TokensChart` and integrate Klaudex token tracking

Port `kirodex/src/renderer/components/analytics/TokensChart.tsx` to Klaudex but read from BOTH `analyticsStore` (for legacy event-based counts) and Klaudex's existing `tokenUsageStore` (redb-backed accurate counts). Prefer tokenUsageStore values when present, fall back to analytics events. Stacked bar: input / output / cache_read / cache_creation tokens. Cost estimate shown on hover.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Chart prefers `tokenUsageStore` data when available, falls back to analytics events
- [ ] Cost estimate uses Klaudex's existing pricing table (from tokenUsageStore)
- [ ] Empty case renders gracefully
- [ ] Failure case: if `tokenUsageStore` is uninitialized (race on startup), falls back without throwing

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-035: Port `ToolCallChart`

Port `kirodex/src/renderer/components/analytics/ToolCallChart.tsx` to Klaudex. Bar chart of tool call counts grouped by tool name.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Bars sorted descending by count
- [ ] Top 20 tools shown, rest collapsed into "other"
- [ ] Failure case: tool names with very long IDs are truncated visually

**Depends on:** TASK-018, TASK-026

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-036: Port `AnalyticsDashboard` container with tab nav

Port `kirodex/src/renderer/components/analytics/AnalyticsDashboard.tsx` to Klaudex. Top-level container with tab navigation to switch between charts (Hours / Diffs / Messages / Models / Modes / Projects / Slash / Tokens / Tools). Date-range filter (7d/30d/90d/all). Empty state when no data.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Tabs switch the visible chart without remounting siblings
- [ ] Date range filter re-queries `analyticsStore` and updates all charts
- [ ] Empty state shows when zero events recorded across all categories
- [ ] Failure case: switching tabs while data is loading doesn't tear down state

**Depends on:** TASK-027, TASK-028, TASK-029, TASK-030, TASK-031, TASK-032, TASK-033, TASK-034, TASK-035

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-037: Wire analytics dashboard view into App.tsx

Add an `analytics` view to `App.tsx`'s view switcher and a sidebar/header entry point. Slash command `/analytics` opens it (add to `useSlashAction.ts`). Lazy-load the dashboard module to avoid bloating the main bundle (charts pull in heavier deps).

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `/analytics` slash command opens the dashboard
- [ ] First open triggers a network/disk load; subsequent opens are instant
- [ ] Bundle analyzer confirms charts are in a separate chunk

**Depends on:** TASK-036

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-038: Port `CloneRepoDialog` UI

Port `kirodex/src/renderer/components/CloneRepoDialog.tsx` (225 LOC) to Klaudex's `src/renderer/components/CloneRepoDialog.tsx`. Modal with: URL input, target directory picker (folder dialog), SSH key path picker (optional), "Clone" button with progress bar wired to `onGitCloneProgress`. Success closes the modal and adds the cloned dir to recent projects.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Modal opens and accepts URL + target dir
- [ ] Progress bar reflects clone status in real time
- [ ] Success path adds the new project to `recentProjects` and selects it
- [ ] Failure case: clone error displays inline (not just toast) so user can retry without re-typing URL

**Depends on:** TASK-014, TASK-015

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-039: Wire `CloneRepoDialog` into onboarding + new project flow

Add a "Clone repository" entry to `OnboardingSetupStep.tsx` and to the new-project sheet (`task/NewProjectSheet.tsx` if present, else `Onboarding.tsx`). Clicking opens `CloneRepoDialog` (TASK-038). After successful clone, the workspace is set to the new directory.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Onboarding offers a Clone option alongside Open Folder
- [ ] After clone, the just-cloned repo becomes the active workspace
- [ ] Failure case: cancelling the clone dialog returns user to the previous onboarding screen, no half-state

**Depends on:** TASK-038

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-040: Port `PanelContext` for split chat layout

Port `kirodex/src/renderer/components/chat/PanelContext.tsx` to Klaudex. React Context tracking which thread is shown in each split panel (left/right) and which panel is active. Provider wraps the chat layout.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Context exposes `{ panels: { left, right }, activePanel, setActivePanel, setPanelThread }`
- [ ] Switching active panel updates focus styling
- [ ] Failure case: setting an unknown thread ID falls back to the previous valid one

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-041: Port `SplitDivider`, `SplitPanelHeader`, `SplitThreadPicker`

Port these three sibling components from `kirodex/src/renderer/components/chat/` to Klaudex. SplitDivider is the draggable resize handle, SplitPanelHeader is the per-panel header (thread name, picker dropdown), SplitThreadPicker is the dropdown for swapping threads in a panel.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Divider drag resizes both panels with min 30%/max 70% clamps
- [ ] Header shows thread name and an X to close the panel (collapse split)
- [ ] Picker lists threads; selecting one swaps the panel content
- [ ] Failure case: dragging past clamps doesn't break layout

**Depends on:** TASK-040

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-042: Port `SplitChatLayout` container

Port `kirodex/src/renderer/components/chat/SplitChatLayout.tsx` to Klaudex. Wraps `ChatPanel` instances in left/right panels. Controlled by `PanelContext`. When only one panel active, hides the divider and renders full-width.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Single-panel mode renders identically to current Klaudex behavior
- [ ] Split mode renders two ChatPanels with divider between
- [ ] Each panel scrolls independently
- [ ] Failure case: if both panels reference the same thread, both still render and remain in sync (or display a "duplicate" badge)

**Depends on:** TASK-040, TASK-041

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-043: Wire split layout into App.tsx + add slash command

Replace the direct `ChatPanel` mount in `App.tsx` with `SplitChatLayout`. Add slash command `/split` (in `useSlashAction.ts`) to toggle the right panel open/closed. Add keyboard shortcut Cmd+Shift+L to do the same. Persist split state in `taskStore`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `/split` and Cmd+Shift+L both toggle split view
- [ ] Split state persists across app restarts
- [ ] Failure case: if persisted state references a deleted thread, the panel falls back to the most-recent active thread

**Depends on:** TASK-042

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-044: Port `UpdateAvailableDialog`

Port `kirodex/src/renderer/components/UpdateAvailableDialog.tsx` to Klaudex's `src/renderer/components/UpdateAvailableDialog.tsx`. Modal that appears when `updateStore.available === true`. Shows version, release notes, "Update now" / "Remind me later" buttons. Wires to `tauri-plugin-updater` install + relaunch flow.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Modal opens automatically when an update is detected (matches Kirodex behavior)
- [ ] "Update now" downloads, installs, and relaunches via `setRelaunchFlag`
- [ ] "Remind me later" snoozes for 24 hours
- [ ] Failure case: download error shows in dialog (retryable), doesn't crash app

**Depends on:** TASK-015

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-045: Port `WhatsNewDialog` + first-launch trigger

Port `kirodex/src/renderer/components/WhatsNewDialog.tsx` to Klaudex. Auto-opens once per major version after an update completes. Reads release notes from a bundled JSON or the `CHANGELOG.md`. Includes "Got it" dismiss that records the version in settings.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Opens exactly once per major version after install
- [ ] Dismiss persists; no second open until next major version
- [ ] Renders markdown release notes correctly (uses existing react-markdown)
- [ ] Failure case: missing changelog data shows a generic "Updated to vX.Y.Z" message, no crash

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-046: Port `header-toolbar.test.tsx`

Port `kirodex/src/renderer/components/header-toolbar.test.tsx` to Klaudex. Covers split-view focus behavior, breadcrumb rendering, action button states.

**Type:** test
**Effort:** S

**Acceptance Criteria:**
- [ ] Test file compiles and runs under Vitest
- [ ] All tests pass against Klaudex's `header-toolbar.tsx`
- [ ] Failure case: test catches it if a button's disabled state is computed wrong (e.g., reverse logic)

**Depends on:** TASK-043

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-047: Add tests for net-new Klaudex chat components

Write Vitest tests for `AcpSubagentDisplay.tsx`, `PermissionCard.tsx`, `UserInputCard.tsx`, `StatsPanel.tsx` (all Klaudex-only, currently untested). Smoke render + key interaction per component (e.g., PermissionCard "Approve" click fires the prop callback).

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] Four test files added, all passing
- [ ] Each covers at least: render with valid props, render with empty/null props, one user interaction
- [ ] Failure case: passing malformed props (e.g., a UserInputCard without `requestId`) is handled (renders fallback, doesn't crash)

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-048: Add tests for `ClaudeDebugTab` and new hooks

Write tests for `ClaudeDebugTab.tsx` and the three new hooks (`useZoomLimit`, `useModifierKeys`, `useSessionTracker`). Hook tests use `renderHook` from `@testing-library/react`.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] Four test files (one per hook + ClaudeDebugTab)
- [ ] Hook tests cover: initial state, state change on event, cleanup on unmount
- [ ] Failure case: useZoomLimit clamps an injected out-of-range value back into range

**Depends on:** TASK-021, TASK-022, TASK-023

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-049: Add smoke tests for analytics components

Write Vitest smoke tests for the 12 analytics components (`ChartCard`, `HorizontalBarSection`, plus 9 charts + dashboard container). Each test renders with empty data and with mock-populated data, asserting no crash and key DOM elements present.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] One test file per chart (or grouped — author's choice), 12+ components covered
- [ ] Empty state and populated state both tested
- [ ] Failure case: dashboard with all-empty data still renders the empty state

**Depends on:** TASK-036

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-050: Refresh `CLAUDE.md` to reflect Klaudex reality

Rewrite the stale parts of `CLAUDE.md`: replace `kiro_config.rs` references with `claude_config.rs`, replace `agent-client-protocol` SDK references with the hand-rolled Claude CLI subprocess, list the new modules added in this plan (`analytics.rs`, `claude_watcher.rs`), update the command count (was 60, now ~75), document the dual-scope watcher decision and SQLite analytics persistence. Keep the "Engineering learnings" section but add new entries from this migration (watcher debouncing, SQLite + redb coexistence).

**Type:** docs
**Effort:** M

**Acceptance Criteria:**
- [ ] No remaining references to `kiro_config.rs`, `kiroStore.ts`, or `agent-client-protocol` crate
- [ ] Module list matches actual directory contents
- [ ] Command count and module sizes accurate
- [ ] Dual-scope watcher design rationale documented in a new learning entry

**Depends on:** TASK-005, TASK-006, TASK-019

**Agent:** general-purpose

**Priority:** P2

---

### TASK-051: Sync `activity.md` with completed migration entries

For each completed task in this plan, prepend an entry to `activity.md` per the project convention (`## YYYY-MM-DD HH:MM GST (Dubai)` heading + summary + Modified files). Group by completion day. Bring activity.md from its current 9.5 KB to a state that mirrors Kirodex's depth for the migration period.

**Type:** docs
**Effort:** M

**Acceptance Criteria:**
- [ ] Every TASK-NNN that ships has an activity entry
- [ ] Entries follow the existing format exactly
- [ ] Failure case: tasks marked complete without a corresponding activity entry are flagged

**Agent:** general-purpose

**Priority:** P2

---

### TASK-052: Create `todo.md` roadmap

Create `todo.md` at repo root with: short-term polish (any P3 punted from this plan), medium-term roadmap (post-parity Claude-specific features like sub-agent orchestration UI, Claude Skills integration), and long-term ideas (multi-window, mobile companion). Mirror Kirodex's `todo.md` shape; populate with Klaudex-specific items.

**Type:** docs
**Effort:** S

**Acceptance Criteria:**
- [ ] File exists at `/Users/namanchopra/Desktop/projects/Klaudex/todo.md`
- [ ] At least 3 short-term, 3 medium-term, 2 long-term items
- [ ] Items are concrete (linked to file paths or specific behaviors), not vague

**Agent:** general-purpose

**Priority:** P2

---

### TASK-053: Wire recent projects into File menu and sidebar

Add an "Open Recent" submenu to the macOS app menu (constructed in `lib.rs` Tauri menu setup). Also surface the recent projects list in the sidebar's empty-state placeholder. Selecting an entry calls `addRecentProject` (re-orders) and switches workspace.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] File → Open Recent shows up to 10 entries in chronological order (most recent first)
- [ ] Clicking an entry switches workspace and re-orders the list
- [ ] Sidebar empty state lists recent projects when no thread is selected
- [ ] Failure case: a recent project whose path no longer exists shows a "(missing)" suffix and on click prompts removal

**Depends on:** TASK-015

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-054: Sync `CHANGELOG.md` from Klaudex commit history

Klaudex's `CHANGELOG.md` is truncated (16 KB vs Kirodex's 34 KB). Build a CHANGELOG entry for every Klaudex tag/release-candidate, sourced from `git log --oneline` since the rename. Group by minor/patch versions, follow Keep-a-Changelog format. Include Added / Changed / Fixed / Removed sections per release.

**Type:** docs
**Effort:** M

**Acceptance Criteria:**
- [ ] Every commit since rename has at least one CHANGELOG line
- [ ] Format follows Keep-a-Changelog
- [ ] Failure case: merge commits and analytics-only chore commits are excluded

**Agent:** general-purpose

**Priority:** P3

---

### TASK-055: Initialize `downloads.json` for first release

Replace the empty 191-byte `downloads.json` with a structure matching Kirodex's schema (releases array, per-platform asset URLs, download counters initialized to 0). Stub for v0.1.0. Verify the website page that reads this file renders correctly with the stub.

**Type:** infra
**Effort:** S

**Acceptance Criteria:**
- [ ] `downloads.json` schema matches Kirodex
- [ ] Website renders without "no releases" empty state
- [ ] Failure case: malformed JSON is caught by the build script (validate via `bun run check:ts`)

**Agent:** general-purpose

**Priority:** P3

---

### TASK-056: Configure release pipeline (tauri.ci.conf.json + GitHub Actions)

Configure `src-tauri/tauri.ci.conf.json` for production builds. Add `.github/workflows/release.yml` that triggers on tag push, runs `cargo tauri build` for macOS ARM (and stub Linux/Windows jobs for later), uploads artifacts, drafts a GitHub release. Mirror Kirodex's CI setup.

**Type:** infra
**Effort:** L

**Acceptance Criteria:**
- [ ] Tagging `v0.1.0-rc.1` triggers a build
- [ ] Build produces a signed `.dmg` artifact attached to a draft release
- [ ] Failure case: missing signing keys in repo secrets fails the build with a clear message, doesn't publish anything

**Depends on:** TASK-055

**Agent:** devops-aws-senior-engineer

**Priority:** P3

---

### TASK-057: Set up code signing and first release dry-run

Generate or import macOS code signing certificate. Add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` to repo secrets. Run a tagged dry-run to verify the full pipeline: build → sign → notarize → publish draft.

**Type:** infra
**Effort:** L

**Acceptance Criteria:**
- [ ] DMG passes `spctl -a -t open --context context:primary-signature -v` after notarization
- [ ] Draft release contains the signed DMG and updater JSON manifest
- [ ] Failure case: notarization rejection produces a clear error in CI logs (not a silent skip)

**Depends on:** TASK-056

**Agent:** devops-aws-senior-engineer

**Priority:** P3

---

## Failure Modes

| Risk | Affected Tasks | Mitigation |
|------|---------------|------------|
| Claude CLI emits different ext_notification namespaces than `kiro.dev/*` and breaks subagent/MCP UI silently | TASK-002, TASK-031 | TASK-002 captures live emit values before any rename; if changed, TASK-031 (and chart components) consume the verified IDs via TASK-003 outputs. |
| Watching `~/.claude/` recursively triggers thousands of events on Claude CLI's own writes (cache files, lockfiles) | TASK-005, TASK-019 | Watcher includes a denylist for `~/.claude/cache/`, `*.lock`, `.tmp.*` and applies a 300ms debounce per path. |
| SQLite + redb coexisting in the same app data directory creates lock contention | TASK-004 | Each store opens its own file, separate connections, no shared transactions. Document the coexistence in CLAUDE.md (TASK-050). |
| Split chat layout (TASK-040..043) regresses single-panel scroll-to-bottom behavior | TASK-042, TASK-043 | Each ChatPanel keeps its own scroll position state; integration tests in TASK-046 verify single-panel parity. |
| Analytics buffer flush during app close loses recent events | TASK-018 | Hook into Tauri's `CloseRequested` event to force-flush before window destruction; covered by TASK-018 acceptance. |
| Memory spike indicator (TASK-025) flashes on every tool-call streaming chunk | TASK-025 | Use `requestAnimationFrame` debounce on memory recompute; only re-evaluate threshold every 1s, not per chunk. |
| First release pipeline (TASK-056..057) fails due to missing signing identity in secrets | TASK-056, TASK-057 | TASK-057 explicitly tests the dry-run path; failure surfaces in CI before tagging a real release. |
| Klaudex-ahead features (token tracking, /undo) break when porting Kirodex behavior on top | TASK-019, TASK-024, TASK-034, TASK-043 | Each affected task includes an explicit acceptance criterion preserving the Klaudex-only behavior; TASK-034 demonstrates the dual-source pattern. |
| Recent projects menu rebuild (TASK-008) leaks listeners on macOS | TASK-008 | Menu rebuild releases the previous menu via `app.menu().take()` before assigning the new one; covered in acceptance. |
| Onboarding clone flow leaves orphan worktrees on cancel mid-clone | TASK-007, TASK-038, TASK-039 | TASK-007 cleans up the partial clone target on error; TASK-038 dialog cancellation triggers explicit cleanup IPC call. |

## Test Coverage Map

| New Codepath | Covering Task | Test Type |
|-------------|--------------|-----------|
| analytics_save SQLite insert + dedupe | TASK-004 | unit (cargo test) |
| claude_watcher debounce + dual-scope events | TASK-005 | integration (cargo test with notify mock) |
| claude_config merge precedence | TASK-006 | unit (cargo test) |
| git_clone success + invalid URL rejection | TASK-007 | integration (cargo test against local fixture) |
| analyticsStore buffer + flush + hydrate | TASK-018 | unit (vitest) |
| claudeConfigStore watcher subscription | TASK-019 | unit (vitest, mock IPC) |
| thread-memory estimate + reclaim | TASK-020 | unit (vitest) |
| useZoomLimit clamping | TASK-021, TASK-048 | unit (vitest renderHook) |
| useModifierKeys state + window blur | TASK-022, TASK-048 | unit (vitest) |
| useSessionTracker event emission | TASK-023, TASK-048 | unit (vitest) |
| memory-section render + reclaim interaction | TASK-024 | integration (vitest) |
| SidebarFooter spike indicator threshold | TASK-025 | unit (vitest) |
| Each analytics chart empty + populated render | TASK-049 | smoke (vitest) |
| AnalyticsDashboard tab switching + date range | TASK-049 | integration (vitest) |
| CloneRepoDialog progress + error handling | TASK-038 | integration (vitest, mock IPC) |
| SplitChatLayout single + dual panel | TASK-046 | integration (vitest) |
| Header toolbar split-view focus | TASK-046 | unit (vitest) |
| AcpSubagentDisplay / PermissionCard / UserInputCard / StatsPanel | TASK-047 | unit (vitest) |
| ClaudeDebugTab | TASK-048 | unit (vitest) |
| UpdateAvailableDialog install flow | TASK-044 | integration (vitest, mock updater) |
| WhatsNewDialog once-per-major | TASK-045 | unit (vitest) |
| Release pipeline build + sign + notarize | TASK-057 | e2e (CI dry-run) |

## Task Dependencies

```json
{
  "TASK-001": [],
  "TASK-002": [],
  "TASK-003": [],
  "TASK-004": [],
  "TASK-005": [],
  "TASK-006": [],
  "TASK-007": [],
  "TASK-008": [],
  "TASK-009": [],
  "TASK-010": [],
  "TASK-011": [],
  "TASK-012": ["TASK-004", "TASK-005", "TASK-006", "TASK-007", "TASK-008", "TASK-009", "TASK-010", "TASK-011"],
  "TASK-013": ["TASK-004"],
  "TASK-014": ["TASK-007"],
  "TASK-015": ["TASK-008", "TASK-009"],
  "TASK-016": ["TASK-010", "TASK-011"],
  "TASK-017": ["TASK-005"],
  "TASK-018": ["TASK-013"],
  "TASK-019": ["TASK-017"],
  "TASK-020": [],
  "TASK-021": [],
  "TASK-022": [],
  "TASK-023": ["TASK-018"],
  "TASK-024": ["TASK-020", "TASK-016", "TASK-011"],
  "TASK-025": ["TASK-020", "TASK-024"],
  "TASK-026": [],
  "TASK-027": ["TASK-018", "TASK-026"],
  "TASK-028": ["TASK-018", "TASK-026"],
  "TASK-029": ["TASK-018", "TASK-026"],
  "TASK-030": ["TASK-018", "TASK-026"],
  "TASK-031": ["TASK-018", "TASK-026", "TASK-003"],
  "TASK-032": ["TASK-018", "TASK-026"],
  "TASK-033": ["TASK-018", "TASK-026"],
  "TASK-034": ["TASK-018", "TASK-026"],
  "TASK-035": ["TASK-018", "TASK-026"],
  "TASK-036": ["TASK-027", "TASK-028", "TASK-029", "TASK-030", "TASK-031", "TASK-032", "TASK-033", "TASK-034", "TASK-035"],
  "TASK-037": ["TASK-036"],
  "TASK-038": ["TASK-014", "TASK-015"],
  "TASK-039": ["TASK-038"],
  "TASK-040": [],
  "TASK-041": ["TASK-040"],
  "TASK-042": ["TASK-040", "TASK-041"],
  "TASK-043": ["TASK-042"],
  "TASK-044": ["TASK-015"],
  "TASK-045": [],
  "TASK-046": ["TASK-043"],
  "TASK-047": [],
  "TASK-048": ["TASK-021", "TASK-022", "TASK-023"],
  "TASK-049": ["TASK-036"],
  "TASK-050": ["TASK-005", "TASK-006", "TASK-019"],
  "TASK-051": [],
  "TASK-052": [],
  "TASK-053": ["TASK-015"],
  "TASK-054": [],
  "TASK-055": [],
  "TASK-056": ["TASK-055"],
  "TASK-057": ["TASK-056"]
}
```
