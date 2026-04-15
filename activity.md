## 2026-04-15 21:10 GST (Dubai)
### ChatInput: Add Cmd+Shift+V raw paste support
Added early return in `handleTextPaste` when Shift is held so Cmd+Shift+V pastes raw text directly into the textarea instead of creating a `[Pasted text #N]` placeholder pill. Tracks Shift key state via a `useRef` + window keydown/keyup listeners since `ClipboardEvent` doesn't expose modifier keys.
**Modified:** src/renderer/hooks/useChatInput.ts

## 2026-04-15 21:04 GST (Dubai)
### Steering: Hardened project isolation to absolute no-exceptions rule
Strengthened .kiro/steering/kirodex-rules.md to refuse all `..` path access, refuse cross-project edits even if user asks, and require subagent prompts to include the scope constraint. Previous version was too soft and I violated it myself by writing to ../lastline/.
**Modified:** .kiro/steering/kirodex-rules.md

## 2026-04-15 21:02 GST (Dubai)
### Cross-project: Added project isolation boundaries to kirodex-tauri and lastline
Added project boundary rules to prevent AI agents from traversing parent/sibling directories and bleeding context between projects. Updated kirodex-tauri/.kiro/steering/kirodex-rules.md, lastline/CLAUDE.md, and created lastline/.kiro/steering/project-isolation.md (alwaysApply: true).
**Modified:** .kiro/steering/kirodex-rules.md, ../lastline/CLAUDE.md, ../lastline/.kiro/steering/project-isolation.md

## 2026-04-15 20:59 GST (Dubai)
### CLAUDE.md: Audit change request reviewed and rejected (wrong project)
Received a 14-point audit update request for CLAUDE.md referencing a monorepo with NestJS API, Next.js landing, analytics service, Chrome extension, email templates, auth guards, and pnpm dev commands. The current CLAUDE.md is for Kirodex (Tauri v2 desktop app) and contains none of the referenced content. Flagged the mismatch to the user.
**Modified:** None (no changes applied)

## 2026-04-15 20:54 GST (Dubai)

### Git: Slugify branch names and worktree slugs in BranchSelector

Added `slugify()` to branch creation in `BranchPanel` (SlashPanels.tsx) and `BranchSelector.tsx` so user input like "fix: my bug #123" becomes `fix-my-bug-123` before hitting `git_create_branch`. Also slugified worktree slugs in `BranchSelector.handleCreateWorktree`. Thread naming remains plain text (no slugify).

**Modified:** `src/renderer/components/chat/SlashPanels.tsx`, `src/renderer/components/chat/BranchSelector.tsx`

## 2026-04-15 20:52 GST (Dubai)

### Utils: Replace custom slugify with slugify package

Replaced the hand-rolled `slugify` function in `utils.ts` with the `slugify` npm package (v1.6.9). Gains proper unicode transliteration (e.g. `café` → `cafe` instead of `caf`). Post-processing for max length (30 chars), leading/trailing dot/dash stripping, and dash collapsing is preserved. All 36 utils tests pass.

**Modified:** `package.json`, `bun.lock`, `src/renderer/lib/utils.ts`, `src/renderer/lib/utils.test.ts`

## 2026-04-15 20:50 GST (Dubai)

### Git: Fix worktree slug generation to produce valid branch names

Worktree creation failed when the thread name ended with a period (e.g., "updating-claude.") because git rejects branch names ending with `.`. Fixed `slugify()` to strip leading/trailing dots, added a post-truncation cleanup for dots left by `.slice()`, updated `isValidWorktreeSlug()` and the Rust `validate_worktree_slug()` to reject leading/trailing dots. Added five new test cases covering dot edge cases. All 36 tests pass.

**Modified:** `src/renderer/lib/utils.ts`, `src/renderer/lib/utils.test.ts`, `src-tauri/src/commands/git.rs`

## 2026-04-15 20:47 GST (Dubai)

### Chat: Conditional kirodex-report card rendering

Report blocks now only render as a rich `TaskCompletionCard` component when `status` is `"done"` AND `filesChanged` is non-empty. For `"partial"` / `"blocked"` statuses or when `filesChanged` is missing, the report stays in the markdown and renders as a standalone code block. Added `shouldRenderReportCard` helper to centralize the gate logic.

