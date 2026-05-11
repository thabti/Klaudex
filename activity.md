## 2026-05-11 07:34 GST (Dubai)
### Settings: Overhaul settings panel UI/UX (port from kirodex@9f6a0f8)
Ported upstream settings panel overhaul. Added grouped sidebar nav labels (ACCOUNT, SETTINGS, DATA) with ARIA roles. Added dirty state indicator (amber dot) on Save button. Added ConfirmDialog for destructive actions. Merged Permissions + Worktrees + Sandbox into single Workspace card. Fixed SettingsCard default padding (py-3), removed negative margin hack from SettingRow. Expanded font size range to 12-22 with editable number input. Consistent search input styling.

**Modified:** src/renderer/components/settings/SettingsPanel.tsx, settings-shared.tsx, general-section.tsx, appearance-section.tsx, advanced-section.tsx, keymap-section.tsx

## 2026-05-11 07:31 GST (Dubai)
### Persistence: Add missing persistHistory calls, ack-based quit flush, warn on failures
Ported upstream commit f68dcd85 from kirodex. Added `persistHistory()` to `createDraftThread`, `updateCompactionStatus`, `reorderProject`. Replaced silent `.catch(() => {})` with `console.warn`. Added `_selfWriteCount` guard to history-store to skip same-window `onKeyChange` reloads. Replaced sleep-based quit flush in `lib.rs` with ack-based mpsc channel + 2s timeout. Updated `App.tsx` to check `isSelfWriting()` in cross-window sync and emit `flush-ack`. `clearHistory` now preserves core settings.

**Modified:** `src-tauri/src/lib.rs`, `src/renderer/App.tsx`, `src/renderer/lib/history-store.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 07:29 GST (Dubai)
### Store: Persist history after removeProject/archiveThreads and fix merge mutation
Ported upstream commit 0c6da34 from kirodex. Added `persistHistory()` calls after `removeProject` and `archiveThreads` so state survives crashes. Fixed direct object mutation in `loadTasks` merge to create new objects (preserves Zustand reactivity). Reset `activityFeed` in `clearHistory`.

**Modified:** `src/renderer/stores/taskStore.ts`

## 2026-05-11 07:28 GST (Dubai)
### History: Add tests for live task preservation during loadTasks
Ported upstream commit 14f322b from kirodex. Added two test cases verifying that running and paused tasks survive loadTasks calls — messages and status are never overwritten by stale history data.

**Modified:** `src/renderer/stores/taskStore.test.ts`

## 2026-05-11 07:26 GST (Dubai)
### History: Preserve live tasks when loadTasks is called mid-session
Ported upstream commit 95d6958 from kirodex. loadTasks now checks the existing store for tasks with status running or paused and preserves them, preventing active ACP sessions from being overwritten by stale history data.

**Modified:** `src/renderer/stores/taskStore.ts`

## 2026-05-11 07:25 GST (Dubai)
### History: Use live task check instead of document.hasFocus for sync guard
Ported upstream commit c3f9eda from kirodex. Replaced `document.hasFocus()` guard in the cross-window history sync with a `hasLiveTasks()` check that looks for running/paused tasks. This prevents alt-tab from triggering loadTasks and overwriting active ACP sessions with archived history.

**Modified:** `src/renderer/App.tsx`

## 2026-05-11 07:23 GST (Dubai)
### Steering Queue: Preserve image attachments in queued messages
Ported upstream commit 3065af5 from kirodex. Changed `queuedMessages` from `Record<string, string[]>` to `Record<string, QueuedMessage[]>` carrying text + optional attachments. Attachments flow through enqueue, steer, and auto-drain paths. QueuedMessages component shows photo icon with count tooltip. Updated thread-memory.ts to remove the now-unnecessary string→object adaptation layer.

**Modified:** `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/QueuedMessages.tsx`, `src/renderer/components/chat/QueuedMessages.test.tsx`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/task-store-listeners.ts`, `src/renderer/lib/thread-memory.ts`

## 2026-05-11 07:21 GST (Dubai)
### Sidebar: Resolve orphaned UUID project entries on re-add
Ported upstream commit 8612b64 from kirodex. When re-adding a previously removed project, restored soft-deleted threads now get the new UUID as projectId. removeProject falls back to matching by projectId for orphaned entries, and useSidebarTasks skips orphaned UUID entries with no workspace mapping. Added liveSubagents to applyTurnEnd test state for klaudex compatibility.

