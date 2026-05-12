## 2026-05-12 21:12 GST (Dubai)
### Store: Add persistUiState and auto-save UI state every 30s

Ported upstream commit that adds a `persistUiState` action to save selected task, view, splits, pins, and per-task model/mode to the history store. Called on `setTaskMode` and `setTaskModel` changes, and included in a new 30s auto-save interval. Also includes archived threads when validating restored UI state.

**Modified:**
- src/renderer/App.tsx
- src/renderer/stores/task-store-types.ts
- src/renderer/stores/taskStore.ts

## 2026-05-12 21:09 GST (Dubai)
### fs_ops: Support full paths in terminal command allowlist

Ported upstream fix so the terminal command allowlist extracts the binary file_name from a full path (e.g. `/opt/homebrew/bin/claude /login`) instead of only matching bare `claude` commands.

**Modified:**
- src-tauri/src/commands/fs_ops.rs

## 2026-05-12 21:07 GST (Dubai)
### Onboarding: Show login errors and non-standard path hint

Ported upstream feature to display error messages when claude login fails and show a hint with the full command path and copy button when the detected binary is a full path (not on PATH).

**Modified:**
- src/renderer/components/OnboardingAuthSection.tsx

## 2026-05-12 21:05 GST (Dubai)
### Chat: Render image preview overlay via portal

Ported upstream fix to render the full-screen image preview using createPortal to document.body, preventing z-index and overflow clipping issues in nested scroll containers.

**Modified:**
- src/renderer/components/chat/UserMessageRow.tsx

## 2026-05-12 21:02 GST (Dubai)
### Chat: Add connection_lost system message variant

Ported upstream commit adding 'connection_lost' to SystemMessageVariant type and rendering it as an amber card with IconPlugConnectedX and reconnection hint.

**Modified:**
- src/renderer/components/chat/SystemMessageRow.tsx
- src/renderer/lib/timeline.ts

## 2026-05-12 20:59 GST (Dubai)
### Settings: Add delete button to memory section thread rows

Ported upstream commit adding a trash icon button to each thread row in the memory breakdown, allowing quick soft-delete without navigating away.

**Modified:**
- src/renderer/components/settings/memory-section.tsx

## 2026-05-12 20:55 GST (Dubai)
### Settings: Add unsaved changes confirmation dialog

Ported upstream commit adding a confirmation dialog when closing settings with unsaved changes. Includes a sticky save bar at the bottom when draft differs from saved settings, with discard/save options. Close/Cancel/Escape now trigger the dialog instead of silently discarding.

**Modified:**
- src/renderer/components/settings/SettingsPanel.tsx

## 2026-05-12 20:53 GST (Dubai)
### UI: Refine split divider grip dots and panel header layout

Ported upstream style commit: replaced pill grip with three dot indicators on hover, restructured panel header to stack thread name over project name, simplified close button styling with IconX for both sides, and added subtle primary border tint for focused state.

**Modified:**
- src/renderer/components/chat/SplitDivider.tsx
- src/renderer/components/chat/SplitPanelHeader.tsx

## 2026-05-12 20:49 GST (Dubai)
### UI: Rename 'split view' to 'side-by-side' across UI

Ported upstream commit renaming "Split view" / "Toggle Split View" / "Remove split view" / "Unsplit" terminology to "Side-by-side" / "Toggle Side-by-Side" / "Remove side-by-side" / "Remove side-by-side" across command palette, header toolbar, sidebar, and thread context menus. Also applied minor sizing tweaks to sidebar split view list items.

**Modified:**
- src/renderer/App.tsx
- src/renderer/components/CommandPalette.tsx
- src/renderer/components/header-toolbar.tsx
- src/renderer/components/sidebar/TaskSidebar.tsx
- src/renderer/components/sidebar/ThreadItem.tsx

## 2026-05-12 20:37 GST (Dubai)
### Header: Restyle toolbar dividers and active states

Ported upstream styling commit — replaced `bg-foreground/[0.06]` dividers and `bg-foreground/[0.08]` active states with `bg-white/[0.06]` and `bg-white/[0.08]` to match the connected button group design from kirodex.

**Modified:** src/renderer/components/header-toolbar.tsx

## 2026-05-12 20:08 GST (Dubai)
### Scripts: Add --from-tag support to ralph-loop.sh

Added `--from-tag <tag>` option that resolves a git tag (e.g., `v0.42.0`) to its SHA before building the commit range. Also fetches tags from origin. Takes precedence over `--from` if both are provided.

**Modified:** scripts/ralph-loop.sh

## 2026-05-12 20:02 GST (Dubai)
### Sidebar: Remove dark border lines from footer

Removed `border-b border-border` and `border-t border-border` from the `ClaudeConfigFooter` component in `SidebarFooter.tsx` to eliminate the harsh separator lines between the CLAUDE config section and the Settings row.

**Modified:** src/renderer/components/sidebar/SidebarFooter.tsx

## 2026-05-12 20:01 GST (Dubai)
### Splash: Fix white flash in dark mode

Added `background: #0D0D0D` to the splash div and set `r.style.background` on the `<html>` element in the head theme script so the page is dark from the first paint when the system or user preference is dark mode. Light mode gets `#ffffff`.

**Modified:** index.html

## 2026-05-12 19:51 GST (Dubai)
### Sync: Apply kirodex v0.43.0 diff to klaudex

Ported kirodex v0.43.0 changes: replaced ClaudeIcon with KlaudexGhostIcon in ClaudeConfigPanel header, darkened border color from #121212 to #090909. Most layout/styling/refactoring changes (full-height sidebar, connected toolbar, settings memo/tooltips, ProjectItem chevron removal, SidebarFooter inline buttons) were already applied.

**Modified:** `src/tailwind.css`, `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`, `CHANGELOG.md`

## 2026-05-11 17:01 GST (Dubai)
### Git: Split working tree into 15 focused conventional commits

Split all pending changes into small, logical commits: removed obsolete tests, added icon components, bundle budget tooling, tauri dev config, theme overhaul (color-mix→hex, brand token), splash screen updates, ACP refactor (removed client.rs), settings restructure, Rust backend fixes, blue→brand color replacement, performance optimizations (useShallow, stable keys), accessibility polish (focus-visible rings), CI/build config, test additions, and homebrew cask rename.

**Modified:** 86 files across 15 commits on catch-up branch