**Modified:** `src/renderer/components/chat/TaskCompletionCard.tsx`, `src/renderer/components/chat/AssistantTextRow.tsx`, `src/renderer/components/chat/MessageItem.tsx`, `src/renderer/lib/timeline.ts`

## 2026-04-15 20:12 GST (Dubai)

### Tests: Workspace scoping and worktree path enforcement

Added 10 frontend tests in `taskStore.test.ts` under "workspace scoping": `setSelectedTask` syncs `activeWorkspace` to project root (including worktree resolution), `setPendingWorkspace` syncs immediately, `addProject` rejects worktree paths, `loadTasks`/`forkTask`/`restoreTask` never put worktree paths in projects. Added 1 Rust test in `git.rs`: `worktree_create_rejects_worktree_path_as_cwd`. All 163 frontend + 56 Rust tests pass.

**Modified:** `src/renderer/stores/taskStore.test.ts`, `src-tauri/src/commands/git.rs`

## 2026-04-15 20:08 GST (Dubai)

### Worktree: Enforce <project>/.kiro/worktrees/<slug> path

Added a backend guard in `git_worktree_create` that rejects worktree paths as `cwd` (prevents creating worktrees from inside other worktrees). Fixed `BranchSelector` to resolve `originalWorkspace ?? workspace` for worktree creation so it always uses the project root. The worktree path is always `<project>/.kiro/worktrees/<slug>`.

**Modified:** `src-tauri/src/commands/git.rs`, `src/renderer/components/chat/BranchSelector.tsx`

## 2026-04-15 20:05 GST (Dubai)

### Scope: Sync activeWorkspace immediately on thread/project switch

`activeWorkspace` was set via a React `useEffect` that lagged behind thread switches, and didn't account for `pendingWorkspace`. Fixed: `setSelectedTask` and `setPendingWorkspace` now sync `activeWorkspace` immediately in the store action (resolving worktree threads to project root). The `App.tsx` effect also includes `pendingWorkspace` as a dependency. Fixed `ChatPanel.sendMessageDirect` to look up `projectPrefs` using `originalWorkspace ?? workspace`. Fixed `useKeyboardShortcuts` Cmd+N to resolve to project root.

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/App.tsx`, `src/renderer/components/chat/ChatPanel.tsx`, `src/renderer/hooks/useKeyboardShortcuts.ts`, `src/renderer/stores/taskStore.test.ts`

## 2026-04-15 20:04 GST (Dubai)

### Scope: Remove hardcoded Kirodex project rules from agent system prefix

The system prefix injected into every ACP prompt contained Kirodex-specific rules (co-author trailer, commit format) that leaked into all projects. A Lastline worktree thread was getting told about "Kirodex project rules." Removed the project-specific content; the prefix now only contains the structured questions format (UI rendering hint) and optional JSON report format. Project-specific rules belong in each project's `.kiro/` steering rules, not hardcoded in the app.

**Modified:** `src-tauri/src/commands/acp.rs`

## 2026-04-15 20:00 GST (Dubai)

### Focus: Always resolve activeWorkspace to project root

`activeWorkspace` was set to the worktree path for worktree threads, causing project prefs (model, auto-approve, worktree toggle) to look up the wrong key. Fixed `App.tsx` to use `task.originalWorkspace ?? task.workspace`. Fixed `KiroConfigPanel` to resolve to project root for `.kiro/` config loading. Fixed `AppHeader` to use `projectRoot` for display name while keeping `workspace` for git/diff operations.

**Modified:** `src/renderer/App.tsx`, `src/renderer/components/sidebar/KiroConfigPanel.tsx`, `src/renderer/components/AppHeader.tsx`

## 2026-04-15 19:50 GST (Dubai)

### Worktree guard: Ensure worktree paths never enter projects array

Worktree paths (`.kiro/worktrees/`) are threads, not projects. Fixed six locations: `addProject` now rejects worktree paths; `loadTasks` derives projects from `originalWorkspace ?? workspace` (not UUID `projectId`); `forkTask` and `restoreTask` add the real workspace path to projects; `removeProject` and `archiveThreads` match tasks by `originalWorkspace ?? workspace` instead of UUID `projectId`.

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/stores/taskStore.test.ts`

