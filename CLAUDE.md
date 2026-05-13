# CLAUDE.md — Klaudex

## Project overview

Klaudex is a native macOS desktop app for managing AI coding agents via the Agent Client Protocol (ACP). It features a chat interface, task management, diff viewer, integrated terminal, git operations, and a settings panel. Built with Tauri v2 (Rust backend) and React 19 (TypeScript frontend).

## Tech stack

- **Desktop framework**: Tauri v2 (Rust backend, WebView frontend)
- **Backend**: Rust 2021 edition
- **Frontend**: React 19, TypeScript 5, Vite 6
- **Styling**: Tailwind CSS 4 (utility-first, dark theme)
- **UI components**: Radix UI primitives, Tabler icons (`@tabler/icons-react`)
- **State management**: Zustand 5 (stores in `src/renderer/stores/`)
- **Markdown**: react-markdown + remark-gfm
- **Virtualization**: @tanstack/react-virtual
- **Diffing**: diff + @pierre/diffs
- **Terminal**: xterm + @xterm/addon-fit + portable-pty (Rust)
- **Code highlighting**: Shiki
- **Build**: Vite (renderer), Cargo (Rust backend), bun as package manager
- **Protocol**: agent-client-protocol crate for ACP subprocess management
- **Rust crates**: git2 (libgit2 bindings), thiserror (error types), which (binary detection), serde_yaml (YAML parsing), confy (config persistence), tauri-plugin-log (Rust→WebView log forwarding)
- **Analytics**: recharts (chart rendering), custom analytics store + aggregators
- **Testing**: Vitest + jsdom (frontend), cargo test (Rust), bunfig.toml redirects `bun test` to noop to avoid runner conflict

## Project structure