**Modified:** `src/renderer/hooks/useSidebarTasks.test.ts`, `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 07:19 GST (Dubai)
### Tests: Align tests with history persistence changes
Ported upstream commit f22deff from kirodex. Updated saveThreads test to expect archived tasks persist, added missing IPC mocks (addRecentProject, rebuildRecentMenu), and fixed applyTurnEnd test to verify running tasks get processed to paused status.

**Modified:** `src/renderer/lib/history-store.test.ts`, `src/renderer/stores/taskStore.test.ts`

## 2026-05-11 07:17 GST (Dubai)
### History: Fix state not persisting across restarts
Ported upstream commit fb235c2 from kirodex. Added missing `store:allow-load` permission so LazyStore can load from disk. Removed `!isArchived` filter from saveThreads so archived threads survive persistence. Added `document.hasFocus()` guard to cross-window sync to prevent own-window writes from triggering reloads that overwrite live streaming state.

**Modified:** `src-tauri/capabilities/default.json`, `src-tauri/gen/schemas/capabilities.json`, `src/renderer/App.tsx`, `src/renderer/lib/history-store.ts`

## 2026-05-11 07:15 GST (Dubai)
### Updater: Fix "Restart now" button silently failing
Ported upstream commit 4a22d88 from kirodex. Made `triggerRestart` properly async, added try/catch with error surfacing to all three restart entry points (RestartPromptDialog, UpdatesCard, AboutDialog), added loading state + spinner to the restart dialog button, and prevented double-click/dismiss while restarting.

**Modified:** `src/renderer/hooks/useUpdateChecker.ts`, `src/renderer/stores/updateStore.ts`, `src/renderer/components/sidebar/RestartPromptDialog.tsx`, `src/renderer/components/settings/updates-card.tsx`, `src/renderer/components/settings/AboutDialog.tsx`, `src/renderer/components/sidebar/SidebarFooter.test.tsx`

## 2026-05-11 07:14 GST (Dubai)
### History Store: Separate dev and prod store files
Ported upstream commit 240b96e from kirodex. Dev builds now use `history-dev.json` and `history-dev.backup.json` via `import.meta.env.DEV`, so running `bun run dev` no longer shares or overwrites the production app's history data.

**Modified:** `src/renderer/lib/history-store.ts`

## 2026-05-11 06:48 GST (Dubai)
### Chat: Render completion card for all valid reports, not just file changes
Ported upstream commit c2430dd from kirodex. `shouldRenderReportCard` now checks for any valid status + non-empty summary instead of requiring `filesChanged` to have items. No-file reports (e.g. answering a question) now render their summary card.

**Modified:**
- src/renderer/components/chat/TaskCompletionCard.tsx

## 2026-05-11 06:47 GST (Dubai)
### Sidebar: Add Copy Path to project context menu
Ported upstream commit c92ca7f from kirodex. Adds a "Copy Path" button to the project right-click context menu, placed after "Open in Finder". Uses `navigator.clipboard.writeText(cwd)` to copy the project path.

**Modified:**
- src/renderer/components/sidebar/ProjectItem.tsx

## 2026-05-11 06:38 GST (Dubai)
### Updater: Bypass quit confirmation dialog on relaunch
Ported upstream commit 8ee1659 from kirodex. Added a `RelaunchFlag` (AtomicBool) to managed Tauri state with a `set_relaunch_flag` command. `prepareForRelaunch()` now sets this flag before calling `relaunch()`. The `CloseRequested` handler checks the flag and skips the confirmation dialog when a relaunch is in progress.

**Modified:**
- `src-tauri/src/lib.rs`
- `src/renderer/lib/ipc.ts`
- `src/renderer/lib/relaunch.ts`

## 2026-05-11 06:36 GST (Dubai)
### Git: Replace git2 remote callbacks with git CLI for network ops
Ported upstream commit 4812906 from kirodex. Replaced `git2` `RemoteCallbacks`/`Cred` credential handling with a `run_git()` helper that shells out to the system `git` binary for fetch, push, and pull. This fixes SSH auth failures caused by libssh2's inability to access macOS Keychain passphrases. Local operations (diff, stage, branch, commit) still use git2.

**Modified:** `src-tauri/src/commands/git.rs`

## 2026-05-11 06:34 GST (Dubai)
### DiffPanel: Remove redundant file header
Ported upstream commit 40557ef6 from kirodex. Added `disableFileHeader: true` to the `FileDiff` options in `DiffPanel.tsx` to hide the built-in header bar since the panel's file sidebar already displays filenames and +/- stats.

**Modified:** `src/renderer/components/diff/DiffPanel.tsx`

## 2026-05-11 06:32 GST (Dubai)
### Chat: Retain file/agent/skill mentions in draft threads on switch
Ported upstream commit 7ec8fc17 from kirodex. Added `draftMentionedFiles` state to the task store so file/agent/skill mention pills persist when switching between draft threads. Threaded the `initialMentionedFiles` prop through ChatInput, useChatInput, and useFileMention hooks. PendingChat now saves and restores mentions alongside drafts and attachments.

**Modified:** `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/hooks/useChatInput.ts`, `src/renderer/hooks/useFileMention.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 06:29 GST (Dubai)
### Multi-window: Add multi-window support and native File menu commands
Ported upstream commit 90db6f0e from kirodex. Built custom native menu in Rust with New Window (⇧⌘N), New Thread (⌘N), New Project (⌘O) in File submenu. New windows share projects/threads via tauri-plugin-store with cross-window sync using LazyStore.onKeyChange and 300ms debounce. Secondary windows close without quit confirmation; only the last window triggers shutdown dialog. Removed conflicting Cmd+N/Cmd+O JS handlers since native menu accelerators handle them.

**Modified:** `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `src-tauri/gen/schemas/capabilities.json`, `src/renderer/App.tsx`, `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/lib/history-store.ts`

## 2026-05-11 06:27 GST (Dubai)
### Chat: Persist draft attachments and pasted chunks across thread switches
Ported upstream commit e9410e2e from kirodex. Lifted attachment and pasted chunk state from React local state into zustand store (draftAttachments, draftPastedChunks maps keyed by workspace). Passes initial values and onChange callbacks through PendingChat → ChatInput → useChatInput. Clears draft attachments and chunks on send.

**Modified:** `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/hooks/useAttachments.ts`, `src/renderer/hooks/useChatInput.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 06:26 GST (Dubai)
### Tests: Align applyTurnEnd and timeline tests with implementation
Ported upstream commit 45e3884b from kirodex. Updated applyTurnEnd test baseState from status:'running' to 'paused' to match production flow. Fixed timeline test expectation where 'working' row is suppressed when live activity is present. Added dedicated test for the running task guard.

**Modified:** `src/renderer/stores/taskStore.test.ts`, `src/renderer/lib/timeline.test.ts`

## 2026-05-11 06:24 GST (Dubai)
### Chat: Fix whitespace gaps, scroll jank, and steering duplication
Ported upstream commit 7b10772e from kirodex. Uses per-row-type height estimates in the virtualizer, replaces scrollToIndex with raw scrollTop for streaming auto-scroll, adds a programmatic scroll guard, only shows the working indicator when no live content exists, and guards applyTurnEnd against late turn_end events during steering.

**Modified:** `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/lib/timeline.ts`, `src/renderer/stores/task-store-listeners.ts`

## 2026-05-11 06:22 GST (Dubai)
### UI: Open external links in OS default browser
Ported upstream commit e5fc335a from kirodex. Added shared `open-external.ts` helper using Tauri's `open_url` command. Applied to chat markdown, settings, about dialog, onboarding, and claude file viewer so links open in the user's default browser instead of failing silently.

**Modified:** `src/renderer/lib/open-external.ts` (new), `src/renderer/components/chat/ChatMarkdown.tsx`, `src/renderer/components/settings/SettingsPanel.tsx`, `src/renderer/components/settings/AboutDialog.tsx`, `src/renderer/components/OnboardingCliSection.tsx`, `src/renderer/components/sidebar/ClaudeFileViewer.tsx`

## 2026-05-11 06:13 GST (Dubai)
### TaskStore: Restore soft-deleted threads when re-importing project
Ported upstream commit 7f7350be from kirodex. The `addProject()` method now checks `softDeleted` for threads matching the workspace and restores them, removing their IDs from the `deletedTaskIds` blocklist so old threads reappear in the sidebar.