## 2026-05-11 16:18 GST (Dubai)
### Branding: Replace code-mode blue with #DC5603 brand color
Added `--brand` CSS custom property (#DC5603 light, #F07A2F dark) to the theme and replaced all code-mode/brand blue utility classes (`text-blue-*`, `bg-blue-*`, `border-blue-*`) with `text-brand`, `bg-brand/N` equivalents across 8 components. Planning mode teal and informational blue (file-type badges, git indicators, terminal) remain unchanged.

**Modified:** `src/tailwind.css`, `src/renderer/App.tsx`, `src/renderer/components/AppHeader.tsx`, `src/renderer/components/PlanSidebar.tsx`, `src/renderer/components/chat/AgentPanel.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/EmptyThreadSplash.tsx`, `src/renderer/components/chat/FileMentionPicker.tsx`, `src/renderer/components/chat/WorkingRow.tsx`

## 2026-05-11 20:20 GST (Dubai)
### Claude Config: Render Skills section in sidebar panel
Added the Skills section to `ClaudeConfigPanel` between Commands and Agents. The `SkillRow` component was already implemented but never rendered in the JSX. Skills from both `~/.claude/skills/` (global) and project-local `.claude/skills/` now appear with the lightning bolt icon, drag-to-attach support, and source dot indicator.

**Modified:** `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`

## 2026-05-11 16:18 GST (Dubai)

### Tests: Add unit tests for performance optimization changes

Added 11 new tests covering the performance optimization work: 2 tests in `useSidebarTasks.test.ts` verifying `useShallow` render stability (unrelated store changes don't trigger re-render), 5 tests in `bundle-budget.test.ts` validating the budget JSON structure, and 4 tests in `settings-selectors.test.ts` verifying granular settings selectors return correct values. Full suite passes: 84 files, 1366 tests.

**Modified:** `src/renderer/hooks/useSidebarTasks.test.ts`, `src/renderer/lib/bundle-budget.test.ts`, `src/renderer/stores/settings-selectors.test.ts`

## 2026-05-11 16:07 GST (Dubai)

### Performance: Full performance audit and optimization pass

Completed a comprehensive performance optimization covering Zustand selector optimization (added `useShallow` to `useSidebarTasks` and `CommandPalette`, fixed `PendingChat` and `GitPanels` to select specific properties instead of entire settings object), fixed all 21 `key={index}` anti-patterns across 15 files, converted `read_text_file` and `read_file_base64` in Rust `fs_ops.rs` to async `tokio::fs`, made Google Fonts non-render-blocking with preload pattern, and added bundle size monitoring CI script. Verified recharts, material-icons, and PostHog are already properly deferred behind lazy boundaries.

**Modified:** `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/components/CommandPalette.tsx`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/components/chat/GitPanels.tsx`, `src/renderer/components/chat/InlineDiff.tsx`, `src/renderer/components/chat/HighlightText.tsx`, `src/renderer/components/file-tree/FilePreviewModal.tsx`, `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`, `src/renderer/components/chat/FileMentionPicker.tsx`, `src/renderer/components/chat/ReadOutput.tsx`, `src/renderer/components/chat/ToolCallEntry.tsx`, `src/renderer/components/chat/SystemMessageRow.tsx`, `src/renderer/components/chat/QueuedMessages.tsx`, `src/renderer/components/chat/UserMessageRow.tsx`, `src/renderer/components/chat/ExecutionPlan.tsx`, `src/renderer/components/chat/CollapsedAnswers.tsx`, `src/renderer/components/code/DiffFileSidebar.tsx`, `src/renderer/components/code/TerminalOutput.tsx`, `src/renderer/components/file-tree/TreeContextMenu.tsx`, `src-tauri/src/commands/fs_ops.rs`, `src-tauri/Cargo.toml`, `index.html`, `bundle-budget.json`, `scripts/check-bundle-size.mjs`, `package.json`

## 2025-05-11 16:16 GST (Dubai)

### Config: Fix dev mode opening production Klaudex instead of Klaudex Dev

Added a separate `identifier` (`com.klaudex.dev`) to `tauri.dev.conf.json` so macOS treats the dev build as a distinct app from the installed production bundle. Also fixed `productName` casing and added a window `title` override to show "Klaudex Dev" in the Dock and title bar.

**Modified:** src-tauri/tauri.dev.conf.json

## 2026-05-11 20:12 GST (Dubai)
### Splash Screen: Orange glow theme with title-case text
Changed the app launch splash screen from purple glow (#7c6aef) to orange (#f97316). Updated text from "KLAUDEX" to "Klaudex" (title case). All glow animation keyframes updated to match the orange theme.

**Modified:** `index.html`

## 2026-05-11 20:07 GST (Dubai)
### Claude Config: Load ~/.claude commands, agents, and memory files into sidebar panel
Added `scan_commands` function to discover `.md` slash command files from `commands/` directories. Updated `scan_agents` to parse `.md` files with YAML frontmatter (used by `~/.claude/agents/`) in addition to `.json` files. Added `commands` and `memory_files` fields to the Rust `ClaudeConfig` struct; memory files are populated from steering rules with `alwaysApply: true`. Added `serde_yaml = "0.9"` dependency. The frontend panel already had all UI components wired up; it was only missing the backend data.

**Modified:** `src-tauri/Cargo.toml`, `src-tauri/src/commands/claude_config.rs`

## 2026-05-11 20:03 GST (Dubai)
### Theme: Light mode overhaul for visual parity with dark mode
Replaced all `color-mix()` CSS variables with solid hex values in both light and dark themes to fix WebKit rendering issues in Tauri. Light mode now uses warm stone-toned colors (#fdfcfb background, #f8f6f4 card, #f2eeeb sidebar, #ddd6cf border) with WCAG AA contrast on all text. Fixed invisible dividers in header toolbars by replacing `bg-white/[0.06]` with theme-aware `bg-foreground/[0.06]`. Updated ThemeSelector preview colors and floating-panel hardcoded values.

**Modified:** `src/tailwind.css`, `src/renderer/lib/theme.ts`, `src/renderer/components/settings/ThemeSelector.tsx`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/header-ghost-toolbar.tsx`

## 2026-05-11 16:09 GST (Dubai)
### Build: Dev mode app name set to "klaudex-dev"
Created `src-tauri/tauri.dev.conf.json` as a config override with `productName: "klaudex-dev"` and dev icons. The main `tauri.conf.json` now uses `productName: "Klaudex"` with prod icons for release builds. The `bun run dev` script passes `--config src-tauri/tauri.dev.conf.json` to `cargo tauri dev`.

**Modified:** `src-tauri/tauri.conf.json`, `src-tauri/tauri.dev.conf.json`, `package.json`

## 2026-05-11 16:05 GST (Dubai)
### ACP: Remove broken `claude models list` shell-out
The Claude CLI has no `models list` subcommand; the old code was sending "models list" as a prompt to the agent. Replaced `list_models` and `probe_capabilities` to return hardcoded models immediately without spawning a CLI process. The real model list arrives via `session_init` when an ACP session starts.

**Modified:** `src-tauri/src/commands/acp/commands.rs`

## 2026-05-11 16:05 GST (Dubai)
### Split view: Improve look, feel, and naming
Renamed "Split Views" to "Side by Side" throughout the app. Improved SplitThreadPicker with a violet-accented border, search icon, descriptive header ("Pick a thread for the right panel"). Improved SplitPanelHeader with violet accent bar and subtle focused/unfocused states. Updated sidebar list with violet-tinted active/hover states and a vertical separator between thread names.

**Modified:** `src/renderer/components/chat/SplitThreadPicker.tsx`, `src/renderer/components/chat/SplitPanelHeader.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`

## 2026-05-11 16:05 GST (Dubai)
### ThreadItem: Remove active state highlight
Removed the distinct background/font-weight styling applied to the currently selected thread in the sidebar. All threads now share the same base style with only a hover state.

**Modified:** `src/renderer/components/sidebar/ThreadItem.tsx`

## 2026-05-11 16:04 GST (Dubai)
### ModelIcons: Use Anthropic icon for Claude models
Mapped the `claude` provider to `AnthropicIcon` (the orange "A" logo) instead of the purple cube `ClaudeIcon`. Claude models now show the same Anthropic icon as in kirodex.

**Modified:** `src/renderer/lib/model-icons.tsx`

## 2026-05-11 16:02 GST (Dubai)
### ModelPickerPanel: Add model provider icons to list
Added model provider icons (from kirodex) to the ModelPickerPanel list items, replacing the plain dot indicator with SVG icons that match each model's provider (Anthropic, OpenAI, Amazon, etc.).

**Modified:** `src/renderer/components/chat/ModelPickerPanel.tsx`

## 2026-05-11 16:02 GST (Dubai)
### Settings: Archive list — bulk delete per project
Added a trash icon button on each project group header that permanently deletes all threads in that project at once. Also shows a thread count badge next to the project name.

**Modified:** `src/renderer/components/settings/deleted-threads-restore.tsx`

## 2026-05-11 16:00 GST (Dubai)
### Settings: Archive list — remove delete confirmation, add project icons
Removed the two-step confirmation for permanent delete in the archives section; the trash button now deletes immediately. Added a `ProjectGroupHeader` sub-component that uses `useProjectIcon` + `ProjectIcon` to display detected project icons next to each workspace group header.

**Modified:** `src/renderer/components/settings/deleted-threads-restore.tsx`

## 2026-05-11 15:55 GST (Dubai)
### Sidebar: Add global ~/.claude source indicator
Updated `SourceDot` in `claude-config-helpers.tsx` to show a home icon with `~/.claude` title for global-source items (MCPs, agents, skills). Previously only local items had a visual indicator. Also fixed a `.kiro` → `.claude` comment in `ClaudeConfigPanel.tsx`.

**Modified:** `src/renderer/components/sidebar/claude-config-helpers.tsx`, `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`

## 2026-05-11 15:55 GST (Dubai)
### Theme: Fix accent color to match kirodex
Changed `--accent` from `#B95F3D` (solid orange) to `color-mix(in srgb, white 7%, transparent)` (subtle white overlay) to match kirodex. The solid orange was making the settings sidebar nav items and all hover states look drastically different. Also fixed `--accent-foreground` from `#ffffff` to `#f0f0f0`.

**Modified:** `src/tailwind.css`

## 2026-05-11 15:53 GST (Dubai)
### Icons: Replace ghost icon with Claude icon in sidebar
Created `ClaudeIcon` component using the official Claude AI symbol SVG (CC0 public domain from Wikimedia Commons). Replaced `KlaudexGhostIcon` usage in `ClaudeConfigPanel` with the new `ClaudeIcon`.

**Modified:** `src/renderer/components/icons/ClaudeIcon.tsx` (new), `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`

## 2026-05-11 15:52 GST (Dubai)
### Header: Fix ghost toolbar icon order
Updated `header-ghost-toolbar.tsx` to match the real toolbar layout: Editor → Terminal → File Tree → Split (in a connected `bg-muted/40` group) then Git section (emerald accent). Previously Terminal was the rightmost icon.

**Modified:** `src/renderer/components/header-ghost-toolbar.tsx`

## 2026-05-11 15:50 GST (Dubai)
### Settings: Wire up missing HooksSection render
The `HooksSection` component was imported and had a nav entry but was never rendered in the section switch. Added the missing `{section === 'hooks' && <HooksSection />}` conditional.

**Modified:** `src/renderer/components/settings/SettingsPanel.tsx`

## 2026-05-11 15:46 GST (Dubai)
### Sidebar: Replace chevron with KlaudexGhostIcon in ClaudeConfigPanel
Ported the last remaining change from kirodex's last 24h: replaced `IconChevronRight` with a new `KlaudexGhostIcon` SVG component in the Claude config panel toggle button. All other kirodex changes (layout refactor, header toolbar, settings memo/useCallback/tooltips, theme, diff overflow fix, chat UX, WorkingRow, git Rust H/F fix, ThreadItem copy IDs, button styles) were already present in klaudex.

**Modified:** `src/renderer/components/icons/KlaudexGhostIcon.tsx`, `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`

## 2026-05-11 15:49 GST (Dubai)
### Fix: Add MCP server dialog — padding, scroll, and .claude paths
Added `px-6` horizontal padding to the dialog form body to match DialogHeader/DialogFooter spacing, `overflow-y-auto` for scrollability on smaller viewports, and updated scope hint paths from `.kiro/` to `.claude/` to match the Claude CLI's actual config locations.

**Modified:** `src/renderer/components/sidebar/AddMcpServerDialog.tsx`

## 2026-05-11 15:48 GST (Dubai)
### UX: Button consistency, accessibility, and copy review
Reviewed all 370 button instances across 119 files for UX consistency, clarity, and usability. Fixed critical accessibility gaps (missing aria-labels on PermissionBanner, missing focus-visible rings on onboarding/permission buttons), improved affordance (PendingChat sign-in now uses primary styling, CommitDialog Generate button enlarged), fixed copy issues ("Import Project" → "Open folder", "New Thread" → "New thread", "Commit on new refName" → "Commit on new branch", "Skip sign-in for now" → "Skip for now"), and added external link indicator to GitActionsGroup GitHub button.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/CommitDialog.tsx`, `src/renderer/components/GitActionsGroup.tsx`, `src/renderer/components/OnboardingSetupStep.tsx`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/components/chat/PermissionBanner.tsx`, `src/renderer/components/chat/PermissionCard.tsx`, `src/renderer/components/dashboard/Dashboard.tsx`

## 2026-05-11 15:46 GST (Dubai)
### Fix: Add MCP server dialog padding and scroll
Added `px-6` horizontal padding to the dialog form body to match the DialogHeader/DialogFooter spacing, and `overflow-y-auto` so the form scrolls on smaller viewports instead of overflowing.

**Modified:** `src/renderer/components/sidebar/AddMcpServerDialog.tsx`

## 2026-05-11 15:41 GST (Dubai)
### Sidebar: Grey-based active state redesign
Replaced the visually heavy active project/thread indicators (blue left bar, accent backgrounds, primary colors) with a subtle grey-based design using `bg-muted/60 dark:bg-muted/40`. Applied consistently across ProjectItem, ThreadItem, PinnedThreadsList, and SplitViewsList.

**Modified:** `src/renderer/components/sidebar/ProjectItem.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`

## 2026-05-11 15:38 GST (Dubai)
### Fix: Guard availableModels in ModelPicker and ModelPickerPanel
Added `Array.isArray` defensive guard to `ModelPicker.tsx` and `ModelPickerPanel.tsx` to prevent "models.find is not a function" crash when `availableModels` is unexpectedly non-array during new project creation.

**Modified:** `src/renderer/components/chat/ModelPicker.tsx`, `src/renderer/components/chat/ModelPickerPanel.tsx`

## 2026-05-11 15:37 GST (Dubai)
### Fix: Guard availableModels against non-array values in GeneralSection
The `availableModels` field from ACP `session_init` could arrive as a non-array value, crashing the `<GeneralSection>` component with `availableModels.map is not a function`. Added `Array.isArray` guard in `task-store-listeners.ts` before setting the store, and a defensive fallback in the component itself.

**Modified:** `src/renderer/stores/task-store-listeners.ts`, `src/renderer/components/settings/general-section.tsx`

## 2026-05-11 14:30 GST (Dubai)
### Fix: Resolve ClaudeWatcherState duplicate manage panic and clean up warnings
Fixed a runtime panic caused by `ClaudeWatcherState` being `.manage()`'d twice in `lib.rs`. Also resolved all compiler warnings: unused variables (`tight_sandbox`, `index`), dead code (`now_millis`, sandbox re-exports), private_interfaces (`ModelOutput` visibility), and unused enum (`ValueOrJsonString`).

**Modified:** `src-tauri/src/lib.rs`, `src-tauri/src/commands/acp/connection.rs`, `src-tauri/src/commands/acp/mod.rs`, `src-tauri/src/commands/git_ai.rs`, `src-tauri/src/commands/serde_utils.rs`

## 2026-05-11 12:32 GST (Dubai)
### Port: Fix SidebarFooter test for icon-only Debug button (kirodex@51b5dd2)
Ported upstream test fix. The Debug button was refactored to icon-only with aria-label but the test still expected visible text. Updated to use `getByLabelText` instead of `getByText`.

**Modified:** `src/renderer/components/sidebar/SidebarFooter.test.tsx`

## 2026-05-11 12:27 GST (Dubai)
### Port: Add memo, useCallback, and tooltips to all settings sections (kirodex@308276e)
Cherry-picked upstream refactor. Wraps all section components in memo, extracts inline handlers into useCallback, adds Tooltip wrappers to icon-only buttons, adds aria-labels, extracts FontSizeStepper sub-component, adds type="button" to prevent form submission. Fixed property name conflicts (kiroAuth→claudeAuth, kiroBin→claudeBin) for klaudex compatibility.

**Modified:** src/renderer/components/settings/account-section.tsx, src/renderer/components/settings/advanced-section.tsx, src/renderer/components/settings/appearance-section.tsx, src/renderer/components/settings/archives-section.tsx, src/renderer/components/settings/general-section.tsx, src/renderer/components/settings/keymap-section.tsx, src/renderer/components/settings/memory-section.tsx

## 2026-05-11 12:25 GST (Dubai)
### Port: Restyle settings nav sidebar (kirodex@209b122)
Cherry-picked upstream style commit. Applies bg-sidebar background, replaces primary/10 active state with accent/85, removes left-edge indicator bar, reduces font sizes and padding for compact appearance.

**Modified:** src/renderer/components/settings/SettingsPanel.tsx

## 2026-05-11 12:24 GST (Dubai)
### Port: Wrap SettingRow and SettingsCard in memo (kirodex@6cb5c85)
Cherry-picked upstream perf commit. Wrapped SettingRow and SettingsCard components in React.memo to prevent unnecessary re-renders when parent sections update unrelated state.

**Modified:** src/renderer/components/settings/settings-shared.tsx

## 2026-05-11 12:21 GST (Dubai)
### Port: Make sidebar full height, move header into content column (kirodex@8876435)
Cherry-picked upstream layout refactor. Sidebar now spans full window height with pt-9 for macOS traffic light clearance. Header and content are nested in a flex column beside the sidebar. Added collapse button inside sidebar and header only shows expand button when collapsed. Removed HeaderUserMenu from AppHeader. Fixed missing Tooltip import and unclosed JSX expression from merge.

**Modified:** src/renderer/App.tsx, src/renderer/components/AppHeader.tsx, src/renderer/components/header-breadcrumb.tsx, src/renderer/components/sidebar/TaskSidebar.tsx

## 2026-05-11 12:19 GST (Dubai)
### Port: Restyle toolbar as connected button group (kirodex@cde5ee2)
Cherry-picked upstream styling commit that joins editor, terminal, file tree, and split buttons into a single rounded container with bg-muted/40 and thin vertical dividers. Git section moved to far right with emerald accent background. Resolved conflict where upstream had isGitRepo conditionals not present in klaudex.

**Modified:** src/renderer/components/header-toolbar.tsx, src/renderer/components/GitActionsGroup.tsx, src/renderer/components/OpenInEditorGroup.tsx

## 2026-05-11 12:18 GST (Dubai)
### Port: Remove chevron from ProjectItem (kirodex@5c51d88)
Cherry-picked upstream refactor that removes the expand/collapse chevron icon from project items in the sidebar. Projects now toggle purely by clicking the row.

**Modified:** src/renderer/components/sidebar/ProjectItem.tsx

## 2026-05-11 12:16 GST (Dubai)
### Port: Restyle sidebar footer with inline buttons and user menu (kirodex@03909be)
Cherry-picked upstream refactor that changes the sidebar footer from a vertical stack to a horizontal row, makes the debug button icon-only, moves it to the right of settings, adds HeaderUserMenu to the footer, and defaults the ClaudeConfig panel to collapsed.

**Modified:** src/renderer/components/sidebar/SidebarFooter.tsx

## 2026-05-11 12:06 GST (Dubai)
### Port: Fix clipped unmodified lines separator (kirodex@b51e6b4)
Cherry-picked upstream fix adding `overflow: visible !important` overrides for `[data-separator-content]` and `[data-unmodified-lines]` in both DiffPanel and diff-viewer-utils UNSAFE_CSS to prevent @pierre/diffs separator text from being clipped.

**Modified:** src/renderer/components/code/diff-viewer-utils.ts, src/renderer/components/diff/DiffPanel.tsx

## 2026-05-11 12:04 GST (Dubai)
### Port: Darken border and sidebar colors (kirodex@464e553)
Cherry-picked upstream theme tweak: reduced `--border` to near-invisible (2% white mix) and changed `--sidebar` from `#111111` to `#272627` for a warmer dark tone.

**Modified:** src/tailwind.css

## 2026-05-11 12:02 GST (Dubai)
### Port: Hide archived banner when message is initiated (kirodex@d634861)
Cherry-picked upstream fix: the blue zigzag "Resumed from history" divider now disappears immediately when the user sends a message, rather than persisting until the backend confirms the new connection.

**Modified:** src/renderer/components/chat/ChatPanel.tsx

## 2026-05-11 12:00 GST (Dubai)
### Port: Improve chat UX and fix git diff output (kirodex@ef16bdf)
Cherry-picked upstream fix: git diff functions now include file/hunk headers (F/H origins) so @pierre/diffs can parse correctly. Hid ThreadIdCaption from chat panel, added Copy Thread ID and Copy Session ID to sidebar context menu. TaskListDisplay defaults to collapsed with 600px max-height. WorkingRow gets middle-dot separator, tabular-nums, and zero-padded seconds.

**Modified:** src-tauri/src/commands/git.rs, src-tauri/src/commands/git_history.rs, src/renderer/components/chat/ChatPanel.tsx, src/renderer/components/chat/TaskListDisplay.tsx, src/renderer/components/chat/WorkingRow.tsx, src/renderer/components/sidebar/ThreadItem.tsx

## 2026-05-11 11:57 GST (Dubai)
### Port: Make commands module public and add generate_for_smoke (kirodex@db3fee8)
Cherry-picked upstream build fix: made the `commands` module public in lib.rs and added `generate_for_smoke()` entry point in git_ai.rs so the git_ai_smoke example binary can access the commit generation logic. Adapted `run_kiro_oneshot` → `run_claude_oneshot` for klaudex.

**Modified:** src-tauri/src/commands/git_ai.rs, src-tauri/src/lib.rs

## 2026-05-11 11:56 GST (Dubai)
### Port: Prevent PTY cwd bypass via unset HOME on Windows (kirodex@397d4f5)
Cherry-picked upstream security fix: On Windows, use USERPROFILE with HOME fallback for PTY cwd validation. Default to a nonexistent path instead of "/" when env vars are unset, preventing the validation from accepting any path. Added Windows-specific allowed paths (C:\Users, D:\).

**Modified:** src-tauri/src/commands/pty.rs

## 2026-05-11 11:52 GST (Dubai)
### Port: Path traversal, SSRF, AppleScript injection, and NSOpenPanel crash fixes (kirodex@4cf12cc)
Cherry-picked upstream security commit: (S1) Added `validate_path_containment()` to all project_watcher file ops preventing `../` traversal. (S2) Replaced AppleScript string interpolation in `open_terminal_at` with env-var pattern (`KLAUDEX_CD_PATH`). (S3) Added URL validation to HttpTransport rejecting private IPs and requiring HTTPS for remote servers. (S4) Added dirty-check guard to `checkpoint_revert` refusing hard reset with uncommitted changes unless `force=true`. Fixed NSOpenPanel NULL panic with `catch_unwind` and `NSApplicationActivationPolicyRegular`. Fixed duplicate React keys in sidebar by deduplicating projects array.

**Modified:** src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/src/commands/project_watcher.rs, src-tauri/src/commands/transport.rs, src-tauri/src/commands/checkpoint.rs, src-tauri/src/commands/fs_ops.rs, src-tauri/src/lib.rs, src/renderer/components/diff/CheckpointTimeline.tsx, src/renderer/hooks/useSidebarTasks.ts, src/renderer/lib/ipc.ts, src/renderer/stores/taskStore.ts, docs/pr-review-hitesh-sisara-main.md, bun.lock

## 2026-05-11 11:48 GST (Dubai)
### Port: Robust JSON parsing for claude CLI warnings and improve persistence (kirodex@550471a)
Cherry-picked upstream commit that refactors `extract_first_json_object` into an iterator (`iter_json_objects`) that skips invalid brace blocks like `{MCPSERVERNAME}` in CLI warnings, adds `extract_json_object_with_key` for schema-aware JSON extraction, fixes @mention regex to require leading whitespace, returns null from `loadFullThread` when thread has no messages, persists in-flight streaming chunks during hot-reload/crash recovery, supports `archivedMeta` in UI state restoration, and switches `save_thread`/`update_context_usage` from `INSERT OR REPLACE` to proper UPSERT to avoid cascade-deleting child rows.

**Modified:** src-tauri/src/commands/branch_ai.rs, src-tauri/src/commands/git_ai.rs, src-tauri/src/commands/pr_ai.rs, src-tauri/src/commands/thread_db.rs, src-tauri/src/commands/thread_title.rs, src/renderer/App.tsx, src/renderer/lib/resolve-mentions.ts, src/renderer/lib/thread-db.test.ts, src/renderer/lib/thread-db.ts, src/renderer/stores/chat-persistence.test.ts (new), src/renderer/stores/taskStore.ts

## 2026-05-11 11:42 GST (Dubai)
### Port: Performance improvements and new features (kirodex@d638abf)
Cherry-picked upstream commit with security hardening (sensitive path blocking in fs_ops, PTY cwd validation, command allowlist for open_terminal_with_command, env-var-based AppleScript injection prevention), git improvements (git2-based ahead/behind in vcs_status, git_history module with commit log/stash/diff commands, worktree validation), enhanced CommandPalette (frecency tracking, contextual commands, panel/git/action categories, keyboard shortcut hints), new CheckpointTimeline and GitHistoryPanel UI components, and backend-driven auto-archive for stale threads.

**Modified:** package.json, src-tauri/src/commands/acp/sandbox.rs, src-tauri/src/commands/fs_ops.rs, src-tauri/src/commands/git.rs, src-tauri/src/commands/git_history.rs (new), src-tauri/src/commands/mod.rs, src-tauri/src/commands/pty.rs, src-tauri/src/commands/vcs_status.rs, src-tauri/src/lib.rs, src/renderer/components/CommandPalette.tsx, src/renderer/components/diff/CheckpointTimeline.tsx (new), src/renderer/components/diff/GitHistoryPanel.tsx (new), src/renderer/stores/taskStore.test.ts, src/renderer/stores/taskStore.ts

## 2026-05-11 11:39 GST (Dubai)
### Port: Remove T3 Code/Zed attribution comments (kirodex@0221ed3)
Ported upstream commit that removes T3 Code and Zed attribution comments from the codebase. Also brings in new modules: checkpoint.rs (per-turn git ref snapshots), git_pr.rs (GitHub/GitLab PR creation), pattern_extract.rs (code signature extraction), tracing.rs (NDJSON structured tracing), thread_db auto-archive, and new IPC bindings for all of the above.

**Modified:** 59 files across src-tauri/src/commands/ and src/renderer/ (comment cleanup + new modules)

## 2026-05-11 11:35 GST (Dubai)
### Port: Address code review issues (kirodex@da0a737)
Ported upstream commit da0a7378. Restricts signal_process to only allow signalling descendant PIDs, makes rename_worktree_branch async, makes collect_pr_context async with parallel diff stat/patch fetching via tokio::join!, and extracts shared git_utils module with run_git_cmd and run_git_cmd_async helpers.

**Modified:** src-tauri/src/commands/branch_ai.rs, src-tauri/src/commands/git_stack.rs, src-tauri/src/commands/git_utils.rs (new), src-tauri/src/commands/mod.rs, src-tauri/src/commands/pr_ai.rs, src-tauri/src/commands/process_diagnostics.rs

## 2026-05-11 11:12 GST (Dubai)
### Port: Performance improvements and new commands (kirodex@c90011c)
Ported upstream commit c90011c from kirodex. Adds new Rust backend commands: thread_title, branch_ai, diff_stats, git_ai, git_stack, pr_ai, process_diagnostics, and vcs_status. Adds new UI components: AnimatedHeight, CommandPalette, CommitDialog, DefaultBranchConfirmDialog, GlobalFilePreviewModal, PlanSidebar, ProviderStatusBanner, PublishRepoDialog, CompletionDivider, ThreadIdCaption, AddMcpServerDialog. Adds utility hooks: useCommitOnBlur, useCopyToClipboard, useMediaQuery. Adds lib modules: file-icons, git-toast, keybindings-toast, metrics, model-ordering, project-scripts, proposed-plan, provider-skill-presentation, resolve-mentions, resolve-model, terminal-context, thread-db, turn-diff-summary, version-skew, worktree-cleanup. Adds stores: filePreviewStore, vcsStatusStore. Updates chat components, settings, sidebar, and stores.

**Modified:** 113 files across src-tauri/src/commands/, src/renderer/components/, src/renderer/hooks/, src/renderer/lib/, src/renderer/stores/, src/renderer/types/

## 2026-05-11 11:04 GST (Dubai)
### Port: Extend backend commands and refactor chat/file tree UI
Ported upstream commit abc6c57 from kirodex. Adds new Rust backend modules: fuzzy matching (nucleo-matcher), syntax highlighting (syntect), markdown parsing (pulldown-cmark), streaming diff (imara-diff), structured diff parsing, thread database (SQLite via rusqlite), MCP transport layer, project file watcher, and retry utilities. Refactors chat UI with accent-colored tool call headers, cancelled status pills, redesigned tool call entries with git-compare icons, and tighter spacing. Adds file tree context menu and drag-and-drop support. Introduces frontend fuzzy search, tool-call-detail/fetch-display utilities, and analytics aggregation helpers.

**Modified:** `src-tauri/Cargo.lock`, `src-tauri/Cargo.toml`, `src-tauri/src/commands/acp/commands.rs`, `src-tauri/src/commands/acp/sandbox.rs`, `src-tauri/src/commands/acp/tests.rs`, `src-tauri/src/commands/acp/types.rs`, `src-tauri/src/commands/analytics.rs`, `src-tauri/src/commands/diff_parse.rs`, `src-tauri/src/commands/fuzzy.rs`, `src-tauri/src/commands/git.rs`, `src-tauri/src/commands/highlight.rs`, `src-tauri/src/commands/markdown.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/project_watcher.rs`, `src-tauri/src/commands/retry.rs`, `src-tauri/src/commands/serde_utils.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/commands/streaming_diff.rs`, `src-tauri/src/commands/thread_db.rs`, `src-tauri/src/commands/transport.rs`, `src-tauri/src/lib.rs`, `src/renderer/App.tsx`, `src/renderer/components/chat/AssistantTextRow.tsx`, `src/renderer/components/chat/AutoApproveToggle.tsx`, `src/renderer/components/chat/BranchSelector.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatPanel.logic.test.ts`, `src/renderer/components/chat/ChatPanel.logic.ts`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/ChatTextarea.tsx`, `src/renderer/components/chat/ChatToolbar.tsx`, `src/renderer/components/chat/ContextRing.tsx`, `src/renderer/components/chat/EmptyThreadSplash.tsx`, `src/renderer/components/chat/ModelPicker.tsx`, `src/renderer/components/chat/PlanToggle.tsx`, `src/renderer/components/chat/SlashCommandPicker.tsx`, `src/renderer/components/chat/ToolCallDisplay.tsx`, `src/renderer/components/chat/ToolCallEntry.tsx`, `src/renderer/components/chat/UserMessageRow.tsx`, `src/renderer/components/chat/WorkingRow.tsx`, `src/renderer/components/chat/fetch-display.test.ts`, `src/renderer/components/chat/fetch-display.ts`, `src/renderer/components/chat/tool-call-detail.test.ts`, `src/renderer/components/chat/tool-call-detail.ts`, `src/renderer/components/chat/tool-call-utils.ts`, `src/renderer/components/file-tree/FileTreePanel.tsx`, `src/renderer/components/file-tree/TreeContextMenu.tsx`, `src/renderer/components/file-tree/build-tree.ts`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/hooks/useZoomLimit.ts`, `src/renderer/lib/analytics-aggregators.ts`, `src/renderer/lib/fuzzy-search.test.ts`, `src/renderer/lib/fuzzy-search.ts`, `src/renderer/lib/ipc.ts`, `src/renderer/lib/tool-call-collapsing.ts`, `src/renderer/stores/diffStore.test.ts`, `src/renderer/stores/diffStore.ts`, `src/renderer/stores/fileTreeStore.ts`, `src/renderer/stores/task-store-listeners.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/types/diff.ts`, `src/renderer/types/highlight.ts`, `src/renderer/types/index.ts`, `src/renderer/types/markdown.ts`, `src/tailwind.css`

## 2026-05-11 10:56 GST (Dubai)
### Port: Lazy Shiki, inline tool calls, sticky task list, connection state
Ported upstream commit 8353e2a from kirodex. Replaces the Shiki stub with a real lazy-loaded highlighter (LRU cache, idle preload), adds inline tool-calls layout option, pins a StickyTaskList card above chat input, persists toolCalls/toolCallSplits on messages, introduces ConnectionStatus with retry tracking, typed-receipts bus, dispatch snapshots for optimistic UI, and chat font size setting.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/AssistantTextRow.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatMarkdown.tsx`, `src/renderer/components/chat/ChatPanel.logic.ts`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/ChatTextarea.tsx`, `src/renderer/components/chat/MessageItem.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/components/chat/StickyTaskList.tsx`, `src/renderer/components/chat/TaskListDisplay.tsx`, `src/renderer/components/chat/ToolCallDisplay.tsx`, `src/renderer/components/chat/UserMessageRow.tsx`, `src/renderer/components/chat/WorkGroupRow.tsx`, `src/renderer/components/settings/SettingsPanel.tsx`, `src/renderer/components/settings/appearance-section.tsx`, `src/renderer/components/settings/settings-shared.tsx`, `src/renderer/hooks/useResolvedTheme.ts`, `src/renderer/lib/chatHighlighter.ts`, `src/renderer/lib/connection-health.ts`, `src/renderer/lib/connection-state.ts`, `src/renderer/lib/diffRendering.ts`, `src/renderer/lib/dispatch-snapshot.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/lib/lruCache.ts`, `src/renderer/lib/request-latency.ts`, `src/renderer/lib/timeline.ts`, `src/renderer/lib/typed-receipts.ts`, `src/renderer/stores/settingsStore.ts`, `src/renderer/stores/task-store-listeners.ts`, `src/renderer/stores/task-store-selectors.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/types/index.ts`, `src/tailwind.css`, `vite.config.ts`, `vitest.config.ts`

## 2026-05-11 10:53 GST (Dubai)
### Port: Comprehensive test coverage for performance modules
Ported upstream commit 5b286e0dc3 from kirodex. Adds 97 new tests across timeline-stability, MessageList.logic, ChatPanel.logic, structural-equality, tool-call-collapsing, connection-health, and task-store-selectors modules.

**Modified:** `src/renderer/components/chat/ChatPanel.logic.test.ts`, `src/renderer/components/chat/MessageList.logic.test.ts`, `src/renderer/lib/connection-health.test.ts`, `src/renderer/lib/structural-equality.test.ts`, `src/renderer/lib/timeline-stability.test.ts`, `src/renderer/lib/tool-call-collapsing.test.ts`, `src/renderer/stores/task-store-selectors.test.ts`

## 2026-05-11 10:51 GST (Dubai)
### Port: Connection health monitor with exponential backoff
Ported upstream commit 4e9901356a from kirodex. Adds ACP subprocess health monitoring with periodic IPC probes, exponential backoff with jitter for reconnection, and automatic connected/disconnected state transitions via useTaskStore.

**Modified:** `src/renderer/lib/connection-health.ts`, `src/renderer/lib/connection-health.test.ts`

## 2026-05-11 10:48 GST (Dubai)
### Port: Normalized selectors, dual-stream sidebar pattern, oxlint
Ported upstream commit ab8dde3f from kirodex. Adds task-store-selectors.ts with fine-grained selectors (selectTaskShell, selectTaskStatus, selectStreamingChunk, selectRunningTaskCount, etc.) that prevent sidebar re-renders during streaming. Adds oxlint as a dev dependency with a lint script for fast Rust-based linting.

**Modified:** `bun.lock`, `package.json`, `src/renderer/stores/task-store-selectors.ts`, `src/renderer/stores/task-store-selectors.test.ts`

## 2026-05-11 10:45 GST (Dubai)
### Port: Stable timeline rows, logic/UI separation, structural equality, tool call collapsing
Ported upstream commit 8ed9320 from kirodex. Adds stable row identity for timeline rendering (prevents unnecessary virtualizer re-measurement during streaming), extracts pure business logic from ChatPanel and MessageList into testable .logic.ts modules, adds structural equality helpers for store bail-out guards, and implements tool call collapsing to reduce visual noise in timeline work rows.

**Modified:** `src/renderer/components/chat/ChatPanel.logic.ts`, `src/renderer/components/chat/ChatPanel.logic.test.ts`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/MessageList.logic.ts`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/lib/structural-equality.ts`, `src/renderer/lib/structural-equality.test.ts`, `src/renderer/lib/timeline-stability.ts`, `src/renderer/lib/timeline-stability.test.ts`, `src/renderer/lib/tool-call-collapsing.ts`, `src/renderer/lib/tool-call-collapsing.test.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 10:32 GST (Dubai)
### Port: File tree panel, MCP server management, drag-drop to chat
Ported upstream commit 5a9fc6de from kirodex. Adds file tree panel with expand/collapse, file preview modal, and material icons. Adds MCP server context menu (enable/disable server, per-tool toggle, show logs). Adds in-app drag-and-drop from file tree to chat input. Adds MarkdownViewer component, save_mcp_server_config Tauri command, file-icons utility, fileTreeStore, wider zoom limits (0.6–1.3), submodule support in file listing, and path traversal fix in material-icons Vite plugin.

**Modified:** `src-tauri/src/commands/claude_config.rs`, `src-tauri/src/commands/fs_ops.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src/renderer/App.tsx`, `src/renderer/components/MarkdownViewer.tsx`, `src/renderer/components/chat/ChangedFilesSummary.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/code/DiffFileSidebar.tsx`, `src/renderer/components/debug/ClaudeDebugTab.tsx`, `src/renderer/components/diff/DiffPanel.tsx`, `src/renderer/components/file-tree/FilePreviewModal.tsx`, `src/renderer/components/file-tree/FileTreePanel.tsx`, `src/renderer/components/file-tree/FileTypeIcon.tsx`, `src/renderer/components/file-tree/build-tree.ts`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/sidebar/ClaudeConfigPanel.tsx`, `src/renderer/components/sidebar/ClaudeFileViewer.tsx`, `src/renderer/components/sidebar/ClaudeMcpRow.tsx`, `src/renderer/hooks/useAttachments.ts`, `src/renderer/hooks/useAttachments.test.ts`, `src/renderer/hooks/useChatInput.ts`, `src/renderer/hooks/useFileMention.ts`, `src/renderer/hooks/useZoomLimit.ts`, `src/renderer/lib/file-icons.ts`, `src/renderer/lib/ipc.ts`, `src/renderer/stores/claudeConfigStore.ts`, `src/renderer/stores/claudeConfigStore.test.ts`, `src/renderer/stores/debugStore.ts`, `src/renderer/stores/debugStore.test.ts`, `src/renderer/stores/fileTreeStore.ts`, `src/renderer/types/index.ts`, `src/tailwind.css`, `vite.config.ts`, `package.json`, `bun.lock`

## 2026-05-11 10:26 GST (Dubai)
### Tests: Fix mocks for claudeConfigStore, taskStore, and SidebarFooter tests
Ported upstream commit 7452775. Added missing `onClaudeConfigChanged` to claudeConfigStore ipc mock. Updated `persistHistory` assertion to match 6-arg `saveThreads` signature. Added `jsDebugStore`, `useModifierKeys`, and `thread-memory` mocks to SidebarFooter test.

**Modified:** `src/renderer/stores/claudeConfigStore.test.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/components/sidebar/SidebarFooter.test.tsx`

## 2026-05-11 10:05 GST (Dubai)
### Model Icons: Add GLM, Qwen, and MiniMax provider icons
Ported upstream commit 82acfb1. Added three new model providers to `model-icons.tsx`: GLM/ChatGLM (Zhipu AI, #4268FA), Qwen (Alibaba, #615CED), and MiniMax (#F23F5D). Each gets a Provider type entry, regex detection pattern, branded SVG component, and ICON_MAP entry.

**Modified:** `src/renderer/lib/model-icons.tsx`

## 2026-05-11 10:05 GST (Dubai)
### Port: Fix updater relaunch hang, MessageList scroll dedup, memory-section redesign
Ported upstream commit 1b34c79. Skips redundant flush-before-quit/ack cycle when RelaunchFlag is set (fixes restart button hang). Also includes MessageList scroll retry dedup with generation-based cancellation, memory-section visual redesign with stat cards and category rows, SidebarFooter memory spike indicator, and taskStore addProject cleanup (no longer restores soft-deleted threads).

**Modified:** src-tauri/src/lib.rs, src/renderer/components/chat/MessageList.tsx, src/renderer/components/settings/memory-section.tsx, src/renderer/components/sidebar/SidebarFooter.tsx, src/renderer/stores/taskStore.ts, src/renderer/stores/taskStore.test.ts

## 2026-05-11 10:01 GST (Dubai)
### Port: Fix BtwOverlay AgentTask fixtures missing required fields
Ported upstream commit 5e39a64. Added missing `name` and `createdAt` fields to every inline AgentTask fixture in `BtwOverlay.test.tsx` so tsc passes.

**Modified:** `src/renderer/components/chat/BtwOverlay.test.tsx`

## 2026-05-11 09:56 GST (Dubai)
### Port: Memory monitoring + lazy-load archived threads
Ported upstream commit a264d50. Adds a Memory section under Settings → Data with per-thread memory estimates, JS heap readout, and reclaim actions. PTY state is now per-window with configurable scrollback and idle auto-close. Archived threads are lazy-hydrated (metadata-only at startup) dropping ~25 MB to ~100 KB for 500 threads. Sidebar shows a lock icon for archived threads.

**Modified:** `src-tauri/src/commands/pty.rs`, `src-tauri/src/lib.rs`, `src/renderer/components/chat/TerminalDrawer.tsx`, `src/renderer/components/settings/SettingsPanel.tsx`, `src/renderer/components/settings/memory-section.tsx`, `src/renderer/components/settings/settings-shared.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/lib/ipc.ts`, `src/renderer/lib/thread-memory.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/types/index.ts`

## 2026-05-11 09:54 GST (Dubai)
### Chat: Move question cards to bottom of message
Ported upstream commit 151fea4. Moved QuestionCards rendering from above the markdown content to below it in ChatMarkdown, improving visibility of agent questions.

**Modified:** `src/renderer/components/chat/ChatMarkdown.tsx`

## 2026-05-11 09:53 GST (Dubai)
### Notifications: Persistent sidebar badges until thread visited
Ported upstream commit 48139b1. Added orange dot badge on ThreadItem for threads with pending notifications, clear notifiedTaskIds when user navigates to the thread via setSelectedTask, removed window-focus auto-clear so badges persist until explicitly visited.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 09:52 GST (Dubai)
### Chat: Remove unused CleaningReviewCard component
Ported upstream commit 4d177c5. Deleted the unused `CleaningReviewCard` component which was never imported anywhere in the codebase.

**Modified:** `src/renderer/components/chat/CleaningReviewCard.tsx` (deleted)

## 2026-05-11 09:51 GST (Dubai)
### App: Fix unwanted thread switching on window focus
Ported upstream commit c3f9f54. Removed the window focus handler that auto-navigated to the last notified task whenever the app regained focus, which caused unexpected thread switching across projects. The handler now clears the notification badge array without switching threads.

**Modified:** `src/renderer/App.tsx`

## 2026-05-11 09:47 GST (Dubai)
### App: wire zoom limit, What's New, and Clone dialogs into App
Ported upstream commit be07c2d. Integrates useZoomLimit hook, WhatsNewDialog, and CloneRepoDialog into the root App component. Adds a features showcase grid to the empty state and updates split view tooltip copy. Created changelog.ts re-export module for the What's New version-checking logic.

**Modified:** src/renderer/App.tsx, src/renderer/components/header-toolbar.tsx, src/renderer/lib/changelog.ts

## 2026-05-11 09:46 GST (Dubai)
### Chat: port cleaning review card component
Ported upstream commit aa62518 adding CleaningReviewCard component that renders a star-rating review card for cleaning/starring operations in chat.

**Modified:** src/renderer/components/chat/CleaningReviewCard.tsx

## 2026-05-11 09:43 GST (Dubai)
### Git: port clone from GitHub dialog and git_clone command
Ported upstream commit 56c5f1a adding CloneRepoDialog component, `git_clone` Tauri command (uses system git for SSH/credential helper support), IPC binding, and File menu entry with Cmd+Shift+O shortcut. Removed pre-existing duplicate gitClone/gitInit stubs in ipc.ts that conflicted with the new real implementations.

**Modified:** src-tauri/src/commands/git.rs, src-tauri/src/lib.rs, src/renderer/components/CloneRepoDialog.tsx, src/renderer/lib/ipc.ts

## 2026-05-11 09:38 GST (Dubai)
### Sidebar: port blue dot indicator for pending questions
Ported upstream commit that adds a blue status dot on sidebar thread items when the last assistant message has unanswered structured questions. Adds `computeHasPendingQuestion()` to `useSidebarTasks` and a `pending_question` entry to the status dot map in `ThreadItem`.

**Modified:** src/renderer/components/sidebar/ThreadItem.tsx, src/renderer/hooks/useSidebarTasks.ts

## 2026-05-11 09:38 GST (Dubai)
### Icons: regenerate dev icons from new dev logo
Copied k-logo-dev.png as the dev icon, resized to 1024x1024, and generated icon.icns and icon.ico with all standard sizes.

**Modified:** src-tauri/icons/icon.png, src-tauri/icons/icon.icns, src-tauri/icons/icon.ico

## 2026-05-11 09:33 GST (Dubai)
### Update dialog: fix z-index conflict with settings panel
Ported upstream commit 2c29b9e. Added `overlayClassName` prop to DialogContent so UpdateAvailableDialog and RestartPromptDialog can render at z-[60] above the settings panel (z-50). Refactored UpdatesCard and AboutDialog to use the store's triggerDownload/triggerRestart instead of creating separate Update objects. Fixed useUpdateChecker to re-check when pendingUpdateRef is stale.

**Modified:** `src/renderer/components/UpdateAvailableDialog.tsx`, `src/renderer/components/settings/AboutDialog.tsx`, `src/renderer/components/settings/updates-card.tsx`, `src/renderer/components/sidebar/RestartPromptDialog.tsx`, `src/renderer/components/ui/dialog.tsx`, `src/renderer/hooks/useUpdateChecker.ts`

## 2026-05-11 09:28 GST (Dubai)
### Split-view: per-panel state, fix split close, thread ordering, perf audit
Ported upstream commit 3724da8. Split view panels now have fully independent state via PanelContext. Added taskModels map so model/mode/auto-approve changes in one panel don't affect the other. Fixed split closing unexpectedly by making setSelectedTask split-aware. Sidebar thread and project ordering now persists across restarts with per-project threadOrder arrays.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/AgentPanel.tsx`, `src/renderer/components/chat/AutoApproveToggle.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/CompactSuggestBanner.tsx`, `src/renderer/components/chat/MessageItem.tsx`, `src/renderer/components/chat/ModelPicker.tsx`, `src/renderer/components/chat/PanelContext.tsx`, `src/renderer/components/chat/PlanHandoffCard.tsx`, `src/renderer/components/chat/PlanToggle.tsx`, `src/renderer/components/chat/SplitChatLayout.tsx`, `src/renderer/components/chat/WorkingRow.tsx`, `src/renderer/components/sidebar/ProjectItem.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 09:26 GST (Dubai)
### Analytics: port slash command mode tracking and estimated token cost
Ported upstream commit ce93c25. SlashCommandChart now shows stacked horizontal bars by mode (command vs plan) using recharts. TokensChart gains estimated cost display based on most-used model pricing with a 75/25 input/output heuristic. The `record('slash_cmd')` call in useSlashAction now appends the current mode to the detail field.

**Modified:** `src/renderer/components/analytics/AnalyticsDashboard.tsx`, `src/renderer/components/analytics/SlashCommandChart.tsx`, `src/renderer/components/analytics/TokensChart.tsx`, `src/renderer/hooks/useSlashAction.ts`, `src/renderer/lib/analytics-aggregators.ts`

## 2026-05-11 09:21 GST (Dubai)
### Chat: port BtwOverlay component tests
Ported upstream commit 3400c0e. Added test file covering rendering states (null checkpoint, question text, thinking, assistant response), permission banner display and interaction, dismiss via button/Escape/backdrop click, and tool name formatting. Adapted kiroStore mock to claudeConfigStore and added required `name`/`createdAt` fields to task fixtures.

**Modified:** `src/renderer/components/chat/BtwOverlay.test.tsx`

## 2026-05-11 09:19 GST (Dubai)
### HeaderToolbar: simplify terminal toggle to use selectedTaskId
Ported upstream commit 275a073. Removed focusedTaskId derivation and use selectedTaskId directly for terminal toggle state and click handler. Updated split view tooltip copy from 'work side-by-side' to 'compare two threads'.

**Modified:** `src/renderer/components/header-toolbar.tsx`

## 2026-05-11 09:18 GST (Dubai)
### SplitPanelHeader: add always-visible close button on right panel
Ported upstream commit 7e6a1c6. Added a `side` prop to `SplitPanelHeader`. The right panel now shows an always-visible `IconX` close button, while the left panel keeps the hover-only `IconTrash`. Updated `SplitChatLayout` to pass `side='left'` and `side='right'` to each header.

**Modified:** `src/renderer/components/chat/SplitPanelHeader.tsx`, `src/renderer/components/chat/SplitChatLayout.tsx`

## 2026-05-11 09:20 GST (Dubai)
### Split view: pin threads, focus isolation, scroll fix, steer dedup
Ported upstream commit 808b382. Added pin thread feature (right-click context menu, persistence, auto-cleanup on delete). Fixed split view focus isolation for drag overlay, question cards, history cycling, slash commands, mentions, and terminal. Rewrote MessageList scroll to default to bottom on thread switch with pendingScrollRef. Fixed steer duplicate message by reordering removeQueuedMessage before pauseTask. Header terminal button now uses focusedTaskId. Added sidebar divider between pinned/split sections and project list. Includes 16 new unit tests.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/BtwOverlay.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatMarkdown.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/components/chat/QuestionCards.tsx`, `src/renderer/components/chat/SplitChatLayout.tsx`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/hooks/useAttachments.ts`, `src/renderer/hooks/useChatInput.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 09:12 GST (Dubai)
### UpdateAvailableDialog: wire self-contained Radix Dialog modal in App.tsx
Ported upstream commit 5ba095f. Removed the toast-based `UpdateNotifier` component and `RestartPromptDialog` from App.tsx, replacing them with the existing `UpdateAvailableDialog` Radix Dialog modal. Made the dialog's props optional so it works self-contained (auto-opens when an update is available and not snoozed).

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/UpdateAvailableDialog.tsx`

## 2026-05-11 09:11 GST (Dubai)
### BtwOverlay: show permission requests inside btw overlay
Ported upstream commit 4da6f3d. PermissionBanner was rendered behind the full-screen btw overlay, making it impossible to respond to ACP permission requests during side questions. Now renders the banner inside the overlay card.

**Modified:** `src/renderer/components/chat/BtwOverlay.tsx`

## 2026-05-11 09:09 GST (Dubai)
### Split: deactivate split on thread click and set 50:50 ratio
Ported upstream commit a2ce519. Fixed bail-out guard in setSelectedTask that prevented split deactivation when clicking the already-selected left thread. Added activeSplitId: null to setPendingWorkspace. Changed default split ratio from 60:40 to 50:50.

**Modified:** `src/renderer/components/chat/SplitChatLayout.tsx`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 09:06 GST (Dubai)
### Split-screen: persistent split views with sidebar entries and Cmd+\ shortcut
Ported upstream commit a7e3b6d. Refactored split-screen from ephemeral `splitTaskId` to persistent `splitViews` array model. Split pairings survive thread creation and navigation. Added sidebar "Split Views" section, `createSplitView`/`removeSplitView`/`setActiveSplit` actions, Cmd+\ toggle, per-thread scroll position memory, and split state persistence via history-store.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/components/chat/SplitChatLayout.tsx`, `src/renderer/components/chat/SplitThreadPicker.tsx`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`, `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 09:05 GST (Dubai)
### Store: add reorder and custom sort tests
Ported upstream commit 7cdea39. Added four reorderProject tests (no-op, adjacent swap forward/backward, last-to-first) and four useSidebarTasks custom sort tests (preserves store order, recent sort, custom sort no reorder, task order within project).

**Modified:** `src/renderer/stores/taskStore.test.ts`, `src/renderer/hooks/useSidebarTasks.test.ts`

## 2026-05-11 09:02 GST (Dubai)
### Shortcuts: add Cmd+\ split toggle, Cmd+Shift+D debug, Cmd+1-9 thread jump
Ported upstream commit 0a58f05. Added Cmd+\ to toggle split view (opens most recent other thread or closes if already split). Added Cmd+Shift+D to toggle debug panel. Changed Cmd+1-9 to jump to the Nth thread within the active project sorted by creation time instead of switching between projects.

**Modified:** `src/renderer/hooks/useKeyboardShortcuts.ts`

## 2026-05-11 09:00 GST (Dubai)
### Chat: add container queries for compact toolbar and polish spacing
Ported upstream commit 0efd666. Added @container/toolbar query to ChatToolbar so PlanToggle, ModelPicker, AutoApproveToggle, and BranchSelector hide text labels below 480px. Made AutoApproveToggle dropdown compact. Fixed ContextRing overlapping textarea with bg-card and pr-8 padding. Increased virtualizer row height estimates. Show Cmd+Enter hint only when meta key is held.

**Modified:** `src/renderer/components/chat/AssistantTextRow.tsx`, `src/renderer/components/chat/AutoApproveToggle.tsx`, `src/renderer/components/chat/BranchSelector.tsx`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatTextarea.tsx`, `src/renderer/components/chat/ChatToolbar.tsx`, `src/renderer/components/chat/ContextRing.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/components/chat/ModelPicker.tsx`, `src/renderer/components/chat/PlanToggle.tsx`, `src/renderer/components/chat/WorkGroupRow.tsx`

## 2026-05-11 08:58 GST (Dubai)
### Sidebar: replace drag-to-reorder with Move Up/Down context menu
Ported upstream commit d31906e. Removed all pointer-based drag code from TaskSidebar and ProjectItem. Added Move Up/Down options to project context menu with boundary guards. Thread jump labels (1-9) shown when Cmd is held. Keyboard shortcut hints in SidebarFooter. Fixed useSidebarTasks to preserve store order for custom sort.

**Modified:** `src/renderer/components/sidebar/ProjectItem.tsx`, `src/renderer/components/sidebar/SidebarFooter.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/hooks/useSidebarTasks.ts`

## 2026-05-11 08:57 GST (Dubai)
### Split-screen: add toolbar toggle, thread picker, and context menu split options
Ported upstream commit aeb1ff8 adding SplitToggleButton to header toolbar with active/inactive states and thread picker popup. Added 'New split view' and 'Unsplit' options to ThreadItem right-click context menu. Shows split indicator icon on threads in split view. Added jumpLabel prop to ThreadItem.

**Modified:** `src/renderer/components/chat/SplitThreadPicker.tsx`, `src/renderer/components/header-toolbar.tsx`, `src/renderer/components/sidebar/ThreadItem.tsx`

## 2026-05-11 08:53 GST (Dubai)
### Split-screen: add split-screen core with store state, ChatPanel refactor, and layout components
Ported upstream commit b5f3f50 adding split-screen functionality. Added splitTaskId, splitRatio, focusedPanel, and lastSplitPair to task store with persistence in history-store. Refactored ChatPanel to accept optional taskId prop. Created SplitChatLayout, SplitDivider, and SplitPanelHeader components. Wired split routing in App.tsx.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/components/chat/SplitChatLayout.tsx` (new), `src/renderer/components/chat/SplitDivider.tsx` (new), `src/renderer/components/chat/SplitPanelHeader.tsx` (new), `src/renderer/lib/history-store.ts`, `src/renderer/stores/task-store-types.ts`, `src/renderer/stores/taskStore.ts`

## 2026-05-11 08:51 GST (Dubai)
### QueuedMessages: improve queue reorder chevron UX
Ported upstream commit improving move up/down chevron buttons: increased icon size (3→3.5), added hover background, replaced invisible disabled state with dimmed + cursor-not-allowed, wrapped buttons in tooltips, improved aria-labels with message text snippet, and added tabIndex management.

**Modified:** `src/renderer/components/chat/QueuedMessages.tsx`

## 2026-05-11 08:48 GST (Dubai)
### Sidebar: drag-to-reorder projects and Cmd+N project jumping
Ported upstream commit adding pointer-based vertical drag reorder in 'Custom' sort mode, a `useModifierKeys` hook with delayed show / instant hide, ⌘1–⌘9 kbd badges on sidebar projects, and Cmd+N project jumping. Updated test file to match new boolean-returning hook API.

**Modified:** `src/renderer/components/sidebar/ProjectItem.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/hooks/useModifierKeys.ts`, `src/renderer/hooks/useModifierKeys.test.ts`, `src/renderer/hooks/useSidebarTasks.ts`

## 2026-05-11 08:35 GST (Dubai)
### UpdateNotifier: deduplicate toast and style Sonner toasts
Ported upstream fix replacing the `toastIdRef` pattern with a stable `UPDATE_TOAST_ID` constant so Sonner deduplicates by ID. Added dark-themed CSS overrides for Sonner toasts and switched Toaster theme to dark.

**Modified:** `src/renderer/App.tsx`, `src/tailwind.css`

## 2026-05-11 08:28 GST (Dubai)
### Settings: add custom app icon and compact two-column layout
Ported upstream commit adding a custom app icon feature (upload PNG/JPG/WebP to replace dock/About icon) with `set_dock_icon` and `reset_dock_icon` Rust commands, `pick_image` IPC, and a redesigned two-column `SettingsGrid` layout across all settings pages.

**Modified:** `src-tauri/src/commands/fs_ops.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/lib.rs`, `src/renderer/components/settings/AboutDialog.tsx`, `src/renderer/components/settings/SettingsPanel.tsx`, `src/renderer/components/settings/account-section.tsx`, `src/renderer/components/settings/advanced-section.tsx`, `src/renderer/components/settings/appearance-section.tsx`, `src/renderer/components/settings/archives-section.tsx`, `src/renderer/components/settings/general-section.tsx`, `src/renderer/components/settings/keymap-section.tsx`, `src/renderer/components/settings/settings-shared.tsx`, `src/renderer/lib/ipc.ts`, `src/renderer/stores/settingsStore.ts`, `src/renderer/types/index.ts`

## 2026-05-11 08:25 GST (Dubai)
### Tests: fix 3 timeline tests to match current deriveTimeline behavior
Ported upstream commit updating test expectations for working row placement. The working row now always emits when isRunning is true (placed before live tool calls) with a hasStreamingContent flag instead of being suppressed when streaming text is active.

**Modified:** `src/renderer/lib/timeline.test.ts`

## 2026-05-11 08:24 GST (Dubai)
### UI: consistent kbd styling in header breadcrumb and settings
Ported upstream commit for consistent kbd element styling. HeaderBreadcrumb and SettingsPanel tooltips now use `bg-background/15` instead of `bg-muted`. KeymapSection replaces bordered kbd with plain mono text for shortcut display.

**Modified:** `src/renderer/components/header-breadcrumb.tsx`, `src/renderer/components/settings/SettingsPanel.tsx`, `src/renderer/components/settings/keymap-section.tsx`

## 2026-05-11 08:22 GST (Dubai)
### Header: detect fullscreen mode and adjust traffic light padding
Ported upstream fix that adds fullscreen state detection via onResized + isFullscreen() in AppHeader. When macOS enters fullscreen (traffic lights hidden), left padding drops from 74px to 8px so header content uses full width.

**Modified:** `src/renderer/components/AppHeader.tsx`

## 2026-05-11 08:20 GST (Dubai)
### Chat: fix ToolCallDisplay layout for nested TaskList/Subagent cards
Ported upstream fix that wraps TaskListDisplay and SubagentDisplay in a container div with proper padding so they don't overlap the parent ToolCallDisplay border when collapsed. Added border-t separator when tool list is collapsed. Removed my-1 ml-1 from child components since the parent wrapper now handles spacing.

**Modified:** `src/renderer/components/chat/ToolCallDisplay.tsx`, `src/renderer/components/chat/TaskListDisplay.tsx`, `src/renderer/components/chat/SubagentDisplay.tsx`

## 2026-05-11 08:18 GST (Dubai)
### Chat: consistent kbd styling across chat components
Ported consistent kbd element styling from kirodex. Standardized to rounded-sm bg-muted pattern across BtwOverlay, ChatToolbar, EmptyThreadSplash, QuestionCards, and App.tsx EmptyState.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/chat/BtwOverlay.tsx`, `src/renderer/components/chat/ChatToolbar.tsx`, `src/renderer/components/chat/EmptyThreadSplash.tsx`, `src/renderer/components/chat/QuestionCards.tsx`

## 2026-05-11 08:17 GST (Dubai)
### ModelPicker: add error state with shake animation and retry button
Ported error state handling for ModelPicker and ModelPickerPanel. Shows shake animation on error, destructive-colored Retry button after 10s timeout or on modelsError, calling probeCapabilities on retry.

**Modified:** `src/renderer/components/chat/ModelPicker.tsx`, `src/renderer/components/chat/ModelPickerPanel.tsx`

## 2026-05-11 08:15 GST (Dubai)
### CSS: add shake animation keyframes
Ported shake keyframe animation and `--animate-shake` CSS variable from kirodex for error feedback on interactive elements.

**Modified:** `src/tailwind.css`

## 2026-05-11 08:15 GST (Dubai)
### Kbd: upgrade with KbdGroup and tooltip-aware styling
Cherry-picked 766d1b8 from kirodex. Switched Kbd props from HTMLAttributes to React.ComponentProps<'kbd'>, added KbdGroup component for multi-key combinations, added tooltip-content-aware styling, and tightened visual appearance with rounded-sm and w-fit.

**Modified:** `src/renderer/components/ui/kbd.tsx`

## 2026-05-11 08:13 GST (Dubai)
### PlanToggle: replace toggle button with explicit mode dropdown
Cherry-picked 26597f9 from kirodex. Replaced the ambiguous Plan toggle button (which showed "Plan" in both states) with a dropdown that displays the current mode name ("Code" or "Plan") with distinct icons (IconCode, IconListCheck) and a chevron indicator. Adapted mode IDs from kirodex's `kiro_default`/`kiro_planner` to klaudex's `default`/`plan`.

**Modified:** `src/renderer/components/chat/PlanToggle.tsx`

## 2026-05-11 08:10 GST (Dubai)
### AutoApproveToggle: rewrite as dropdown with explicit labels
Cherry-picked 4dc52f60 from kirodex. Replaced the "Full"/"Ask" toggle button with a dropdown picker matching PlanToggle's pattern. Labels are now "Auto-approve" and "Ask first" with short descriptions. Icons changed from shield to IconHandStop/IconMessageQuestion. Auto-approve state uses amber color. Adapted to klaudex's PermissionMode system (ask/bypass).

**Modified:** `src/renderer/components/chat/AutoApproveToggle.tsx`

## 2026-05-11 08:09 GST (Dubai)
### Chat: move working indicator dot above tool calls in timeline
Cherry-picked 67a85baa from kirodex. Reordered the live streaming section of deriveTimeline() so the working indicator row renders above live tool calls instead of below them. Timeline order is now: live text → working dot → live tool calls.

**Modified:** `src/renderer/lib/timeline.ts`

## 2026-05-11 08:08 GST (Dubai)
### Chat: replace /btw lightning bolt with message-circle-question icon
Cherry-picked 652cd769 from kirodex. Replaced the lightning bolt SVG icon with a message-circle-question SVG (speech bubble with question mark) for /btw and /tangent slash commands in BtwOverlay, EmptyThreadSplash, and SlashCommandPicker. Differentiates side-question features from skills which now use the zap/bolt icon.

**Modified:** `src/renderer/components/chat/BtwOverlay.tsx`, `src/renderer/components/chat/EmptyThreadSplash.tsx`, `src/renderer/components/chat/SlashCommandPicker.tsx`

## 2026-05-11 08:07 GST (Dubai)
### Chat: replace wrench icon with zap for skills and show "skill: Name" in pills
Cherry-picked e46fa890 from kirodex. Replaced IconTool (wrench) with IconBolt (zap) for skills in the @ mention picker, skill mention pills, and inline skill mentions in chat messages. Updated FileMentionPill to display "skill: Formatted Name" for skill pills.

**Modified:** `src/renderer/components/chat/FileMentionPicker.tsx`, `src/renderer/components/chat/UserMessageRow.tsx`

## 2026-05-11 08:05 GST (Dubai)
### Icons: resize squircle to Apple HIG 824×824 standard
Cherry-picked c9fe5b50 from kirodex. Resized dev/prod icon artwork to 824×824 hard-edge squircle (matching IINA, Ghostty, Rectangle, Maccy, Zed, MonitorControl). Regenerated .icns and .ico.

**Modified:** `src-tauri/icons/dev/icon.icns`, `src-tauri/icons/dev/icon.ico`, `src-tauri/icons/dev/icon.png`, `src-tauri/icons/prod/icon.icns`, `src-tauri/icons/prod/icon.ico`, `src-tauri/icons/prod/icon.png`

## 2026-05-11 08:03 GST (Dubai)
### Icons: match dev and prod icon sizing and spacing
Cherry-picked b727cc13 from kirodex. Replaced edge-to-edge icon.png files with properly-padded source versions that have macOS-style transparent padding. Regenerated .icns and .ico for both dev and prod variants. Removed orphaned root-level icon files.

**Modified:** `src-tauri/icons/dev/icon.icns`, `src-tauri/icons/dev/icon.ico`, `src-tauri/icons/dev/icon.png`, `src-tauri/icons/prod/icon.icns`, `src-tauri/icons/prod/icon.ico`, `src-tauri/icons/prod/icon.png`, `src-tauri/icons/icon.icns` (deleted), `src-tauri/icons/icon.ico` (deleted), `src-tauri/icons/icon.png` (deleted)

## 2026-05-11 08:01 GST (Dubai)
### Port: wire folder drag-drop pills through ChatInput and PillsRow
Cherry-picked f124d59c from kirodex. Passes folderPaths and handleRemoveFolder from useChatInput through ChatInput → ChatTextarea → PillsRow. Folder pills render with IconFolder, truncated name, and full-path tooltip. Updated PillsRow tests to include the new required props.

**Modified:** `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/ChatTextarea.tsx`, `src/renderer/components/chat/PillsRow.tsx`, `src/renderer/components/chat/PillsRow.test.tsx`

## 2026-05-11 07:58 GST (Dubai)
### Port: folder drop support, working row streaming indicator, dev/prod icon split
Cherry-picked 1d30a803 from kirodex. Added folder drag-and-drop support (new `is_directory` IPC command, `useAttachments` handles folders separately), WorkingRow shows pulse dot when streaming content is visible, split app icons into dev/prod directories, removed SVG icons.

**Modified:** `src-tauri/src/commands/fs_ops.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/MessageList.tsx`, `src/renderer/components/chat/WorkingRow.tsx`, `src/renderer/components/chat/WorkingRow.test.tsx`, `src/renderer/hooks/useAttachments.ts`, `src/renderer/hooks/useChatInput.ts`, `src/renderer/lib/ipc.ts`, `src/renderer/lib/timeline.ts`, `src-tauri/icons/dev/*`, `src-tauri/icons/prod/*`

## 2026-05-11 07:56 GST (Dubai)
### Port: update docs terminal description and fix shortcut/command docs
Cherry-picked e985fb23 from kirodex. Updated keyboard shortcuts to alphabetical order, added Escape terminal note, added /data alias, and fixed /usage description in slash commands docs.

**Modified:** `docs/keyboard-shortcuts.md`, `docs/slash-commands.md`

## 2026-05-11 07:54 GST (Dubai)
### Port: reconnect restored threads after soft-delete
Cherry-picked a4174442 from kirodex. Added `needsNewConnection` flag to `AgentTask`. `restoreTask` now sets status to paused and flags the task so `sendMessageDirect` spawns a fresh ACP connection via `ipc.createTask` instead of sending on a dead handle.

**Modified:** `src/renderer/types/index.ts`, `src/renderer/stores/taskStore.ts`, `src/renderer/components/chat/ChatPanel.tsx`

## 2026-05-11 07:53 GST (Dubai)
### Port: fix crash fallback with close button and timer cleanup
Cherry-picked e4c7abb6 from kirodex. Added a close button to the crash-fallback overlay, stored the 10s crash timer on `window.__crashTimer` for cleanup, and added logic in main.tsx to cancel the timer and remove the fallback element once React mounts successfully.

**Modified:** index.html, src/renderer/main.tsx

## 2026-05-11 07:52 GST (Dubai)
### Port: fix overflow-hidden clipping question card options
Cherry-picked 206c6531 from kirodex. Removed `overflow-x-auto overflow-y-hidden` from the inner message wrapper in MessageList since it created a scroll container that clipped QuestionCard options and footers.

**Modified:** src/renderer/components/chat/MessageList.tsx

## 2026-05-11 07:51 GST (Dubai)
### Port: fix skill mention pill text contrast
Cherry-picked ca50fffb from kirodex. Changed skill mention pill text from `text-yellow-300` to `text-yellow-600 dark:text-yellow-400` for readable contrast against the `bg-yellow-500/15` background.

**Modified:** src/renderer/components/chat/FileMentionPicker.tsx

## 2026-05-11 07:51 GST (Dubai)
### PR: create catch-up to main pull request
Created PR #4 from `catch-up` branch to `main` via `gh pr create`.

**Modified:** n/a (remote operation)

## 2026-05-11 07:49 GST (Dubai)
### Icons: redesign from square to squircle shape (port from kirodex@696dbbf)
Ported upstream icon redesign changing shape from square to superellipse squircle (n=5). Updated dev icon SVG with klaudex orange (#F97316) squircle path, and prod icons (SVG + all platform binaries) with blue (#0000FF) squircle. Dev binaries kept as-is (pending regeneration from new SVG source).

**Modified:** src-tauri/icons/icon.svg, src-tauri/icons/prod/icon.svg, src-tauri/icons/prod/icon.icns, src-tauri/icons/prod/icon.ico, src-tauri/icons/prod/icon.png

## 2026-05-11 07:48 GST (Dubai)
### Timeline: show working indicator during long tool calls (port from kirodex@8798d6b)
Ported upstream fix so the "Crafting…" working row appears during long-running tool calls and subagents. Changed suppression condition from any live activity to only streaming text/thinking. Reordered live rows so indicator renders below tool call displays. Added tests.

**Modified:** src/renderer/lib/timeline.ts, src/renderer/lib/timeline.test.ts

## 2026-05-11 07:46 GST (Dubai)
### Git2: Remove openssl dynamic linking dependency (port from kirodex@7e8c4de)
Ported upstream fix that drops ssh and https features from git2 crate, eliminating openssl-sys and libssh2-sys transitive deps that cause launch crashes on machines without Homebrew OpenSSL 3.

**Modified:** src-tauri/Cargo.toml, src-tauri/Cargo.lock

## 2026-05-11 07:44 GST (Dubai)
### Release: Reduce bundle targets from "all" to specific list (port from kirodex@aabb3ce)
Ported upstream change to `src-tauri/tauri.conf.json` that replaces `"targets": "all"` with an explicit list `["app", "dmg", "deb", "appimage", "nsis"]`, dropping MSI and RPM bundle targets. Protected paths (README, .github/**, activity.md) were reverted.

**Modified:** src-tauri/tauri.conf.json

## 2026-05-11 07:42 GST (Dubai)
### Recovery: Crash recovery UI and corrupted store detection (port from kirodex@df477a6)
Ported upstream commit that adds crash recovery features: history-store validates on first access and auto-resets if corrupted, ErrorBoundary shows a recovery screen with Reload and Reset buttons, index.html shows a pre-React fallback after 10s if the JS bundle fails, and a new `reset_app_data` Rust command deletes all files in app_data_dir.

**Modified:** index.html, src-tauri/src/lib.rs, src/renderer/lib/history-store.ts, src/renderer/main.tsx

## 2026-05-11 07:41 GST (Dubai)
### Sidebar: Auto-focus newly added project (port from kirodex@fd0e3f0)
Ported upstream commit that adds `lastAddedProject` state to taskStore and an `autoFocus` prop to `ProjectItem`. When a project is added, its sidebar button receives focus automatically, then the flag is cleared.

**Modified:** src/renderer/components/sidebar/ProjectItem.tsx, src/renderer/components/sidebar/TaskSidebar.tsx, src/renderer/stores/task-store-types.ts, src/renderer/stores/taskStore.ts

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

## 2026-05-12 20:05 GST (Dubai)

### HeaderToolbar: Switch file tree icon to IconListTree

Replaced `IconFiles` with `IconListTree` in the `FileTreeToggleButton` component for a more conventional file-tree/explorer representation matching VS Code's sidebar icon.

**Modified:** `src/renderer/components/header-toolbar.tsx`

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