```
src/
├── renderer/                # React frontend
│   ├── main.tsx             # React entry
│   ├── App.tsx              # Root layout
│   ├── types/index.ts       # Shared types (TaskStatus, AgentTask, etc.)
│   ├── lib/
│   │   ├── ipc.ts           # Tauri invoke/listen wrappers
│   │   ├── timeline.ts      # Timeline rendering logic
│   │   ├── analytics.ts     # Analytics event tracking
│   │   ├── connection-health.ts  # Connection health monitoring
│   │   ├── connection-state.ts   # Connection state machine
│   │   ├── diffRendering.ts      # Diff rendering utilities
│   │   ├── fuzzy-search.ts       # Fuzzy search for command palette
│   │   ├── history-store.ts      # Navigation history
│   │   ├── thread-db.ts          # Thread persistence (IndexedDB)
│   │   ├── tool-call-collapsing.ts # Tool call grouping logic
│   │   ├── timeline-stability.ts # Timeline deduplication
│   │   ├── proposed-plan.ts      # Plan mode utilities
│   │   ├── question-parser.ts    # AskUserQuestion parsing
│   │   ├── sounds.ts             # Notification sounds
│   │   └── utils.ts              # cn() helper
│   ├── hooks/
│   │   ├── useSlashAction.ts     # Client-side slash command handler
│   │   ├── useChatInput.ts       # Chat input state + submission
│   │   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
│   │   ├── useAttachments.ts     # File attachment handling
│   │   ├── useFileMention.ts     # @ file mention autocomplete
│   │   ├── useMessageSearch.ts   # In-thread message search
│   │   ├── useSidebarTasks.ts    # Sidebar task list logic
│   │   ├── useUpdateChecker.ts   # App update polling
│   │   ├── useSessionTracker.ts  # Session analytics tracking
│   │   ├── useResizeHandle.ts    # Panel resize drag handle
│   │   ├── useModifierKeys.ts    # Modifier key state
│   │   ├── useResolvedTheme.ts   # Theme resolution (system/light/dark)
│   │   ├── useProjectIcon.ts     # Project favicon/icon
│   │   ├── useCopyToClipboard.ts # Clipboard utility
│   │   ├── useCommitOnBlur.ts    # Auto-commit on blur
│   │   ├── useMediaQuery.ts      # CSS media query hook
│   │   └── useZoomLimit.ts       # Window zoom constraints
│   ├── stores/
│   │   ├── taskStore.ts          # Tasks, streaming, connection state
│   │   ├── task-store-types.ts   # TaskStore type definitions
│   │   ├── task-store-listeners.ts # ACP event → store updates
│   │   ├── task-store-selectors.ts # Memoized task selectors
│   │   ├── settingsStore.ts      # Agent profiles, models, appearance
│   │   ├── analyticsStore.ts     # Usage analytics aggregation
│   │   ├── claudeConfigStore.ts  # Claude CLI config (.claude/)
│   │   ├── diffStore.ts          # Diff viewer state
│   │   ├── debugStore.ts         # Debug panel state (Rust logs)
│   │   ├── jsDebugStore.ts       # JS console intercept state
│   │   ├── fileTreeStore.ts      # File tree expansion state
│   │   ├── filePreviewStore.ts   # File preview modal state
│   │   ├── updateStore.ts        # App update state
│   │   └── vcsStatusStore.ts     # VCS dirty-file status
│   └── components/
│       ├── ui/              # Radix-based primitives (button, input, dialog, etc.)
│       ├── chat/            # ChatPanel, MessageList, ChatInput, SlashPanels, etc.
│       ├── sidebar/         # TaskSidebar, WorktreePanel, MemoryFileEditor
│       ├── code/            # DiffViewer, DiffToolbar, DebugLog
│       ├── dashboard/       # Dashboard, TaskCard
│       ├── settings/        # SettingsPanel, hooks-section, permissions-section
│       ├── diff/            # DiffPanel
│       ├── debug/           # DebugPanel, JsDebugTab
│       ├── task/            # NewProjectSheet
│       ├── analytics/       # Charts (CodingHours, DiffStats, Messages, etc.)
│       ├── file-tree/       # File tree browser
│       ├── unified-title-bar/ # Platform-specific title bars (macOS/Win/Linux)
│       ├── icons/           # Custom SVG icon components
│       ├── AppHeader.tsx
│       ├── CommandPalette.tsx
│       ├── ErrorBoundary.tsx
│       ├── Onboarding.tsx   # Multi-step onboarding flow
│       ├── PlanSidebar.tsx  # Plan mode sidebar
│       ├── WhatsNewDialog.tsx
│       └── UpdateAvailableDialog.tsx
src-tauri/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri app setup, command registration, window events
│   └── commands/
│       ├── transport.rs     # ACP transport layer (kiro-cli subprocess, !Send futures)
│       ├── error.rs         # Shared AppError type (thiserror)
│       ├── pty.rs           # Terminal emulation (portable-pty)
│       ├── git.rs           # Core git operations via git2
│       ├── git_ai.rs        # AI-assisted git (commit message generation)
│       ├── git_history.rs   # Git log / blame
│       ├── git_pr.rs        # Pull request operations
│       ├── git_stack.rs     # Stacked diff / branch stack
│       ├── git_utils.rs     # Shared git helpers
│       ├── branch_ai.rs     # AI branch name suggestion
│       ├── pr_ai.rs         # AI PR description generation
│       ├── settings.rs      # Config persistence via confy
│       ├── fs_ops.rs        # File ops, kiro-cli detection (which crate)
│       ├── claude_config.rs # .claude/ config read/write
│       ├── claude_watcher.rs # .claude/ config file watcher
│       ├── analytics.rs     # Usage analytics collection
│       ├── thread_db.rs     # Thread persistence backend
│       ├── thread_title.rs  # AI thread title generation
│       ├── checkpoint.rs    # Checkpoint / snapshot management
│       ├── diff_parse.rs    # Diff parsing utilities
│       ├── diff_stats.rs    # Diff statistics
│       ├── streaming_diff.rs # Streaming diff application
│       ├── highlight.rs     # Syntax highlighting (Shiki bridge)
│       ├── markdown.rs      # Markdown rendering utilities
│       ├── fuzzy.rs         # Fuzzy search backend
│       ├── pattern_extract.rs # Pattern extraction from diffs
│       ├── permissions.rs   # Permission allowlist management
│       ├── process_diagnostics.rs # Running process inspection
│       ├── project_watcher.rs # File system project watcher
│       ├── retry.rs         # Retry logic utilities
│       ├── statusline.rs    # Status line data provider
│       ├── tracing.rs       # Rust tracing / log forwarding
│       ├── vcs_status.rs    # VCS dirty-file status
│       └── serde_utils.rs   # Serde helpers
├── Cargo.toml
├── tauri.conf.json
└── capabilities/            # Tauri v2 permission capabilities
```

## Commands

