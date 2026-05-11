# CLAUDE.md — Klaudex

## Project overview

Klaudex is a native macOS desktop app for managing AI coding agents via the Agent Client Protocol (ACP). It features a chat interface, task management, diff viewer, integrated terminal, git operations, and a settings panel. Built with Tauri v2 (Rust backend) and React 19 (TypeScript frontend).

## Tech stack

- **Desktop framework**: Tauri v2 (Rust backend, WebView frontend) — macOS, Windows, Linux
- **Backend**: Rust 2021 edition
- **Frontend**: React 19, TypeScript 5, Vite 6
- **Styling**: Tailwind CSS 4 (utility-first, dark/light theme)
- **UI components**: Radix UI primitives, Tabler icons (`@tabler/icons-react`)
- **State management**: Zustand 5 (stores in `src/renderer/stores/`)
- **Markdown**: react-markdown + remark-gfm
- **Virtualization**: @tanstack/react-virtual
- **Diffing**: diff + @pierre/diffs + imara-diff (Rust, fast Myers/Histogram)
- **Terminal**: xterm + @xterm/addon-fit + portable-pty (Rust)
- **Code highlighting**: Shiki (frontend) + syntect (Rust backend)
- **Build**: Vite (renderer), Cargo (Rust backend), bun as package manager
- **Protocol**: agent-client-protocol crate for ACP subprocess management
- **Rust crates**: git2 (libgit2), thiserror, which, serde_yaml, confy, redb (embedded KV), rusqlite (bundled SQLite), nucleo-matcher (fuzzy search), pulldown-cmark (markdown), blake3 (hashing), reqwest (HTTP), tauri-plugin-{log,store,updater,notification,process,dialog}, notify (fs watching), parking_lot, window-vibrancy

## Project structure