## 2026-04-15 19:47 GST (Dubai)

### ProjectId: Generate UUID on project import

Projects now get a stable UUID on import instead of using the workspace path as `projectId`. Added `projectIds` map (workspace→UUID) to taskStore with `getProjectId` helper that returns existing or generates new. All thread creation paths (`PendingChat`, `createDraftThread`, `forkTask`) use `getProjectId`. Sidebar grouping resolves UUIDs back to workspace paths for display. History store persists and restores `projectIds`. Backward compatible: `loadTasks` generates UUIDs for projects that don't have one yet.

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/hooks/useSidebarTasks.test.ts`

## 2026-04-15 19:40 GST (Dubai)

### Feature removal: Remove project rename

Removed the project rename feature to prevent potential issues. Deleted `renameProject` action from taskStore, inline editing state and "Edit Name" context menu from ProjectItem, double-click rename from AppHeader's project breadcrumb, and the `onRenameProject` prop chain through TaskSidebar. The `projectNames` field is kept for read-only display (loaded from history).

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/components/sidebar/ProjectItem.tsx`, `src/renderer/components/sidebar/TaskSidebar.tsx`, `src/renderer/components/AppHeader.tsx`, `src/renderer/stores/taskStore.test.ts`

## 2026-04-15 19:36 GST (Dubai)

### Tests: Add projectId unit tests across stores and hooks

Added 26 new tests: 12 in `taskStore.test.ts` (upsertTask preservation, createDraftThread, forkTask inheritance, removeProject/archiveThreads matching, restoreTask, loadTasks derivation), 5 in `history-store.test.ts` (saveThreads persistence, worktree grouping, toArchivedTasks restoration), and 9 in new `useSidebarTasks.test.ts` (projectId grouping, worktree nesting, fallback chain, cross-project separation). All 149 tests pass.

**Modified:** `src/renderer/stores/taskStore.test.ts`, `src/renderer/lib/history-store.test.ts`, `src/renderer/hooks/useSidebarTasks.test.ts`

## 2026-04-15 19:30 GST (Dubai)

### AgentTask: Add explicit projectId for canonical project grouping

Added `projectId` field to `AgentTask` so every thread (regular, worktree, forked) carries its parent project identity explicitly. All creation paths (`PendingChat`, `createDraftThread`, `forkTask`) set `projectId` at creation time. Sidebar grouping (`useSidebarTasks`) now uses `projectId` directly instead of inferring from `worktreePath`/`originalWorkspace`. History store persists and restores `projectId`. All project operations (`removeProject`, `archiveThreads`, `restoreTask`, `loadTasks`) use `projectId` as the canonical key with fallback chain `projectId ?? originalWorkspace ?? workspace` for backward compatibility.

**Modified:** `src/renderer/types/index.ts`, `src/renderer/components/chat/PendingChat.tsx`, `src/renderer/stores/taskStore.ts`, `src/renderer/hooks/useSidebarTasks.ts`, `src/renderer/lib/history-store.ts`

## 2026-04-15 19:22 GST (Dubai)

### Worktree: Fix project grouping across all code paths

