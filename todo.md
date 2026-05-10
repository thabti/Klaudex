# Klaudex TODO

Native macOS desktop client for the Claude Code CLI. Tauri v2 (Rust) + React 19 (TypeScript). Forked from Kirodex; this list tracks what's still open after the kirodex-parity migration plan.

## Current state (2026-05-07)

- Version: 0.2.0 (post-rename, first Klaudex-tagged release)
- Working features: Claude CLI subprocess driver, chat with stream-JSON, task management, git ops (git2), PTY terminal, settings, diff viewer, analytics dashboard (redb), dual-scope `.claude` config watcher, slash commands, file mentions, conversation history persistence, keyboard shortcuts
- Active branch: `feat/kirodex-parity` — wraps up TASK-050/052/054/055 docs/release-pipeline scaffolding

## Short-term polish

Concrete cleanups deferred from the kirodex-parity plan or known stale spots that don't block parity but should be picked up next.

- [ ] **TASK-002 / TASK-003 — live Claude-CLI smoke verification.** The subprocess swap in `2fe68da` was unit-tested but never exercised end-to-end against a real `claude` binary on a fresh macOS install. Reproduce the full first-run path (no `~/.claude/`, no auth) and confirm `commands/acp/connection.rs` surfaces the auth-needed state without panicking.
- [ ] **TASK-031 — ModeUsageChart.** The chart slot is wired in `src/renderer/components/analytics/AnalyticsDashboard.tsx` but the `ModeUsageChart` component itself is still a placeholder. Implement it on top of the existing `analytics-aggregators.ts` `aggregateByMode` helper and the recharts stack already used by `TokenUsageChart`.
- [ ] **`AcpSubagentDisplay.tsx` undefined-`i` test-id bug.** Line 136 renders `data-testid={`acp-agent-${agent.name || i}`}` where `i` is not in scope (the surrounding `AgentCard` component takes only `agent` and `isDimmed`). Either drop the fallback or thread the index through from the parent map. Fails silently today because `agent.name` is always populated, but breaks any test that mounts an unnamed agent.
- [ ] **TASK-009 — dock-icon image-swap variant.** The dev-vs-prod dock icon swap currently relies on Tauri's bundle config swap; the alternate runtime-swap variant via `NSApplication.setApplicationIconImage` was scoped but not shipped. Decide whether we still want it (the bundle approach works) and either implement or close the task.
- [ ] **`ChatPanel` per-panel `taskId` prop.** Wave-3 SplitChatLayout report flagged that `ChatPanel.tsx` still reads the active task id from the global `taskStore` instead of accepting one as a prop. Threading a prop unblocks proper isolation when both split panes show different threads.
- [ ] **`confy` migration path for renamed app id.** The bundle id moved from `rs.kirodex` to `rs.klaudex`, so existing Kirodex users lose all settings on upgrade (see "confy changes the config file location" learning in CLAUDE.md). Add a one-shot migration in `commands/settings.rs` that reads the legacy path on first launch and copies it into the new location.

## Medium-term roadmap

Post-parity Claude-specific features. Each item is a real product gap, not a vague polish bullet.