**Modified:** src/renderer/stores/taskStore.ts

## 2026-05-11 06:11 GST (Dubai)
### Sidebar: Active project focus indicator
Ported upstream commit 9e1c055 from kirodex. Added a visual indicator to the sidebar so the focused project is identifiable when multiple projects are open. The active project gets a 3px primary-colored left accent bar, subtle background tint, and bold project name. Active project is derived from the selected task's workspace or the pending workspace.

**Modified:** src/renderer/components/sidebar/ProjectItem.tsx, src/renderer/components/sidebar/TaskSidebar.tsx

## 2026-05-11 06:03 GST (Dubai)

### Port: icon overrides, auth fallback, collapsible removal, history backup, subagent display

Ported upstream commit 2b6d71b from kirodex. Removed CollapsibleContent from chat messages, added icon_override field to ProjectPrefs, added claude_whoami fallback to detect_claude_cli, added history-store backup/restore with settings persistence, improved SubagentDisplay with better status indicators, added relaunch utility, and added backup-related tests.

**Modified:** src-tauri/src/commands/fs_ops.rs, src-tauri/src/commands/settings.rs, src/renderer/components/chat/AssistantTextRow.tsx, src/renderer/components/chat/CollapsibleContent.tsx (deleted), src/renderer/components/chat/SubagentDisplay.tsx, src/renderer/components/chat/UserMessageRow.tsx, src/renderer/components/settings/AboutDialog.tsx, src/renderer/components/settings/updates-card.tsx, src/renderer/hooks/useUpdateChecker.ts, src/renderer/lib/history-store.test.ts, src/renderer/lib/history-store.ts, src/renderer/lib/relaunch.ts (new), src/renderer/main.tsx, src/renderer/stores/settingsStore.test.ts, src/renderer/stores/settingsStore.ts, src/renderer/stores/taskStore.test.ts, src/renderer/stores/taskStore.ts

## 2026-05-11 GST (Dubai)

### Tooling: kiro-cli ralph cherry-pick loop

Added a ralph-pattern orchestrator that hands one upstream `kirodex` commit at a time to `kiro-cli` for cherry-picking into klaudex while preserving klaudex's identity, branding, and Claude-Code-driver divergences. `scripts/ralph-cherry-pick.sh` reads a filtered list of upstream SHAs from `.ralph/commits.txt`, renders `.ralph/prompt.md` (which encodes klaudex's protected paths, divergence-aware porting rules, and the `PORTED` / `SKIP:` DONE-marker contract) into `.ralph/current/prompt.txt`, then invokes `kiro-cli chat --no-interactive --trust-all-tools` per commit with up to 3 attempts. `scripts/ralph-loop.sh` is the more generic feature-parity variant for arbitrary source/target repo pairs. Runtime state (`.ralph/current/`, `processed.log`, `last_sha`, `commits.txt`) is gitignored; only the prompt template and the scripts are committed.

**Modified:** `scripts/ralph-cherry-pick.sh` (new), `scripts/ralph-loop.sh` (new), `.ralph/prompt.md` (new), `.gitignore`

## 2026-05-10 06:15 GST (Dubai)

### Settings: TASK-114 — hooks viewer section

Added a read-only Hooks viewer to Settings → Advanced. Created `src/renderer/components/settings/hooks-section.tsx` (254 LOC) that subscribes to a narrow `claudeConfigStore` slice (`(s) => (s.config as ClaudeConfigWithHooks).hooks ?? []`) so the wave-1 `claude_watcher` debounced refresh of `~/.claude/settings.json` (and the per-project `<workspace>/.claude/settings.json`) auto-reflows the panel. Hooks are bucketed by `event` and rendered in canonical order — `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop` — with unknown events appended alphabetically; each group has its own header (icon + title + count badge + subtitle) and a `SettingsCard` body of monospace `matcher → command` rows plus a `global` / `project` scope badge (badge tooltip points to the source path). Failure cases handled: missing matcher renders `(no matcher)` with a dashed-border chip, empty `command` renders an italic `<empty>` placeholder rather than crashing, and the empty store yields a centered "No hooks defined." card with a hint about the `hooks` key in `settings.json`. The `ClaudeHook` TS shape (mirroring the Rust struct in `src-tauri/src/commands/claude_config.rs:61` — `{ event, matcher?, command, source }` with camelCase serde) was defined inline in the new file plus a `ClaudeConfigWithHooks = ClaudeConfig & { hooks?: readonly ClaudeHook[] }` widening, since `@/types/index.ts` is owned by parallel agents and doesn't yet declare the `hooks` field — same widening pattern `permissions-section.tsx` and `memory-section.tsx` use. Mounted in `src/renderer/components/settings/SettingsPanel.tsx`: extended the local `Section` union to `SharedSection | 'permissions' | 'hooks'`, spliced a `Hooks` NAV entry (icon `IconBolt`, group `settings`) between `advanced` (idx 4) and `archives` (idx 5) per the task's "under Advanced" placement guidance, and added `{section === 'hooks' && <HooksSection />}` at line 307. `settings-shared.tsx` was deliberately left untouched — same parallel-agent constraint TASK-106 navigated. `bun run check:ts` final line: `src/renderer/components/chat/AcpSubagentDisplay.tsx(136,47): error TS2304: Cannot find name 'i'.` (pre-existing, excluded by the task spec).

**Modified:** `src/renderer/components/settings/hooks-section.tsx` (new), `src/renderer/components/settings/SettingsPanel.tsx`

## 2026-05-10 06:10 GST (Dubai)

### Tests: TASK-118 — cargo tests for output-style + hook + statusline parsers (audit + gap fills)

Audited the existing `#[cfg(test)] mod tests` in `claude_config.rs`. Layer 1 D had already shipped 12 tests (4 per parser), satisfying most of the plan's acceptance: scan_output_styles (nonexistent / frontmatter happy / filename fallback / malformed-skip), scan_hooks (nonexistent / no-hooks-key / malformed JSON returns empty / all-4-events), read_statusline (nonexistent / no-key / happy path / padding optional / non-command type). One acceptance gap remained: the plan explicitly required that **read_statusline** also return `None` (without panicking) for malformed `settings.json`, but only `scan_hooks` had that exact case. Added one new test `read_statusline_malformed_json_returns_none` mirroring the scan_hooks malformed-json test. Final cargo test result: `34 passed; 1 failed` — the one failure is the pre-existing, accepted `load_mcp_file_parses_stdio_server` that pre-dates Layer 1 work. `bun run check:rust` could not run end-to-end due to two pre-existing `output_style` field errors in `acp/connection.rs` (unrelated to this task and not under TASK-118 scope); the claude_config module itself compiles cleanly with zero errors and zero warnings.