```bash
bun run dev             # Start dev (Vite + Tauri, uses tauri.dev.conf.json)
bun run dev:renderer    # Start Vite only (no Tauri shell)
bun run build           # Production build (.app + .dmg)
bun run build:renderer  # Vite bundle only
bun run check           # check:ts + check:rust
bun run check:ts        # TypeScript type check (tsc --noEmit)
bun run check:rust      # Rust type check (cargo check)
bun run check:web       # tsc + vite build (bundle-safe TS check)
bun run check:bundle    # Bundle size budget check
bun run lint            # oxlint on src/
bun run test            # vitest run + cargo test
bun run test:ui         # Vitest (frontend unit tests, jsdom)
bun run test:coverage   # Vitest with coverage report
bun run test:rust       # cargo test
bun run clean           # Remove dist/ + cargo clean
bun run bump:patch      # Bump patch version
bun run bump:minor      # Bump minor version
bun run bump:major      # Bump major version
bun run release         # Full release script
```

## Architecture decisions

- **Tauri IPC**: All frontend↔backend communication uses `invoke()` for commands and `listen()` for events. No direct Node.js APIs.
- **ACP on dedicated OS threads**: The ACP Rust SDK uses `!Send` futures, so each connection runs on a dedicated OS thread with a single-threaded tokio runtime + `LocalSet`. Communication with the Tauri async runtime happens via `mpsc` channels. Transport logic lives in `commands/transport.rs`.
- **Permission handling**: Permission requests from ACP go through a `oneshot` channel. The permission handler runs on the Tauri async runtime and accesses managed state via `app.try_state::<AcpState>()`, not a cloned copy. Allowlist management is in `commands/permissions.rs`.
- **State**: Zustand stores are the single source of truth. No Redux, no Context for global state.
- **Styling**: Tailwind utility classes only. No custom CSS files for components. Theme tokens in `src/tailwind.css`.
- **Components**: Radix UI primitives with `class-variance-authority` for variants, `clsx` + `tailwind-merge` via `cn()` helper.
- **Path aliases**: `@/*` maps to `./src/renderer/*` (configured in tsconfig.json and vite.config.ts).

## Conventions

- Use `const` arrow functions for components and handlers
- Prefix event handlers with `handle` (e.g., `handleClick`, `handleKeyDown`)
- Prefix boolean variables with verbs (`isLoading`, `hasError`, `canSubmit`)
- Use kebab-case for file names, PascalCase for components, camelCase for variables/functions
- One export per file for components
- Early returns for readability
- Accessibility: semantic HTML, ARIA attributes, keyboard navigation
- Icons: use `@tabler/icons-react` exclusively. Never use `lucide-react`. Tabler icons use the `Icon` prefix (e.g., `IconPlus`, `IconCheck`, `IconChevronDown`).
- Conventional Commits for git messages (`feat:`, `fix:`, `chore:`, etc.)
- Every commit must include: `Co-authored-by: Klaudex <274876363+klaudex@users.noreply.github.com>`

## Build validation

A task is not done until both pass with zero errors:

```bash
bun run check:ts      # TypeScript (fast, no bundle)
bun run check:web     # TypeScript + Vite bundle (catches import errors)
bun run test:ui       # Frontend unit tests
```

## Critical rules

- Never revert, discard, or `git checkout --` changes without explicit user confirmation
- Never run destructive git operations without being told to
- Always use Tailwind classes for styling; no inline CSS or `<style>` tags
- Keep the activity log updated in `activity.md`

---

## Engineering learnings

### Tauri + ACP concurrency model

The `agent-client-protocol` crate produces `!Send` futures. You cannot run them on the default multi-threaded tokio runtime. The solution: spawn a `std::thread` per ACP connection, create a `tokio::runtime::Builder::new_current_thread()` runtime inside it, and use `tokio::task::LocalSet::block_on()`. Commands from the Tauri async runtime reach the connection thread via `mpsc::unbounded_channel`. This pattern is stable and avoids all `Send` bound issues.

### Permission resolvers must use managed Tauri state

Early versions cloned the `AcpState` into the permission handler closure. This created a second copy; when `task_allow_permission` / `task_deny_permission` commands looked up the resolver in the managed state, it wasn't there. Fix: the permission handler accesses state via `app.try_state::<AcpState>()` so it reads/writes the same instance the Tauri commands use.

### ACP notifications need method normalization

The ACP SDK sometimes prefixes ext_notification methods with an underscore (e.g., `_kiro.dev/commands/available`). Always strip the leading `_` before matching: `method.strip_prefix('_').unwrap_or(method)`.

### Backend task updates wipe client-side messages

The ACP backend sends `task_update` events with `messages: []` because it doesn't track message history; only the client does. If `upsertTask()` does a full object replacement, every status change wipes all locally-accumulated messages. Fix: preserve existing messages when the incoming task has an empty messages array.