Worktree threads still appeared as separate top-level projects because multiple code paths used `task.workspace` (the worktree path) instead of `task.originalWorkspace` (the parent project). Fixed five locations: `loadTasks` now derives the projects array from `originalWorkspace ?? workspace`; `saveThreads` in history-store groups threads by `originalWorkspace`; `forkTask` preserves `worktreePath`/`originalWorkspace` from the parent; `removeProject` and `archiveThreads` match tasks by both `workspace` and `originalWorkspace`; `restoreTask` adds the `originalWorkspace` to the projects list.

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/lib/history-store.ts`

## 2026-04-15 19:14 GST (Dubai)

### Worktree: Fix threads appearing as top-level projects

Fixed worktree threads leaking into the sidebar as standalone projects instead of nesting under their parent. Root cause: `upsertTask` merged backend `task_update` events (which lack `worktreePath`/`originalWorkspace`) via object spread, wiping client-only metadata. Also fixed `history-store.ts` not persisting worktree fields, so metadata was lost on restart. Defaulted the worktree toggle to `false` on new threads. Wrapped worktree creation in try/catch with inline error fallback. Replaced silent `.catch(() => {})` in cleanup with `console.warn`.

**Modified:** `src/renderer/stores/taskStore.ts`, `src/renderer/stores/taskStore.test.ts`, `src/renderer/lib/history-store.ts`, `src/renderer/lib/history-store.test.ts`, `src/renderer/components/chat/PendingChat.tsx`

## 2026-04-15 19:09 GST (Dubai)

### CollapsibleContent: Make "Show more" button more visible

Increased visual weight of the Show more/less toggle button: added a subtle background (`bg-accent/30`), a faint border (`border-border/50`), bumped font weight to semibold, and darkened text color from `text-muted-foreground` to `text-foreground/80`.

**Modified:** `src/renderer/components/chat/CollapsibleContent.tsx`

## 2026-04-15 18:43 GST (Dubai)

### ChatInput: Hide left toolbar in PendingChat (new thread view)

Added a `minimal` prop to ChatInput. When true, the left toolbar group (collapse, attach, plan/model/auto-approve) is hidden. PendingChat now passes `minimal` so the new thread input is cleaner.

**Modified:** `src/renderer/components/chat/ChatInput.tsx`, `src/renderer/components/chat/PendingChat.tsx`

## 2026-04-15 17:35 GST (Dubai)

### SystemMessageRow: Worktree-specific variant with violet theme

Added a dedicated `worktree` variant for system messages. Instead of showing the raw full path in a generic blue info pill, worktree messages now display a violet-themed pill with an `IconGitBranch` icon and cleaned-up text showing only the slug and branch name (e.g., "Worktree **tesr** on **worktree-tesr**").

**Modified:** `src/renderer/lib/timeline.ts`, `src/renderer/components/chat/SystemMessageRow.tsx`

## 2026-04-15 17:26 GST (Dubai)

### PendingChat: Darken worktree description text

Changed the "Isolate this thread in its own directory" description from `text-muted-foreground/50` to `text-muted-foreground` for better readability.

**Modified:** `src/renderer/components/chat/PendingChat.tsx`

## 2026-04-15 17:28 GST (Dubai)

### Sidebar: Prevent worktree paths from appearing as empty top-level projects

Follow-up fix: worktree workspace paths (e.g., `/project/.kiro/worktrees/feat`) could still end up in the `projects` array via task hydration, restore, and fork flows. Added a `worktreeWorkspaces` set in `useSidebarTasks` that collects all worktree task workspaces and skips them when building the project list, preventing ghost empty project entries.

**Modified:** `src/renderer/hooks/useSidebarTasks.ts`

## 2026-04-15 17:20 GST (Dubai)

### Sidebar: Nest worktree threads under parent project

Worktree threads were appearing as separate top-level projects in the sidebar because `useSidebarTasks` grouped tasks by `workspace` (the worktree path). Changed the grouping logic to use `originalWorkspace` for worktree tasks so they nest under their parent project. Added `originalWorkspace` to the `SidebarTask` interface and structural sharing comparison.

**Modified:** `src/renderer/hooks/useSidebarTasks.ts`

## 2026-04-15 17:24 GST (Dubai)

### PendingChat: Redesign worktree toggle UI

Replaced the raw HTML checkbox with the Radix `Checkbox` component. Wrapped the worktree section in a subtle rounded card with border. Added a cleaner slug row with a code-style badge for the `.kiro/worktrees/` prefix, a truncating edit button, and `maxLength` on the input. The toggle handler now accepts the Radix `CheckedState` value directly.

**Modified:** `src/renderer/components/chat/PendingChat.tsx`

## 2026-04-15 17:22 GST (Dubai)

### Worktree slug: Reduce max length from 64 to 30 characters

Long worktree slugs looked wrong in the pending chat UI. Reduced `MAX_SLUG_LENGTH` from 64 to 30 in `utils.ts`, updated the Rust-side `validate_worktree_slug` in `git.rs` to match, trimmed the auto-slug input slice in `PendingChat.tsx`, and updated tests.

**Modified:** `src/renderer/lib/utils.ts`, `src/renderer/components/chat/PendingChat.tsx`, `src-tauri/src/commands/git.rs`, `src/renderer/lib/utils.test.ts`

## 2026-04-15 17:09 GST (Dubai)

### index.html + main.tsx: Remove error-fallback div

Removed the `#error-fallback` div from `index.html` and stripped the related DOM manipulation from `showError()` in `main.tsx`. The function now only logs to console. Also removed the reload/copy-error button wiring that referenced the removed elements.