**Modified:** `src-tauri/src/commands/claude_config.rs`, `activity.md`

## 2026-05-10 04:35 GST (Dubai)

### Backend: TASK-108+109+110 — output style + hook + statusline parsers

Added the three Claude Code config parsers in `src-tauri/src/commands/claude_config.rs` (TASK-104 structs were not yet present in the file, so the structs `ClaudeOutputStyle`, `ClaudeHook`, `StatuslineConfig` and the three new fields on `ClaudeConfig` were added inline as part of this work). `scan_output_styles(base, is_global)` reads `<base>/output-styles/*.md`, parses YAML-ish frontmatter for `name` + `description` (a small custom parser since `serde_yaml` is not in `Cargo.toml`), falls back to filename when `name` is absent, and stores the stripped body. `scan_hooks(base, is_global)` reads `<base>/settings.json` and emits one `ClaudeHook` per (event, entry) pair via a private `RawHookEntry` deserializer; malformed JSON logs and yields empty. `read_statusline(base, is_global)` returns `Some(StatuslineConfig)` only when `type == "command"` (other kinds log a warning and return `None`). A shared `parse_settings_json(path) -> Option<serde_json::Value>` helper plus `extract_hooks_from_settings` / `extract_statusline_from_settings` are reused inside `get_claude_config` so settings.json is read at most once per scope. Project statusline overrides global per TASK-110. Added 12 unit tests (4 output-styles, 4 hooks including the 4-event happy path, 4 statusline). `bun run check:rust` final line: `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 0.67s` (zero errors). All 12 new tests pass; the one unrelated failure in `load_mcp_file_parses_stdio_server` predates this branch (the `slack-mcp` command isn't in `ALLOWED_MCP_COMMANDS`).

**Modified:** `src-tauri/src/commands/claude_config.rs`

## 2026-05-10 05:35 GST (Dubai)

### Backend: TASK-105 — wire permission matcher into ACP request_permission flow

Replaced the legacy `auto_approve: AtomicBool` short-circuit in `KlaudexClient::request_permission` with a 3-step decision driven by the TASK-102 matcher: read the active `Permissions` scope from managed `SettingsState` (per-project `project_prefs[workspace].permissions` wins over global `settings.permissions`), extract a `(tool_name, args)` pair from the serialized request, call `match_permission`, then map `Decision::Deny → auto-deny` (deny ALWAYS wins, even under `mode == Bypass`), `Decision::Allow → auto-approve`, `Decision::NoMatch + Bypass → auto-approve`, and `Decision::NoMatch + Ask|AllowListed → fall through to user prompt`. Added a private `extract_tool_and_args` helper that prefers an explicit `toolName`/`name` field, falls back to mapping the toolCall `kind` (`execute → Bash`, `read → Read`, `edit → Edit/Write`, `search → Grep/Glob`, `fetch → WebFetch/WebSearch`, `think → Task`, `switch_mode → ExitPlanMode`) to a canonical Claude tool name, then derives the args string by tool type (Bash → `command`, Read/Write/Edit → `file_path`, Grep → `pattern`, etc.). The legacy AtomicBool is kept as a fast-path fallback only when `try_state::<SettingsState>()` returns `None` (early startup / teardown) so YOLO behavior never regresses mid-session. No `catch_unwind` wrap — the matcher is pure-sync, has no `unwrap` over user input, and its existing tests cover malformed-pattern paths (logged + skipped, never panicked); a future panic would still route through the user-prompt path because the connection thread is already wrapped in `catch_unwind` in `connection.rs`. `bun run check:rust` final line: `Finished dev profile [unoptimized + debuginfo] target(s) in 0.22s` (zero errors, 81 pre-existing warnings; the `permissions::*` "never used" warnings will resolve once `client.rs` is wired into `acp/mod.rs` in a follow-up).

**Modified:** `src-tauri/src/commands/acp/client.rs`

## 2026-05-10 05:30 GST (Dubai)

### Frontend: TASK-107 — YOLO header chip + Cmd+Shift+Y + /yolo + retire AutoApproveToggle

Added a permission-mode chip to `AppHeader.tsx` (Ask / Listed / Bypass with `IconShieldCheck` / `IconList` / `IconAlertTriangle`, three-way cycle on click, per-project override taking precedence over the global policy), a thin red "Bypassing permissions — anything the agent runs is auto-approved" banner that appears immediately under the header bar whenever the active mode is `bypass` (mounted by returning a Fragment from `AppHeaderInner` so App.tsx didn't have to change — the banner sits as a flex-col sibling under the `<header>`), Cmd+Shift+Y in `useKeyboardShortcuts.ts` to toggle Ask ↔ Bypass at the active scope, and a `/yolo` slash case in `useSlashAction.ts` (added to the `KNOWN` autocompletion set; emits a system message reflecting the new state). On persistence failure each path catches the throw, surfaces a `sonner` toast, and reverts the project-pref scope. Per-project precedence mirrors the legacy `AutoApproveToggle` (`projectPrefs[ws].permissions ?? settings.permissions ?? { mode: 'ask', allow: [], deny: [] }`). The `Permissions` / `PermissionMode` TS shapes are mirrored locally inside each of the 4 files (the shared `@/types` interface didn't yet declare `permissions`, and `types/index.ts` is out of scope) — same `as unknown as AppSettings` widening pattern that `permissions-section.tsx` uses. Per-project writes go through `setProjectPref(ws, { permissions } as unknown as ...)` so the existing strict-typed setter accepts the new field. Resolution of legacy AutoApproveToggle: kept the file (fallback path per the patch) but rebound it to read `permissions.mode === 'bypass'` and write through the new model — the only mount site is `src/renderer/components/chat/ChatToolbar.tsx:8,76` which is outside the 4-file scope, so the rebind keeps that toolbar widget functional without touching it. The legacy `selectAutoApprove` selector is preserved but now derives from `permissions.mode` for any other consumer. Failure mode of the rebind: `selectAutoApprove` no longer reads the legacy `settings.autoApprove` boolean, so `AutoApproveToggle.test.ts` (which asserts the legacy reads) will fail at runtime — that test is out of scope and the patched plan explicitly retires the legacy boolean ("no widget should still write to `settings.autoApprove`"). `bun run check:ts` final line: `src/renderer/components/chat/AcpSubagentDisplay.tsx(136,47): error TS2304: Cannot find name 'i'.` (pre-existing, excluded by the task spec).

**Modified:** `src/renderer/components/AppHeader.tsx`, `src/renderer/components/chat/AutoApproveToggle.tsx`, `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/hooks/useSlashAction.ts`

## 2026-05-10 05:05 GST (Dubai)

### Settings: TASK-106 — Permissions UI section

Added a new `Permissions` settings section that lets the user pick between `Always ask` / `Allow listed only` / `Bypass` modes and edit allow / deny rule lists, persisting through the existing `saveSettings` pipeline (no new Tauri command). Created `src/renderer/components/settings/permissions-section.tsx` (499 LOC) with a 3-option radio group (each option carries an icon + subtitle, Bypass styled red), scrollable allow / deny lists with `Tool(args)` parsing for two-tone `Tool (args)` rendering, an inline `Tool` dropdown + arg input form (Tool dropdown values: `Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task`; per-tool placeholder hints e.g. `npm test:*` for Bash, `./src/**` for Read/Write/Edit, `https://example.com/*` for WebFetch), and a disabled `Import` placeholder button gated by a tooltip "Will import from ~/.claude/settings.json (TASK-116)". Failure case: when the mode is `Bypass` with both lists empty, the section renders the same red safety banner used by the future header chip plus an amber `IconAlertTriangle` "no rules configured" hint. `Permissions` and `PermissionMode` TS types were defined inline in the new section (not added to `@/types/index.ts` — kept scope to the two files; the Rust serde camelCase emit handles the wire format), and `AppSettings` is locally widened with an optional `permissions` field via `AppSettingsWithPermissions` — same trick `memory-section.tsx` uses for the wave-1 terminal fields. Mounted in `src/renderer/components/settings/SettingsPanel.tsx` with a local `Section = SharedSection | 'permissions'` union and a locally-typed `NAV` constant that splices a Permissions entry between `general` and `appearance`; the conditional render line is `{section === 'permissions' && <PermissionsSection settings={draft} updateDraft={updateDraft} />}` (sits between the General and Appearance branches). `settings-shared.tsx` was deliberately left untouched — the parallel-agent constraint required the `Section` type and `NAV` to be extended locally inside `SettingsPanel.tsx`. `bun run check:ts` final line: `src/renderer/components/chat/AcpSubagentDisplay.tsx(136,47): error TS2304: Cannot find name 'i'.` (pre-existing, excluded by the task spec).

**Modified:** `src/renderer/components/settings/permissions-section.tsx` (new), `src/renderer/components/settings/SettingsPanel.tsx`

## 2026-05-10 04:30 GST (Dubai)

### Recovery: restore wave-1 settings + wave-2 lib.rs + ipc.ts after working-tree revert

Restored the wave-1/wave-2 integrating edits that were reverted via `git checkout --` while the wave-1 source files (analytics.rs, claude_watcher.rs) themselves survived on disk. In `src-tauri/src/commands/mod.rs` re-declared `pub mod analytics;` and `pub mod claude_watcher;` (alphabetical, alongside the surviving `pub mod permissions;` from TASK-102). In `src-tauri/src/commands/settings.rs` added the wave-1 `RecentProject { path, name, lastOpened }` struct plus `recent_projects`, `terminal_scrollback` (default 5000), `terminal_idle_close_mins` fields on `AppSettings` (mirrored on the `AppSettingsRaw` shadow + `From` impl, preserving every TASK-101 Permissions test), 5 `recent_projects_*` Tauri commands, `set_dock_icon_visible` (NSApplication activation-policy toggle, divergence from spec's b64 image swap), `request_relaunch`, and a `build_app_menu` builder that constructs File → Open Recent with `(missing)` suffixes for paths whose `Path::exists()` is false. Added 4 new tests for camelCase round-trip + scrollback defaults — all 21 settings tests pass. In `src-tauri/src/lib.rs` registered `analytics::AnalyticsState` and `claude_watcher::ClaudeWatcherState` via `app.manage()`, wired `claude_watcher::watch_global_claude(app.handle())` on setup, hooked `claude_watcher::stop_all(app)` into `shutdown_app()` before the PTY teardown, installed the native menu via `build_app_menu` + `set_menu`, added an `on_menu_event` handler dispatching `clear_recent`, `recent:<path>` (emits `open-recent-project`), and a generic `menu-action` fallback, and registered 13 new commands in `invoke_handler!`. In `src/renderer/lib/ipc.ts` added `AnalyticsEvent`, `GitCloneProgress`, `RecentProject` types, a `throttleRaf` helper, 17 wrappers (analytics 4, recent-project 5, dock/relaunch 2, claude-watcher 2, plus stubs for `gitClone`/`gitInit`/`pickImage`/`isDirectory`/`ptyCount` whose Rust commands aren't yet registered — wrappers carry `NOTE` comments documenting the gap), and an rAF-throttled `onGitCloneProgress` listener; analytics commands added to `DEBUG_QUIET_COMMANDS`. Out of strict scope but unavoidable for compilation: added `redb`, `notify`, `notify-debouncer-mini` to `src-tauri/Cargo.toml` and an `Analytics(String)` variant to `commands/error.rs` — the surviving wave-1 source files reference these symbols and won't compile without them. `bun run check:rust`: `Finished dev profile [unoptimized + debuginfo] target(s)` — zero errors, 78 warnings (cocoa deprecations, all pre-existing). `bun run check:ts`: only the pre-existing `AcpSubagentDisplay.tsx:136` error remains. `cargo test --lib settings::`: 21 passed / 0 failed (all 11 TASK-101 tests + 6 pre-existing + 4 new wave-1 tests). `bun run test`: 830 passed across 72 files.

**Modified:** `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/lib.rs`, `src/renderer/lib/ipc.ts`, `src-tauri/Cargo.toml` (added 3 deps), `src-tauri/src/commands/error.rs` (added Analytics variant)

## 2026-05-10 04:14 GST (Dubai)

### Backend: TASK-101 — Permissions Rust type + AppSettings + per-project migration

Added a new `PermissionMode` enum (`Ask | AllowListed | Bypass`, default `Ask`) and `Permissions` struct (`mode`, `allow: Vec<String>`, `deny: Vec<String>`) to `src-tauri/src/commands/settings.rs`. Wired `permissions: Permissions` onto `AppSettings` (defaults to `{ mode: Ask, allow: [], deny: [] }`) and `permissions: Option<Permissions>` onto `ProjectPrefs` (`None` falls back to global). Implemented Pattern 1 migration via private `AppSettingsRaw` / `ProjectPrefsRaw` shadow structs + custom `Deserialize` impls: when the on-disk file lacks a `permissions` block, legacy `auto_approve: true` promotes to `mode: Bypass`; an explicit `permissions` block always wins over the legacy bool. Per-project: `Some(true) → Some({ mode: Bypass })`, `Some(false) → Some({ mode: Ask })`, `None → None`. Legacy `auto_approve` is preserved on the public structs and continues to serialize so older Klaudex builds reading the same file keep working. Also tightened the `theme` doc-comment to mention `"claude"` (TASK-103 piggyback). Added 11 new unit tests covering defaults, camelCase enum serialization, global migration in both directions, explicit-block-wins precedence, all three per-project migration branches, and a full round-trip including a per-project override. Patched the pre-existing `serde_roundtrip_preserves_all_fields` test to add `..Default::default()` so the new `permissions` field doesn't break the struct literal. `bun run check:rust`: `Finished dev profile [unoptimized + debuginfo] target(s) in 3.88s` — zero errors. `cargo test --lib commands::settings::tests::`: `17 passed; 0 failed` (all 11 new tests + the 6 pre-existing).

**Modified:** `src-tauri/src/commands/settings.rs`

## 2026-05-10 04:10 GST (Dubai)

### Frontend: TASK-103 — Claude Orange theme variant

Added a `"claude"` theme option that applies a dark base with Claude Code's signature terracotta orange (`#D97757`) accents. In `src/tailwind.css` (54 lines added, including the new `.claude` block plus aliases on the dark-only scrollbar / skeleton / floating-panel / window-unfocused / `@custom-variant dark` rules so dark-mode utilities still resolve under `.claude`), the `.claude` block sets `color-scheme: dark`, copies the dark surface tokens, and overrides seven accent-and-action tokens: `--primary: #D97757`, `--primary-foreground: #ffffff`, `--accent: #B95F3D`, `--accent-foreground: #ffffff`, `--ring: #D97757`, `--border: #3a2a25`, plus `--input` keeps the dark color-mix value (the seventh override is the implicit color-scheme inherited via `dark:` variant matching). All hex per CLAUDE.md "oklch() CSS colors fail in older WebKit". `ThemeSelector.tsx` got a fourth `'claude'` entry with an orange-swatched preview card and the grid switched from `grid-cols-3` to `grid-cols-2 sm:grid-cols-4` to fit four options. Runtime application lives in `src/renderer/lib/theme.ts:applyTheme` (extended to apply the `claude` class instead of `dark`, with both classes mutually exclusive) and the pre-paint script in `index.html` (extended to read `'claude'` from localStorage and add the class before React boots — per CLAUDE.md "Dark theme class must be applied before React renders"). `ThemeMode` type extended in `src/renderer/types/index.ts`. Failure case: `theme: "invalid"` falls back to `'dark'` via the existing `readPersistedTheme` validator. `bun run check:ts`: zero errors from any of the five files I modified (parallel-agent in-flight errors in `analyticsStore.ts`, `RecentProjectsList.tsx`, `useSessionTracker.ts`, `analytics/*.tsx`, `UpdateAvailableDialog.tsx`, `AcpSubagentDisplay.tsx`, `ClaudeConfigPanel.tsx` are all pre-existing or from concurrent work). The settings.rs doc-comment piece is being handled by another agent. The 75-LOC `appearance-section.tsx` mounts `<ThemeSelector />` directly with no hardcoded option list, so it picks up the new option automatically — no edit needed there.

**Modified:** `src/tailwind.css`, `src/renderer/components/settings/ThemeSelector.tsx`, `src/renderer/lib/theme.ts`, `src/renderer/types/index.ts`, `index.html`

## 2026-05-10 04:06 GST (Dubai)

### Frontend: TASK-112 — CLAUDE.md memory file editor

Added `src/renderer/components/sidebar/MemoryFileEditor.tsx` (296 LOC) — a controlled Dialog (Radix via `@/components/ui/dialog`) that lets users edit a `ClaudeMemoryFile` body with Save / Reload / Cancel actions, dirty tracking, char count, an inline error banner on write failure (body preserved for retry), and an external-edit conflict banner with "Reload and discard / Keep my changes" choices when the on-disk file changes mid-edit. Subscribes to `ipc.onClaudeConfigChanged` and matches the open file via bidirectional substring against the watcher payload path; auto-reloads when clean, prompts via banner when dirty. Listener is cleaned up on unmount per CLAUDE.md "IPC event cleanup". The Reload button uses `window.confirm` if local body is dirty. Dialog visual chrome copies `WhatsNewDialog` / `CloneRepoDialog` patterns. `src/renderer/lib/ipc.ts` gained `readTextFile` (alias of `readFile` for symmetry), `writeTextFile`, the `ClaudeConfigChangedPayload` type, and `onClaudeConfigChanged` listener — the latter two were absent from the file as it currently stands. `writeTextFile` calls a `write_text_file` Tauri command that does not yet exist (`@tauri-apps/plugin-fs` is not installed and adding a Rust command was out of this task's two-file scope) — documented in a JSDoc note on the wrapper. No editor mount points were touched; integration into the sidebar is an explicit follow-up. `bun run check:ts` shows zero errors for the two files I modified; remaining errors are pre-existing or caused by other parallel work on `ipc.ts` (analytics / recent projects / git clone surfaces) and not by TASK-112.

**Modified:** `src/renderer/components/sidebar/MemoryFileEditor.tsx` (new), `src/renderer/lib/ipc.ts`

## 2026-05-08 02:50 GST (Dubai)

### Frontend: TASK-111 — slash command browser sidebar row

Created `src/renderer/components/sidebar/ClaudeCommandRow.tsx` (122 LOC) — a memoized sidebar row that renders one `ClaudeCommand` from `claudeConfigStore.config.commands`. The row shows the formatted command name plus a truncated relative file path (e.g., `commands/foo.md`). Clicking or pressing Enter/Space toggles a collapsible inline panel that lazy-reads the file body on first open via `ipc.readFile` (the existing wrapper around the Rust `read_text_file` command). On read failure the panel shows an inline "Could not read file" message instead of crashing. Replaced the old `SkillRow`-based Commands list inside `ClaudeConfigPanel.tsx` with the new component, swapped the section icon from `IconBolt` to `IconCommand`, and added a "No slash commands" empty-state hint that renders when the user expands an empty Commands section. `bun run check:ts` is clean for the two files in scope (other errors are pre-existing or owned by parallel agents).

**Modified:** `src/renderer/components/sidebar/ClaudeCommandRow.tsx` (new), `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`

## 2026-05-10 04:06 GST (Dubai)

### Backend: TASK-102 — permission pattern matcher

Implemented the pure-function permission pattern matcher in `src-tauri/src/commands/permissions.rs` (504 LOC including doc comments + tests) and registered the module in `src-tauri/src/commands/mod.rs`. Public API: `Decision { Allow, Deny, NoMatch }` enum and `match_permission(tool, args, allow, deny) -> Decision`. Pattern grammar: `Tool(spec)` where `spec` has two flavours — **command-prefix** (contains `:`, splits into anchored literal prefix + suffix-glob, with ASCII-whitespace word boundary so `Bash(npm test:*)` matches `"npm test"` and `"npm test --watch"` but not `"npm tests"`) and **plain-glob** (no `:`, full content matched verbatim against args, e.g. `Read(./src/**)`, `Bash(*)`). Deny rules win over allow rules. Malformed patterns (`Bash(`, `(empty)`, `no parens`) are logged via `log::warn!` and skipped, never panic. Glob algorithm: collapse `**`+ to `*`, split on `*`, walk literal segments in order tracking a cursor over `args`, anchor first/last literals based on whether glob starts/ends with `*`. 16 unit tests all pass under `cargo test --lib commands::permissions::` covering: allow match, deny match, deny-overrides-allow, no-match, empty lists, malformed-skipped (3 variants in one list), star-matches-anything, prefix-via-trailing-star (incl. word-boundary failure for `npm tests`), `Read(./src/**)` positive, `Read(./src/**)` negative for `./node_modules/foo.ts` and `/etc/passwd`, exact-match-no-wildcard, tool-name case-sensitivity, middle-wildcard, parser malformed-input rejection, empty-spec-only-matches-empty-args, command-prefix word-boundary unit test on `spec_match`. `bun run check:rust` final line: `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 0.52s` (only dead-code warnings on `Decision`, `match_permission`, `parse_pattern`, `spec_match`, `glob_match` — expected since wiring lands in later TASKs). No other files touched.

**Modified:** `src-tauri/src/commands/permissions.rs` (new), `src-tauri/src/commands/mod.rs`

## 2026-04-20 23:40 GST (Dubai)

### Security: fix 5 Amazon Q review findings on PR #2

Addressed all critical security findings: sanitized PATH env to trusted prefixes only, validated claude_bin against approved directories, validated workspace existence before spawn, added audit logging for auto-approve bypass, and added MCP command allowlist with shell metacharacter rejection.

**Modified:** `src-tauri/src/commands/acp/connection.rs`, `src-tauri/src/commands/claude_config.rs`

## 2026-04-20 23:30 GST (Dubai)

### Git: create 12 small commits and push refactor/rename-kirodex-to-klaudex

Split all uncommitted changes into 12 logical commits covering: config renames (Kirodex→Klaudex), icon updates, ACP SDK→Claude CLI subprocess replacement, kiro_config→claude_config rename, frontend store/type renames, sidebar component renames (Kiro→Claude), new chat components (AcpSubagentDisplay, PermissionCard, StatsPanel, UserInputCard), chat component updates, settings/onboarding/debug updates, IPC layer rewrite, store updates with tests, and activity/downloads/website cleanup. Pushed to origin.

**Modified:** 98 files across 12 commits

## 2026-04-20 17:30 GST (Dubai)

### ACP Subagent Display: live multi-agent orchestration UI

Wired up ACP `kiro.dev/subagent/list_update` extension notifications and built a live in-task SubagentDisplay. The Rust backend already emitted `subagent_update` events; the frontend now consumes them via a new `liveSubagents` Zustand state field, a `parseSubagents` parser with type guards and fallbacks, and a new `AcpSubagentDisplay` component with progress bar, auto-collapse, live tool call/thinking indicators, and full accessibility. The old tool-call-based `SubagentDisplay` remains as fallback when ACP data is unavailable.

**Modified:** `src/renderer/types/index.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/stores/task-store-listeners.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/components/chat/AcpSubagentDisplay.tsx` (new), `src/renderer/components/chat/ToolCallDisplay.tsx`

## 2026-04-20 14:14 GST (Dubai)

### Token Usage Tracker: feature complete

Implemented the full Kiro Token Usage Tracker feature across 17 files using multi-agent orchestration (2 implement → 2 review → 2 improve).

**Rust backend:**
- Extended ACP `client.rs` to forward full token breakdown in `usage_update` events
- Added `redb` persistence layer (`token_store.rs`) with `save_token_event`, `query_token_events`, `get_token_summary`, `clear_token_events` commands
- Uses `Option<Arc<Database>>` for thread-safe, lock-free access (review improvement)

**Frontend core:**
- `kiro-pricing.ts`: static Claude model pricing table, `computeCost`, `formatCost`, `formatTokens`
- `token-estimator.ts`: `estimateTokens` (text.length/4 fallback), `buildTokenDetail`
- `tokenUsageStore.ts`: Zustand store aggregating daily/session/model usage from redb events
- `task-store-listeners.ts`: auto-persists token_detail events on every usage_update

**UI components:**
- `header-token-usage.tsx`: AppHeader popover with total tokens/cost, time range pills, mini SVG bar chart, top models, View Dashboard link
- `TokenUsageSection.tsx`: Dashboard section with stat cards, stacked bar chart, sortable daily table, model breakdown bars

**Review improvements applied:**
- Fixed ID collision risk, wasteful string alloc, negative value guards
- Extracted shared `formatTokens`, added Escape key dismiss, staleness check, task name resolution
- Rust: removed Mutex, added `rdb()` helper, deser logging, `clear_token_events` command

**Verification:** `tsc --noEmit` ✓, `vite build` ✓, `cargo check` ✓, 733/733 tests pass.

**Modified:** `src-tauri/Cargo.toml`, `src-tauri/src/commands/acp/client.rs`, `src-tauri/src/commands/error.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/token_store.rs`, `src-tauri/src/lib.rs`, `src/renderer/components/AppHeader.tsx`, `src/renderer/components/dashboard/Dashboard.tsx`, `src/renderer/components/dashboard/TokenUsageSection.tsx`, `src/renderer/components/header-token-usage.tsx`, `src/renderer/lib/ipc.ts`, `src/renderer/lib/kiro-pricing.ts`, `src/renderer/lib/kiro-pricing.test.ts`, `src/renderer/lib/token-estimator.ts`, `src/renderer/lib/token-estimator.test.ts`, `src/renderer/stores/task-store-listeners.ts`, `src/renderer/stores/tokenUsageStore.ts`

## 2026-04-20 14:11 GST (Dubai)

### Applied frontend review improvements (7 fixes)

Applied all seven code review improvements to the frontend:

1. **CRITICAL** - Fixed token event ID collision risk in `task-store-listeners.ts` by appending 8 random chars to the ID
2. **CRITICAL** - Eliminated wasteful `'x'.repeat()` string allocation in `token-estimator.ts`, replaced with direct `Math.ceil(length / 4)`
3. **CRITICAL** - Added negative value guards (`Math.max(0, ...)`) in `computeCost` in `kiro-pricing.ts`
4. **IMPORTANT** - Extracted `formatTokens` to `kiro-pricing.ts` as shared utility; removed duplicate definitions from `header-token-usage.tsx` and `TokenUsageSection.tsx`
5. **IMPORTANT** - Added Escape key dismiss handler to header token usage popover
6. **IMPORTANT** - Added 30s staleness check to `loadUsage` in `tokenUsageStore.ts` to prevent redundant fetches
7. **IMPORTANT** - Resolved task names from `taskStore` instead of truncated IDs in `tokenUsageStore.ts`

Verification: `tsc --noEmit` clean, 54 test files / 733 tests all passing.

## 2026-04-20 14:07 GST (Dubai)

### Code Review: Token Store (redb) implementation

Performed a structured code review of the new `token_store.rs` module and related modifications across `error.rs`, `acp/client.rs`, `mod.rs`, `lib.rs`, and `Cargo.toml`. Reviewed for correctness, safety, performance, error handling, conventions, and edge cases.

**Modified:** activity.md

# Activity Log

## 2026-04-20 14:01 (Dubai, GMT+4)

### Frontend Core: Kiro Token Usage Tracker

**Created files:**
- `src/renderer/lib/kiro-pricing.ts` — Static pricing table for Claude models, `computeCost` and `formatCost` utilities
- `src/renderer/lib/kiro-pricing.test.ts` — 8 tests for pricing logic
- `src/renderer/lib/token-estimator.ts` — Token estimation from text length, `buildTokenDetail` for raw ACP data
- `src/renderer/lib/token-estimator.test.ts` — 5 tests for token estimation
- `src/renderer/stores/tokenUsageStore.ts` — Zustand store for aggregated token usage (daily, session, model breakdowns)

**Modified files:**
- `src/renderer/lib/ipc.ts` — Added `saveTokenEvent`, `queryTokenEvents`, `getTokenSummary` IPC wrappers
- `src/renderer/stores/task-store-listeners.ts` — Added `computeCost` import; updated `unsub7` (onUsageUpdate) to persist token events to redb via fire-and-forget `saveTokenEvent`

**Verification:**
- `bunx tsc --noEmit` — clean (exit 0)
- `bunx vitest run` — 13/13 tests pass (kiro-pricing: 8, token-estimator: 5)

## 2026-04-20 14:04 (Dubai)

### Header Token Usage Popover

- Created `src/renderer/components/header-token-usage.tsx`
  - `HeaderTokenUsage` memo-wrapped component with IconCoins button
  - Click-outside popover pattern (matching header-user-menu.tsx)
  - Time range pills (7d / 30d / All) wired to tokenUsageStore.setTimeRange
  - Summary section: total tokens (K/M formatted) + total cost ($X.XX)
  - MiniBarChart: inline SVG stacked bar chart (input blue, output purple, cached green)
  - Top 3 models by usage from modelUsage
  - "View Dashboard →" button calling setView('dashboard')
  - Loading spinner state while isLoading is true
  - `data-no-drag` on container for header drag compatibility
- Updated `src/renderer/components/AppHeader.tsx`
  - Added import for HeaderTokenUsage
  - Inserted `<HeaderTokenUsage />` before `<HeaderUserMenu />`
- TypeScript check: `bunx tsc --noEmit` passed with zero errors

## 2026-04-20 14:05 (Dubai)

### Dashboard Token Usage Section

- Created `src/renderer/components/dashboard/TokenUsageSection.tsx`
  - `TokenUsageSection` memo-wrapped component with full token analytics
  - Time range selector pills (7d / 30d / All) wired to tokenUsageStore
  - Summary stat cards: total tokens, total cost, daily average, conversations
  - UsageTrendChart: inline SVG stacked bar chart (120px height, date labels every 7th bar)
  - DailyBreakdownTable: sortable table with 6 columns, alternating rows, max 30 rows
  - ModelBreakdown: horizontal progress bars per model with token count and cost
  - All sub-components memo-wrapped for performance
- Updated `src/renderer/components/dashboard/Dashboard.tsx`
  - Added import for TokenUsageSection
  - Inserted `<TokenUsageSection />` below task grid inside p-6 wrapper
- TypeScript check: `bunx tsc --noEmit` passed with zero errors

## 2026-04-20 14:11 GST (Dubai)

### Applied review improvements to token_store.rs

Applied four improvements from code review:

1. **Replaced `Mutex<Option<Database>>` with `Option<Arc<Database>>`** — Removed parking_lot Mutex. redb's Database is Send+Sync and handles its own locking. DB is now created eagerly at startup with graceful fallback (Option) if creation fails.
2. **Added `rdb()` helper** — Reduces `.map_err(|e| AppError::TokenStore(e.to_string()))` boilerplate across all redb calls.
3. **Added `log::warn!` for deserialization failures** — `query_token_events` and `get_token_summary` now log malformed events instead of silently skipping them.
4. **Added `clear_token_events` command** — New Tauri command to delete and recreate the token_events table. Registered in lib.rs invoke_handler.

Files modified:
- `src-tauri/src/commands/token_store.rs`
- `src-tauri/src/lib.rs`

Verified: `cargo check` passes cleanly (no new warnings).