### Zustand store performance patterns

- **Bail-out guards**: Every setter should check if the value actually changed before calling `set()`. Without this, every ACP event triggers a React re-render even when nothing changed.
- **Batch multi-field updates**: Use a single `setState` callback instead of multiple `getState()` + `set()` calls. Multiple `getState()` calls can read stale data between them.
- **rAF batching for high-frequency events**: Debug log entries and streaming chunks arrive at hundreds per second. Buffer them and flush once per `requestAnimationFrame` using `concat + slice` instead of per-entry array copies.
- **Extract streaming selectors**: The ChatPanel was re-rendering on every streaming token. Extracting a `StreamingMessageList` child component that owns the four streaming selectors (`streamingChunk`, `liveToolCalls`, `liveThinking`, `messages`) isolates re-renders to the child only.

### Dead code traps in component wiring

Adding logic to a component file that is never imported is a silent failure. The `DiffPanel.tsx` had `focusFile` logic but was dead code; the actual panel used `CodePanel` → `DiffViewer`. Always verify the import chain before adding features to a component.

### Slash commands: client-side vs pass-through

Some slash commands (`/clear`, `/model`, `/agent`) are handled entirely on the client. Others (`/plan`, `/chat`) need both a client-side action (mode switch, system message) and a backend sync (`ipc.setMode()`). The `useSlashAction` hook returns `{ handled: boolean }` so the caller knows whether to send the command to ACP.

### Forward all ACP notification data

The `commands/available` notification includes `mcpServers` with live `toolCount` and `status`, but the Rust backend initially only forwarded the `commands` array. Always forward the full notification payload (or at least all fields the frontend needs) rather than cherry-picking.

### Window cleanup on close

Tauri's `on_window_event` with `CloseRequested` is the place to kill ACP connections and PTY sessions. Drain the connections map and send `AcpCommand::Kill` to each, then clear the PTY state. Without this, orphaned `kiro-cli` processes survive after the app closes.

### probe_capabilities guard

`probe_capabilities` (which calls `list_models`) can be triggered multiple times during startup. Without an `AtomicBool` guard (`probe_running`), concurrent calls spawn duplicate ACP connections. Use `compare_exchange` to ensure only one probe runs at a time.

### Vite watch ignores

Add `README.md`, `activity.md`, and `src-tauri/**` to Vite's `server.watch.ignored` list. Otherwise, editing docs or Rust files triggers unnecessary frontend rebuilds.

### Tauri v2 state management

Always use `app.manage()` for shared state and access via `State<'_, T>` in commands. Never clone state into closures when the state needs to be shared across commands; use `app.try_state::<T>()` from the app handle instead.

### Rust error handling in Tauri commands

Tauri commands return `Result<T, AppError>` where `AppError` is a `thiserror` enum in `commands/error.rs`. It has `From` impls for `git2::Error`, `io::Error`, `serde_json::Error`, `confy::ConfyError`, and `PoisonError`, so `?` works directly. `AppError` implements `Serialize` for Tauri IPC. Exception: `acp.rs` still uses `Result<T, String>` because the ACP SDK's own error types and `!Send` async constraints make conversion impractical.

### Prefer community crates over shelling out

Use `git2` instead of `Command::new("git")` for git operations. Use `which::which()` instead of `Command::new("which")`. Use `confy` instead of hand-rolled JSON persistence. Use `serde_yaml` instead of string matching for YAML frontmatter. Shelling out is fragile (PATH dependency), slow (process spawn), and loses structured error info.

### React 19 + Zustand selector discipline

Always use selectors (`useStore(s => s.field)`) instead of `useStore()` to prevent full-store re-renders. For derived state, use `useMemo` over computing in render. Combine with `shallow` equality when selecting multiple fields.

### localStorage in Zustand store init

`localStorage.getItem()` and `setItem()` throw in private browsing, incognito, or quota-exceeded contexts. Always wrap in try-catch. For store init, use an IIFE: `(() => { try { return localStorage.getItem(key) } catch { return null } })()`. For setters, wrap in try-catch with `console.warn` fallback so the in-memory state still updates even if persistence fails.

### Module-level mutable variables in React hooks

A `let pendingUpdate` at module scope persists across component remounts and can reference a stale object from a previous mount. Use `useRef` instead to tie the mutable reference to the component instance lifecycle. This prevents version mismatches when the hook unmounts and remounts.

### import type for dynamically-imported modules