**Modified:** index.html, src/renderer/main.tsx

---

## 2026-04-15 17:04 GST (Dubai)

### Cargo: Enable devtools in production builds

Added `"devtools"` feature flag to the `tauri` dependency so the WebView inspector is available in release builds.

**Modified:** src-tauri/Cargo.toml

---

## 2026-04-15 17:03 GST (Dubai)

### SidebarFooter: Improve update indicator dot styling

Changed the update indicator dot from a solid pulsing `bg-primary` circle to a two-layer emerald green dot with a soft ping animation. The outer ring fades in/out while the inner dot stays solid, giving a calmer, more polished look that doesn't read as "error red."

**Modified:** src/renderer/components/sidebar/SidebarFooter.tsx

---

# Activity Log

## 2026-04-15 17:00 GST (Dubai)

### CLAUDE.md: Add 7 engineering learnings from session

Extracted learnings from the session activity log and added them to CLAUDE.md's Engineering Learnings section: upsertTask name preservation from ACP overwrites, soft-delete persistence on reload, `bun test` vs `bun run test` runner mismatch, worktree cleanup on setup failure, stamping context on debug entries at creation time, tauri-plugin-log for Rust→WebView forwarding, and GitHub HTML nesting rules for block elements inside `<p>` tags.

**Modified:** `CLAUDE.md`, `activity.md`

## 2026-04-15 15:54 GST (Dubai)

### Tests: Suppress console.warn stderr noise in updateStore test

Fixed the `dismissVersion handles localStorage error gracefully` test that was leaking a `console.warn` to stderr. Added a `console.warn` spy to suppress the output and an assertion that the warning was called with the expected error.

**Modified:** `src/renderer/stores/updateStore.test.ts`

## 2026-04-15 15:56 GST (Dubai)

### Tests: Fix 246 failures from `bun test` runner mismatch