```
src/
├── renderer/                # React frontend
│   ├── main.tsx             # React entry
│   ├── App.tsx              # Root layout
│   ├── types/index.ts       # Shared types (TaskStatus, AgentTask, etc.)
│   ├── lib/                 # Utilities and business logic (40+ modules)
│   │   ├── ipc.ts           # Tauri invoke/listen wrappers
│   │   ├── timeline.ts      # Timeline rendering logic
│   │   ├── analytics.ts     # Analytics collection/aggregation
│   │   ├── thread-db.ts     # Thread persistence (SQLite via Tauri)
│   │   ├── connection-state.ts  # Connection health/state machine
│   │   ├── fuzzy-search.ts  # nucleo-based fuzzy matching
│   │   ├── sounds.ts        # Audio feedback
│   │   └── utils.ts         # cn() helper + misc
│   ├── hooks/               # 20+ custom hooks
│   │   ├── useSlashAction.ts      # Client-side slash command handler
│   │   ├── useChatInput.ts        # Chat input state + attachments
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useSidebarTasks.ts     # Sidebar task filtering/grouping
│   │   ├── useUpdateChecker.ts    # Auto-update polling
│   │   └── useResolvedTheme.ts    # Dark/light theme resolution
│   ├── stores/
│   │   ├── taskStore.ts           # Tasks, streaming, connection state
│   │   ├── task-store-selectors.ts # Memoized selectors
│   │   ├── task-store-listeners.ts # IPC event subscriptions
│   │   ├── task-store-types.ts    # Store type definitions
│   │   ├── settingsStore.ts       # Agent profiles, models, appearance
│   │   ├── claudeConfigStore.ts   # Claude config (~/.claude/) state
│   │   ├── diffStore.ts           # Diff viewer state
│   │   ├── debugStore.ts          # Debug panel state (JS + Rust logs)
│   │   ├── jsDebugStore.ts        # JS console interceptor state
│   │   ├── fileTreeStore.ts       # File tree expand/selection state
│   │   ├── filePreviewStore.ts    # Global file preview modal state
│   │   ├── analyticsStore.ts      # Usage analytics state
│   │   ├── updateStore.ts         # App update state
│   │   └── vcsStatusStore.ts      # Git VCS status polling
│   └── components/
│       ├── ui/              # Radix-based primitives (button, input, dialog, etc.)
│       ├── chat/            # ChatPanel, MessageList, ChatInput, PermissionBanner,
│       │                    #   PendingChat, WorktreePanel, SplitChatLayout, etc. (60+ files)
│       ├── sidebar/         # TaskSidebar, ClaudeConfigPanel, WorktreeCleanupDialog,
│       │                    #   MemoryFileEditor, IconPickerDialog, etc.
│       ├── settings/        # SettingsPanel + section components (appearance, hooks,
│       │                    #   permissions, keymap, memory, archives, etc.)
│       ├── code/            # CodePanel, DiffViewer, DiffFileActionBar, DiffFileSidebar
│       ├── diff/            # DiffPanel, CheckpointTimeline, GitHistoryPanel
│       ├── debug/           # DebugLog
│       ├── task/            # NewProjectSheet
│       ├── dashboard/       # Dashboard, TaskCard
│       ├── analytics/       # AnalyticsDashboard + chart components
│       ├── file-tree/       # FileTreePanel, FilePreviewModal, FileTypeIcon
│       ├── icons/           # ClaudeIcon, KlaudexGhostIcon
│       ├── unified-title-bar/ # Per-platform title bars (macOS/Windows/Linux)
│       ├── AppHeader.tsx
│       ├── CommandPalette.tsx
│       ├── ErrorBoundary.tsx
│       ├── Onboarding.tsx   # Multi-step onboarding flow
│       ├── PlanSidebar.tsx
│       ├── MarkdownViewer.tsx
│       └── GlobalFilePreviewModal.tsx
website/                     # Marketing/docs website (Bun, standalone)
scripts/                     # Build/release scripts (bump-version.sh, release.sh, etc.)
src-tauri/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Tauri app setup, command registration, window events
│   └── commands/            # 40+ Rust modules
│       ├── acp/             # ACP protocol (kiro-cli subprocess management)
│       ├── error.rs         # Shared AppError type (thiserror)
│       ├── pty.rs           # Terminal emulation (portable-pty)
│       ├── git.rs           # Core git operations via git2
│       ├── git_ai.rs        # AI-assisted git (commit messages, etc.)
│       ├── git_pr.rs        # PR creation/management
│       ├── git_history.rs   # Commit history queries
│       ├── git_stack.rs     # Stacked diffs / branch stack
│       ├── git_utils.rs     # Shared git helpers
│       ├── settings.rs      # Config persistence via confy
│       ├── fs_ops.rs        # File ops, kiro-cli detection
│       ├── claude_config.rs # ~/.claude/ config reading/writing
│       ├── claude_watcher.rs # fs_notify watcher for claude config
│       ├── thread_db.rs     # SQLite thread persistence (rusqlite)
│       ├── checkpoint.rs    # Conversation checkpoints
│       ├── analytics.rs     # Usage analytics aggregation
│       ├── fuzzy.rs         # nucleo-matcher fuzzy search
│       ├── highlight.rs     # syntect syntax highlighting
│       ├── markdown.rs      # pulldown-cmark rendering
│       ├── diff_parse.rs    # Diff parsing (imara-diff)
│       ├── diff_stats.rs    # Diff statistics
│       ├── streaming_diff.rs # Live streaming diff computation
│       ├── transport.rs     # HTTP transport (reqwest)
│       ├── permissions.rs   # ACP permission management
│       ├── statusline.rs    # Status line data aggregation
│       ├── vcs_status.rs    # Git working tree status
│       ├── project_watcher.rs # File system project watching
│       ├── tracing.rs       # Rust tracing/logging setup
│       ├── pattern_extract.rs # Pattern extraction utilities
│       ├── thread_title.rs  # Auto-generate thread titles
│       ├── branch_ai.rs     # AI branch name suggestions
│       ├── pr_ai.rs         # AI PR description generation
│       └── process_diagnostics.rs # Process health checks
├── Cargo.toml
├── tauri.conf.json
├── tauri.dev.conf.json      # Dev-mode overrides
└── capabilities/            # Tauri v2 permission capabilities
```