When a module is dynamically imported at runtime (`await import('@tauri-apps/plugin-updater')`) but you need its types at compile time for a `useRef<Update | null>`, use `import type { Update }` to avoid bundling the module eagerly while still getting type safety.

### IPC event cleanup

Always return the unlisten function from `listen()` calls inside `useEffect` cleanup. Leaked listeners cause memory leaks and duplicate event handling. Pattern: `const unlisten = await listen(...); return () => { unlisten(); };`

### PTY process lifecycle

Always kill PTY child processes on window close and on connection teardown. Check `child.try_wait()` before sending signals to avoid signaling already-dead processes. Clean up the reader thread when the PTY is destroyed.

### Git command injection prevention

When building git commands from user input (branch names, commit messages), validate and sanitize inputs. Never interpolate raw user strings into shell commands. Use `Command::arg()` instead of shell string concatenation to avoid injection. With `git2`, this is no longer a concern since the library API handles escaping.

### Tauri CSP blocks inline scripts

Tauri's CSP (`script-src 'self'`) blocks inline `onclick` handlers and `<script>` tags in HTML. Attach event listeners via bundled JS (`addEventListener`) instead. The `index.html` error fallback reload button must use this pattern.

### oklch() CSS colors fail in older WebKit

Tauri's WebKit webview may not support `oklch()` color syntax. When it fails, the browser renders bright magenta/pink (the "invalid value" fallback). Use hex color values for CSS custom properties instead.

### Dark theme class must be applied before React renders

If the app uses a `.dark` CSS class for theme variables, add `class="dark"` to `<html>` in `index.html` AND set it in `main.tsx` before `ReactDOM.createRoot()`. Without both, there's a white flash or the app renders in light mode.

### Splash screen pattern for Tauri

Add a `#splash` div in `index.html` (pure HTML/CSS, no JS dependency) that shows immediately when the window opens. In `main.tsx`, after React renders, fade it out with `opacity: 0` transition and remove on `transitionend`. This gives instant visual feedback while the JS bundle loads.

### Cancel tasks before deleting them

When deleting a thread or removing a project, call `ipc.cancelTask()` before `ipc.deleteTask()` to stop any running agent. The cancel is fire-and-forget with `.catch(() => {})` so it's a no-op for already-stopped tasks.

### confy changes the config file location

`confy` stores config at its own XDG/macOS-standard path (e.g., `~/Library/Application Support/rs.klaudex/default-config.toml` on macOS), not the previous custom path. If migrating from hand-rolled persistence, existing settings at the old path won't be found. Consider a one-time migration or document the new location.

### upsertTask must preserve client-side name

The ACP backend sends `task_update` events carrying the original creation-time name. If `upsertTask` spreads the backend object as the base, every status change overwrites user renames. Fix: when the task already exists locally, always keep the client-side `name`. This follows the same pattern used for `messages` and `parentTaskId` preservation.

### Soft-deleted threads reappear after app restart

`loadTasks` builds the task map from `listTasks()` ACP responses. If `deletedTaskIds` isn't populated from persisted soft-deleted thread IDs before `upsertTask` runs, deleted threads get re-added. Fix: populate `deletedTaskIds` from persisted storage first, then filter them out of the task map during `loadTasks`.

### `bun test` vs `bun run test` runner mismatch

`bun test` invokes Bun's native test runner, which doesn't provide jsdom. `bun run test` invokes Vitest (configured with jsdom). Running `bun test` causes all component tests to fail with `ReferenceError: document is not defined`. Fix: add `bunfig.toml` with `[test] root = ".bun-test-noop"` to redirect Bun's native runner away from Vitest test files.

### Clean up orphaned worktrees on setup failure

If `gitWorktreeSetup` fails after the worktree directory was partially created, the orphaned directory remains on disk. Any component that calls worktree setup must catch the error and call `gitWorktreeRemove` to clean up. This applies to both `PendingChat` and `WorktreePanel`.

### Stamp context on debug entries at creation time

Debug entries (JS console, network, Rust logs) should capture `threadName` and `projectName` from the active task at creation time, not look them up from the task store at render time. Tasks can be deleted or archived after the entry was created, making render-time lookups return nothing and breaking filter functionality.

### tauri-plugin-log for Rust-to-WebView log forwarding

Use `tauri-plugin-log` with `LogTarget::Webview` to forward Rust `log::info!()` / `log::error!()` calls to the frontend JS context. Requires adding `log:default` to the Tauri capabilities file. The frontend listens via the plugin's `onEvent` API and can display Rust logs alongside JS console output.