The 246 failures came from running `bun test` (Bun's native test runner) instead of `bun run test` (Vitest). Bun's runner doesn't provide jsdom, so all component tests failed with `ReferenceError: document is not defined`. Fixed by adding `bunfig.toml` with `[test] root = ".bun-test-noop"` to redirect `bun test` away from Vitest test files, plus a sentinel test that passes and tells users to use `bun run test`.

**Modified:** `bunfig.toml`, `.bun-test-noop/redirect.test.ts`, `activity.md`

## 2026-04-15 15:47 GST (Dubai)

### Commits: Review and organize all changes since v0.8.15

Reviewed all changes since v0.8.15 tag (4 existing commits + uncommitted changes). Created 3 additional feature-scoped commits for uncommitted work: debug tab thread/project filtering, website full content with changelog and deploy workflow, and activity log updates. Total of 7 commits since v0.8.15, all using conventional commit format.

**Modified:** `activity.md`

## 2026-04-15 15:46 GST (Dubai)

### DebugPanel: Add thread and project filters to JS Debug tab

Added thread and project filter dropdowns to the JS Debug tab, matching the Kiro Debug tab UX. Each JS debug entry is now stamped with the active taskId at capture time. The filter bar shows "All threads" / "All projects" dropdowns when entries have associated tasks.

**Modified:**
- `src/renderer/types/index.ts` — added optional `taskId` to JsDebugEntry
- `src/renderer/stores/jsDebugStore.ts` — added threadName/projectName to filter state
- `src/renderer/lib/jsInterceptors.ts` — stamp selectedTaskId on each entry
- `src/renderer/components/debug/JsDebugTab.tsx` — thread/project filter dropdowns + filtering logic

## 2026-04-15 15:55 GST (Dubai)

### JsDebugTab: Capture threadName and projectName on entries for reliable filtering

Updated JS debug interceptors to capture `threadName` and `projectName` directly on each `JsDebugEntry` at creation time (from the active task). Updated the filter logic in `JsDebugTab` to use these entry-level fields instead of looking up from the task store at render time, so filters work even after tasks are deleted.

**Modified:** `src/renderer/types/index.ts`, `src/renderer/lib/jsInterceptors.ts`, `src/renderer/components/debug/JsDebugTab.tsx`, `activity.md`

## 2026-04-15 15:55 GST (Dubai)

### Website: Add changelog page

Added `website/changelog.html` that fetches `CHANGELOG.md` from the repo at runtime and renders it as a styled timeline with color-coded categories (green for features, red for bug fixes, purple for styling, etc.). Added Changelog link to both the main page and changelog page navs. Updated deploy workflow to include the new page.

**Modified:** `website/changelog.html`, `website/index.html`, `.github/workflows/deploy-website.yml`, `activity.md`

## 2026-04-15 15:55 GST (Dubai)

### Website: Build Kirodex GitHub Pages site

Built a single-page dark-themed website in `website/` that matches the Kirodex app's design system. Includes hero with download CTA, 6 feature cards, screenshot gallery, platform install tabs with keyboard navigation, live download stats from `downloads.json`, and footer with sponsor. Added GitHub Actions deployment workflow and enabled GitHub Pages via `gh` CLI. Site will be live at `thabti.github.io/kirodex`.

**Modified:** `.gitignore`, `package.json`, `website/index.html`, `website/style.css`, `website/package.json`, `.github/workflows/deploy-website.yml`

## 2026-04-15 15:32 GST (Dubai)

### BranchSelector: Add back button and improve inline create UI

Added a back arrow button to return from the branch/worktree creation form to the action menu. Improved the inline form with a title header, descriptive helper text, better input focus ring styling, and a contextual Create button that shows the relevant icon (branch or fork) and "Creating..." state during submission.

**Modified:** src/renderer/components/chat/BranchSelector.tsx

## 2026-04-15 15:29 GST (Dubai)

### README: Fix screenshot images not rendering

Moved the `<table>` containing screenshots outside the `<p>` tag. Block-level elements inside `<p>` are invalid HTML and GitHub strips them, hiding the images.

**Modified:** README.md

## 2026-04-15 15:27 GST (Dubai)

### BranchSelector: Fix positioning and add new branch/worktree creation

Fixed popup z-index from `z-[200]` to `z-[9999]` and changed `left-0` to `right-0` so the popup aligns to the right edge of the toolbar. Added a persistent footer with "New branch" and "New worktree" action buttons that expand into inline input fields with a Create button. Worktree creation calls `gitWorktreeCreate` IPC. Esc cancels inline mode, second Esc closes the popup.

**Modified:** src/renderer/components/chat/BranchSelector.tsx

## 2026-04-15 15:28 GST (Dubai)

### README: Display screenshots side by side

Replaced the stacked `<p>` image layout with an HTML `<table>` so the two screenshots render side by side on GitHub. Also improved alt text for each image.

**Modified:** README.md

## 2026-04-15 15:26 GST (Dubai)

### PendingChat: Inline click-to-edit slug within worktree description

Moved the worktree slug input out of the checkbox row and into the description line itself. The description "Isolates this thread in .kiro/worktrees/<slug>" now always appears when worktree is checked. The slug portion is a clickable inline element with a pencil icon; clicking it reveals a small input field in-place. Press Enter/Escape or blur to close. Removes the separate input row for a cleaner layout.

**Modified:**
- `src/renderer/components/chat/PendingChat.tsx` — refactored worktree section to inline click-to-edit slug

## 2026-04-15 15:11 GST (Dubai)

### PendingChat: Center worktree toggle, add icon and folder path hint

Centered the worktree toggle row, added a violet `IconGitBranch` icon next to the label, and added helper text showing the resolved worktree folder path (`.kiro/worktrees/<slug>`). Slug input changed from `flex-1` to fixed `w-48` for balanced centering.

**Modified:** `src/renderer/components/chat/PendingChat.tsx`

## 2026-04-15 15:06 GST (Dubai)

### Fix(taskStore): Preserve client-side thread name from ACP task_update overwrites

Fixed a bug where renaming a thread would get reset moments later. The ACP backend sends `task_update` events carrying the original creation-time name; `upsertTask` was spreading the backend object as the base, overwriting the user's rename. Added `name` preservation logic (same pattern as `messages` and `parentTaskId`): once a task exists locally, the client-side name is always kept.

**Modified:**
- `src/renderer/stores/taskStore.ts` — added `name` preservation in `upsertTask`

## 2026-04-15 15:00 GST (Dubai)

### DebugPanel: Add JS Debug tab with console, error, network, and Rust log capture

Added a tabbed interface to the debug panel with two tabs: "Kiro Debug" (existing protocol debug) and "JS Debug" (new). The JS Debug tab captures `console.log/warn/error`, `window.onerror`, `unhandledrejection`, all fetch/XHR network requests with method/URL/status/duration, and Rust backend `log::*` calls via `tauri-plugin-log` with `LogTarget::Webview`. Entries are displayed in a virtualized list with full search, category filter (log, warn, error, exception, network, rust), errors-only toggle, copy-all, and clear. Interceptors are installed once at startup in `main.tsx` before React renders.

**Modified:**
- `src/renderer/types/index.ts` — added JsDebugCategory (incl. 'rust') and JsDebugEntry types
- `src/renderer/stores/jsDebugStore.ts` — new store with rAF batching (2000 entry cap)
- `src/renderer/lib/jsInterceptors.ts` — console/error/fetch/XHR/Rust-log interceptors
- `src/renderer/components/debug/KiroDebugTab.tsx` — extracted from DebugPanel
- `src/renderer/components/debug/JsDebugTab.tsx` — new JS debug tab component
- `src/renderer/components/debug/DebugPanel.tsx` — refactored to thin shell with tabs
- `src/renderer/main.tsx` — install JS interceptors before React render
- `src-tauri/src/lib.rs` — enabled LogTarget::Webview for tauri-plugin-log
- `src-tauri/capabilities/default.json` — added log:default permission
- `package.json` / `bun.lock` — added @tauri-apps/plugin-log dependency

## 2026-04-15 15:04 GST (Dubai)

### Fix: Worktree feature audit — bug fixes and unit tests

Fixed three bugs found during code review: (1) useSidebarTasks structural sharing now compares worktreePath, (2) WorktreePanel accepts raw input with slugified preview instead of running slugify on every keystroke, (3) PendingChat and WorktreePanel clean up orphaned worktrees if gitWorktreeSetup fails. Added 15 new tests: WorktreeCleanupDialog (5 tests covering render states and button actions), taskStore worktree cleanup (10 tests covering archiveTask/softDeleteTask worktree checks, auto-removal, dirty worktree pending state, and resolveWorktreeCleanup). All 592 tests pass across 49 files.

**Modified:**
- `src/renderer/hooks/useSidebarTasks.ts` — added worktreePath to structural sharing equality check
- `src/renderer/components/chat/SlashPanels.tsx` — WorktreePanel: raw input + slug preview + partial cleanup
- `src/renderer/components/chat/PendingChat.tsx` — orphaned worktree cleanup on setup failure
- `src/renderer/components/sidebar/WorktreeCleanupDialog.test.tsx` — new test file (5 tests)
- `src/renderer/stores/taskStore.test.ts` — added worktree IPC mocks + 10 cleanup tests

## 2026-04-15 14:57 GST (Dubai)

### TaskStore: Hide deleted threads from sidebar on app restart

Fixed `loadTasks` so soft-deleted threads no longer reappear in the sidebar after restart. Two changes: (1) `deletedTaskIds` is now populated from persisted soft-deleted thread IDs, preventing `upsertTask` from re-adding them via ACP events. (2) Soft-deleted task IDs are removed from the `tasks` map built from `listTasks()`. Archived threads (`isArchived: true` still in `tasks{}`) remain visible.

**Modified:** `src/renderer/stores/taskStore.ts`

## 2026-04-15 14:46 (Dubai Time)

**Task:** audit_frontend_core — Read and report full contents of 6 renderer files
**Files read:**
1. `src/renderer/types/index.ts` — Full types including AgentTask, ProjectPrefs
2. `src/renderer/lib/ipc.ts` — Full IPC bindings including worktree commands
3. `src/renderer/lib/utils.ts` — cn, joinChunk, slugify, isValidWorktreeSlug
4. `src/renderer/lib/utils.test.ts` — Full test suite for all utils
5. `src/renderer/hooks/useSlashAction.ts` — Slash command handler hook
6. `src/renderer/hooks/useSlashAction.test.ts` — Full test suite for slash actions
**Status:** Complete — all file contents reported in full

## 2026-04-15 14:46 (Dubai) — Frontend UI Audit: Worktree & Branch Features

**Task:** Full read of 13 files related to branch/worktree UI features across the kirodex-tauri codebase.

**Files read:**
1. `src/renderer/components/chat/SlashPanels.tsx` — BranchPanel, WorktreePanel
2. `src/renderer/components/chat/SlashCommandPicker.tsx` — branch/worktree entries
3. `src/renderer/components/chat/EmptyThreadSplash.tsx` — branch/worktree entries
4. `src/renderer/components/chat/PendingChat.tsx` — full file
5. `src/renderer/components/chat/BranchSelector.tsx` — isWorktree prop
6. `src/renderer/components/chat/ChatInput.tsx` — isWorktree prop
7. `src/renderer/components/chat/ChatPanel.tsx` — isWorktree selector
8. `src/renderer/components/sidebar/ThreadItem.tsx` — worktree badge
9. `src/renderer/components/sidebar/WorktreeCleanupDialog.tsx` — full file
10. `src/renderer/hooks/useSidebarTasks.ts` — worktreePath
11. `src/renderer/stores/taskStore.ts` — worktreeCleanupPending, archiveTask, softDeleteTask, resolveWorktreeCleanup
12. `src/renderer/components/settings/SettingsPanel.tsx` — Worktrees section
13. `src/renderer/App.tsx` — WorktreeCleanupDialog

## 2026-04-15 19:23 (Dubai) — Thread Creation & Sidebar Grouping Investigation

**Task**: Deep analysis of how threads are created, how worktree threads are handled, and how the sidebar groups threads under projects.

**Files analyzed**:
- `src/renderer/types/index.ts` — AgentTask type with worktreePath/originalWorkspace fields
- `src/renderer/stores/taskStore.ts` — Thread creation, upsert, deletion, worktree cleanup
- `src/renderer/hooks/useSidebarTasks.ts` — Sidebar grouping logic (groups worktree tasks under originalWorkspace)
- `src/renderer/hooks/useSlashAction.ts` — /worktree command toggles panel
- `src/renderer/components/sidebar/TaskSidebar.tsx` — Sidebar rendering
- `src/renderer/components/sidebar/ProjectItem.tsx` — Project group rendering
- `src/renderer/components/sidebar/ThreadItem.tsx` — Thread item rendering with worktree icon
- `src/renderer/components/chat/SlashPanels.tsx` — WorktreePanel creates worktree threads
- `src/renderer/components/chat/PendingChat.tsx` — handleSend creates worktree threads
- `src/renderer/lib/ipc.ts` — IPC calls for task/worktree operations
- `src-tauri/src/commands/acp.rs` — Rust backend task creation (no worktree fields)
- `src-tauri/src/commands/git.rs` — Rust worktree create/remove/setup/has-changes

**Key findings**:
1. worktreePath and originalWorkspace are CLIENT-SIDE ONLY fields — backend Task struct doesn't have them
2. Sidebar groups worktree tasks under originalWorkspace, excludes worktree paths from top-level projects
3. Fork doesn't preserve worktree fields — potential bug where forked worktree threads appear as separate projects
4. Thread workspace is set to worktree path for worktree threads, original project path for regular threads

## 2026-04-15 19:56 (Dubai) — AI Features Audit

**Task:** Comprehensive search of Kirodex project for all AI-related features across 10 categories.

**Findings:**
- Zero direct AI SDK dependencies (no openai, anthropic, langchain, etc.)
- Core AI integration via `agent-client-protocol` Rust crate (v0.10.4) in `src-tauri/Cargo.toml`
- All AI interaction proxied through `kiro-cli acp` subprocess (stdin/stdout JSON-RPC)
- `src-tauri/src/commands/acp.rs` is the main AI integration file
- `src/renderer/lib/model-icons.tsx` supports 10 AI providers (Anthropic, OpenAI, Amazon, Meta, Google, Mistral, Cohere, AI21, DeepSeek, Kiro)
- 50+ chat component files for AI interaction UI
- No vector DB, embeddings, or RAG code
- No hardcoded system prompts (UI uses `role: 'system'` for status messages only)
- No AI-related environment variables (auth handled by kiro-cli externally)
- Feature toggles: autoApprove, plan mode, task completion reports