## Commands

```bash
bun run dev                # Start dev (Vite + Tauri, dev config)
bun run dev:renderer       # Vite only (no Tauri)
bun run build              # Production build (.app + .dmg)
bun run check:ts           # TypeScript type check
bun run check:rust         # Rust type check (cargo check)
bun run check              # Both TS + Rust checks
bun run check:web          # TS check + Vite bundle build
bun run check:bundle       # Bundle size audit (scripts/check-bundle-size.mjs)
bun run lint               # oxlint on src/
bun run test:rust          # Run Rust tests
bun run test:ui            # Vitest (frontend tests)
bun run test:coverage      # Vitest with coverage
bun run test               # All tests (Vitest + Rust)
bun run clean              # Remove build artifacts
bun run bump               # Patch version bump
bun run bump:patch/minor/major  # Targeted version bumps
bun run release            # Full release (scripts/release.sh)
bun run website:dev        # Start website dev server
bun run website:build      # Build website
```

## Architecture decisions

- **Tauri IPC**: All frontend↔backend communication uses `invoke()` for commands and `listen()` for events. No direct Node.js APIs.
- **ACP on dedicated OS threads**: The ACP Rust SDK uses `!Send` futures, so each connection runs on a dedicated OS thread with a single-threaded tokio runtime + `LocalSet`. Communication with the Tauri async runtime happens via `mpsc` channels.
- **Permission handling**: Permission requests from ACP go through a `oneshot` channel. The permission handler runs on the Tauri async runtime and accesses managed state via `app.try_state::<AcpState>()`, not a cloned copy.
- **Thread persistence**: Threads are stored in SQLite via `rusqlite` (bundled). `redb` is used for fast KV metadata. Both live in the Tauri app data directory.
- **State**: Zustand stores are the single source of truth. No Redux, no Context for global state. Selectors in `task-store-selectors.ts`; IPC listeners wired in `task-store-listeners.ts`.
- **Styling**: Tailwind utility classes only. No custom CSS files for components. Theme tokens in `src/tailwind.css`. Light and dark themes supported.
- **Components**: Radix UI primitives with `class-variance-authority` for variants, `clsx` + `tailwind-merge` via `cn()` helper.
- **Path aliases**: `@/*` maps to `./src/renderer/*` (configured in tsconfig.json and vite.config.ts).
- **Multi-platform title bar**: `unified-title-bar/` has separate macOS (traffic lights), Windows (custom controls), and Linux variants selected at runtime.
- **Claude config integration**: `claude_config.rs` + `claude_watcher.rs` read/watch `~/.claude/` for memory files, hooks, MCPs, skills, and steering docs. `claudeConfigStore.ts` mirrors this state.
- **Analytics**: Usage events collected in `analyticsStore.ts` + `lib/analytics.ts`, aggregated in `lib/analytics-aggregators.ts`, and visualized in `components/analytics/`.
- **File tree**: `fileTreeStore.ts` + `components/file-tree/` provide browseable project file tree with fuzzy search and preview.
- **Worktrees**: Git worktrees are managed for parallel agent sessions. `worktree-cleanup.ts` + `WorktreeCleanupDialog` handle stale worktree removal.
- **Auto-updates**: `tauri-plugin-updater` + `updateStore.ts` + `useUpdateChecker.ts` handle update polling and install.

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
bun run check:ts
bun run check:rust
bun run build         # or: bun run check:web for faster renderer-only check
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

## Activity log

After completing any task, update `activity.md` at the project root before finishing.

Each entry must include:
- A timestamp heading in Dubai time: `## YYYY-MM-DD HH:MM GST (Dubai)`
- A short descriptive title: `### Component: What changed`
- A one to three sentence summary of what was done
- A `**Modified:**` line listing changed files

Prepend new entries to the top of the file. Create the file if it doesn't exist.