### GitHub Markdown strips block elements inside `<p>` tags

Block-level HTML elements (`<table>`, `<div>`, `<pre>`) nested inside `<p>` tags are invalid HTML. GitHub's Markdown renderer strips them, hiding the content. Always place block-level elements outside `<p>` tags in README and other GitHub-rendered Markdown files.

### ToolProgress messages must be forwarded as tool_call_update events

The Claude CLI emits `ToolProgress` ndjson messages carrying live tool output before the `tool_result` arrives. Previously these were silently dropped. Now `handle_claude_message` matches `ClaudeMessage::ToolProgress`, extracts `tool_use_id` and `content` from the `extra` map, and emits a `tool_call_update` Tauri event with `status: "in_progress"`. This lets the frontend render live tool output (e.g. bash stdout) as it streams rather than waiting for the final result.

### usage_update must include the full token breakdown

The `Result` message handler previously emitted only the aggregate `used` count. The `StatsPanel` token breakdown (input / output / cache read / cache creation) showed blank after a turn ended because those fields were absent from the final `usage_update`. Fix: extract all four token fields from `res.usage` and include them as `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens` in the emitted JSON. The `ipc.onUsageUpdate` type was updated to reflect these optional fields.

### Turn duration tracking via turn_start_ms in handle_claude_message

`handle_claude_message` takes a `turn_start_ms: &mut Option<u64>` parameter. On `MessageStart` it records the current epoch-millisecond timestamp (only if not already set, so only the first `MessageStart` of a turn counts). On `Result` it calls `.take()` on the option, computes `now - start` with `saturating_sub`, and includes `turnDurationMs` in the `turn_end` event. `applyTurnEnd` receives it as an optional parameter and stores it as `lastTurnDurationMs` on `AgentTask`. Using `take()` resets the option automatically so the next turn starts fresh.

### pauseAndRedirect owns the full pause sequence

Three places previously duplicated pause logic with subtle differences (pause button vs Escape vs keyboard shortcut). Consolidated into a single `pauseAndRedirect(taskId)` store action that calls `ipc.pauseTask()`, `clearTurn()`, sets `needsNewConnection: true`, and emits an `agent-paused` event. All callers use this action. Never split pause logic across call sites.

### applyTurnEnd must check needsNewConnection to avoid status clobbering

`AcpCommand::Cancel` (sent by `task_pause`) causes the backend to emit `turn_end` with `stopReason: "cancelled"`. `applyTurnEnd` would map this to `status: 'cancelled'`, clobbering the `"paused"` status already set by `pauseAndRedirect`. Fix: `applyTurnEnd` checks `task.needsNewConnection`; when true, uses `'paused'` regardless of `stopReason`. The `needsNewConnection` flag is set synchronously before any backend events arrive, so this check is always safe.

### TodoWrite tool has different shape than custom todo_list tool

Claude's built-in `TodoWrite` tool arrives with `rawInput.todos` (array of `{ id, content, status, priority }`), while the custom `todo_list` MCP tool uses `{ completed, task_description }`. `isTaskListToolCall` must match both: `title === 'Update TODOs'` or `rawInput.todos` array presence. `extractTasks` normalises both shapes to a common format. `aggregateLatestTasks` treats `TodoWrite` as a full replacement (clear + repopulate) since each call carries complete state.

### Bundle local fonts to satisfy Tauri CSP

Tauri's `style-src 'self'` CSP blocks external font URLs (Google Fonts, fonts.gstatic.com). Download font files to `public/fonts/` and declare `@font-face` in `tailwind.css` pointing to local paths. Never add external font `<link>` tags to `index.html` in a Tauri app.

### MCP tool names are humanised in tool_title_and_kind

Tools arriving as `mcp__server__tool_name` were previously displayed verbatim. The `tool_title_and_kind` fallback arm now strips the `mcp__` prefix, splits on the first `__` to separate server from tool name, replaces underscores with spaces in the tool portion, and formats as `"server: tool name"`. Non-MCP unknown tools also get underscore-to-space replacement. The first short string argument (≤ 120 chars) from the input JSON is appended as context. Empty tool names fall back to `"Tool"`.

## Activity log

After completing any task, update `activity.md` at the project root before finishing.

Each entry must include:
- A timestamp heading in Dubai time: `## YYYY-MM-DD HH:MM GST (Dubai)`
- A short descriptive title: `### Component: What changed`
- A one to three sentence summary of what was done
- A `**Modified:**` line listing changed files

Prepend new entries to the top of the file. Create the file if it doesn't exist.