- [ ] **Sub-agent orchestration UI.** `AcpSubagentDisplay.tsx` already renders the live tree of in-flight sub-agents that Claude spawns, but there is no way to pause, kill, or re-prompt an individual sub-agent from the UI. Build a per-row action menu wired to a new `subagent_cancel` command in `commands/acp/`.
- [ ] **Claude Skills surfacing.** The user actively maintains `~/.claude/skills/` (commit, find-bugs, plan-to-task-list-with-dag, etc.) and project-level skills in `.claude/skills/`, but Klaudex's slash-command picker only lists `commands/`. Extend `claude_config.rs` to discover skills and render them in `SlashPanels` with a distinct skill icon and the skill's `description` frontmatter.
- [ ] **Skill execution from the chat input.** Once skills are surfaced, the picker should invoke them by sending the skill's prompt template to Claude with the user's args interpolated. Implement in `useSlashAction.ts`; today the hook only handles built-in `/clear`, `/model`, `/agent`.
- [ ] **MCP server status drawer.** `claude_watcher.rs` already emits MCP server status changes (running / stopped / error). Add a status drawer accessible from the header that lists every MCP server from the merged config with its scope (global vs project) and last-seen status, so users can debug MCP failures without dropping to the terminal.
- [ ] **Agent profile import from `~/.claude/agents/*.md`.** The settings panel still treats agent profiles as Klaudex-internal entities; we should auto-discover Claude's agent definitions and let the user pin a default per-project. Read paths via `claude_config.rs`, render in `settings/AgentSection.tsx`.
- [ ] **Plan-mode handoff to a sub-thread.** When a plan-mode answer set is finalized, spawn a sub-thread parented to the original task (`parent_task_id` is already plumbed) so the implementation chat is separate from the planning chat. Today both share one thread and the message log gets noisy.

## Long-term ideas

- [ ] **Multi-window support.** `lib.rs` is single-window today; Kirodex shipped multi-window via `create_new_window()`. Port the helper, the per-window state isolation, and the macOS traffic-light repositioning. Likely surfaces several taskStore-singleton assumptions that need extracting into a per-window store factory.
- [ ] **Mobile companion app.** A read-only iOS / iPadOS viewer that subscribes to the same analytics + thread feed over a local mDNS-discovered websocket. Useful for kicking off a long-running plan from the desktop and watching it on a tablet. Would need a stable JSON wire format independent of the current Tauri IPC.
- [ ] **Headless Klaudex agent runner.** Strip the WebView and ship a CLI (`klaudex run plan.yml`) that drives Claude through the same subprocess driver and emits structured run logs. Reuses everything in `commands/acp/` minus the Tauri shell. Useful for CI and for users who just want plan-mode-as-a-script.
- [ ] **First-class Linux / Windows build.** The Cargo workspace already compiles on cross-platform Tauri targets, but the icon swap, traffic-light hacks, and PTY terminal styling are macOS-tuned. Decide whether we ship cross-platform officially (Kirodex did) or keep Klaudex macOS-only and document the choice.

## Relevant files

- `src-tauri/src/commands/acp/` - Claude CLI subprocess driver (replaces the agent-client-protocol SDK, ~42KB)
- `src-tauri/src/commands/analytics.rs` - redb-backed event store (~270 LOC)
- `src-tauri/src/commands/claude_watcher.rs` - dual-scope `.claude/` filesystem watcher (~340 LOC)
- `src-tauri/src/commands/claude_config.rs` - config discovery (renamed from `kiro_config.rs`)
- `src-tauri/src/commands/git.rs` - Git operations via git2
- `src-tauri/src/commands/pty.rs` - PTY terminal emulation
- `src-tauri/src/commands/settings.rs` - confy-backed config persistence
- `src-tauri/src/commands/fs_ops.rs` - File ops, `claude` binary detection
- `src-tauri/src/lib.rs` - Tauri app setup, command registration, window events
- `src/renderer/App.tsx` - Root layout
- `src/renderer/stores/taskStore.ts` - Main state store
- `src/renderer/stores/claudeStore.ts` - Merged `~/.claude` + project `.claude/` config state
- `src/renderer/components/chat/` - Chat UI (ChatPanel, MessageList, AcpSubagentDisplay, SplitPanelHeader, SplitDivider, SplitThreadPicker, etc.)
- `src/renderer/components/analytics/` - Analytics dashboard and charts (recharts)
- `src/renderer/components/sidebar/` - Sidebar with task list, ClaudeConfigPanel
- `src/renderer/components/code/` - Code/diff viewer
- `src/renderer/components/settings/SettingsPanel.tsx` - Settings UI
- `plans/klaudex-parity-with-kirodex.md` - Source of truth for the active migration plan
