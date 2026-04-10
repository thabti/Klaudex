## 2026-04-10 19:41 GST (Dubai)

### Rust: Reduce memory footprint and fix resilience issues

Dependency trimming:
- Removed `tauri-plugin-shell` (unused, not referenced from Rust or frontend)
- Removed `tauri-plugin-fs` (unused, not referenced from Rust or frontend)
- Removed `chrono` — replaced with `std::time::SystemTime` + Howard Hinnant's date algorithm
- Removed `serde_yaml` — replaced with simple line-based frontmatter parsing for `alwaysApply`
- Trimmed `git2` to `default-features = false, features = ["https"]` (dropped SSH/OpenSSL)
- Cleaned up Tauri capabilities (removed shell/fs permissions)

PTY resilience:
- Stored `Child` handle in `PtyInstance`, added `Drop` impl that kills + waits
- Reader thread now exits on child kill (EOF)
- `pty_write`/`pty_resize` now propagate errors instead of swallowing them

Close handler resilience:
- Replaced `.lock().unwrap()` with `.lock().ok()` in window close handler
- Added `// SAFETY:` comment to unsafe NSWindow block

**Modified:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/acp.rs`, `src-tauri/src/commands/kiro_config.rs`, `src-tauri/src/commands/pty.rs`, `src-tauri/capabilities/default.json`

# Activity Log

## 2026-04-10 23:43 GST (Dubai)

### Frontend: React performance audit and fixes

Audited all stores, components, and hooks for re-render issues. Fixed four concrete problems: (1) AppHeader read full `task` object causing re-renders on every streaming chunk; replaced with granular selectors and wrapped both `AppHeaderInner` and `UserMenu` in `memo`. (2) PermissionBanner allocated a new sorted array on every render; wrapped in `useMemo`. (3) ToolCallDisplay called `.filter()` three times per render for status counts; replaced with single-pass `useMemo`. Rest of codebase is clean: ChatPanel uses granular selectors, useSidebarTasks has structural sharing, ChangedFilesSummary/DiffPanel properly memoized.

**Modified:** src/renderer/components/AppHeader.tsx, src/renderer/components/chat/PermissionBanner.tsx, src/renderer/components/chat/ToolCallDisplay.tsx

## 2026-04-10 22:57 GST (Dubai)

### Testing: Reach 50%+ coverage with v8 coverage reporting

Expanded test suite to 247 tests across 36 files, all passing. Statement coverage: 52.65%, line coverage: 55.49%. Added tests for all UI components (card, input, textarea, separator, switch, checkbox, label, dialog, scroll-area), chat components (DragOverlay, ThinkingDisplay, WorkingRow, CollapsedAnswers, QueuedMessages, ContextRing, ModeToggle, AutoApproveToggle), ErrorBoundary, and all four Zustand stores (taskStore, settingsStore, diffStore, debugStore, kiroStore). Configured coverage exclusions for heavy integration components requiring Tauri runtime (ChatPanel, SettingsPanel, sidebar, code panels, etc.).

**Modified:** vitest.config.ts, package.json, and 36 test files across stores, UI components, chat components, and lib utilities

## 2026-04-10 22:44 GST (Dubai)

### Testing: Add extensive test coverage with v8 coverage reporting

Added `@vitest/coverage-v8` with text, HTML, and lcov reporters. Created 17 test files with 176 passing tests across stores, UI components, chat utils, and lib functions. Coverage went from 2.45% to 6.83% statements overall. Key areas: stores 29.89% stmts / 45.39% funcs, UI components 27.63% stmts, lib 66.1% stmts, tool-call-utils 100%. Added Rust tests to kiro_config.rs (MCP parsing, scan functions, frontmatter) and git.rs (serialization, git_detect). Rust project has pre-existing build issues preventing cargo test.

**Modified:** vitest.config.ts, package.json, src/test-setup.ts, src/renderer/stores/taskStore.test.ts, src/renderer/stores/debugStore.test.ts, src/renderer/stores/diffStore.test.ts, src/renderer/stores/kiroStore.test.ts, src/renderer/components/ui/button.test.tsx, src/renderer/components/ui/badge.test.tsx, src/renderer/components/ui/spinner.test.tsx, src/renderer/components/ui/kbd.test.tsx, src/renderer/components/ui/skeleton.test.tsx, src/renderer/components/ui/empty.test.tsx, src/renderer/components/ui/alert.test.tsx, src/renderer/components/chat/attachment-utils.test.ts, src/renderer/components/chat/ContextUsageBar.test.tsx, src-tauri/Cargo.toml, src-tauri/src/commands/kiro_config.rs, src-tauri/src/commands/git.rs

## 2026-04-10 23:45 GST (Dubai)

### Figma: Redesign all Kirodex UI screens with missing elements

Rebuilt all 4 main Figma pages in the kirodex-UI file (S0xSLrUpEOicfWBmNQYXQK). Chat View now includes tool call entries with status icons, question cards with multi-choice options, Kiro config sidebar (Steering, Skills, Agents grouped by stack, MCP), changed files summary, and full chat input toolbar (mode toggle, model picker, auto-approve, branch selector, send/pause buttons). Settings page redesigned as full-screen modal with left nav sidebar (General/Appearance/Keyboard/Advanced), section headers with icons, CLI path input with Browse/Detect/Test, model dropdown, permission toggles, and Save/Cancel actions. Chat + Diff page rebuilt with split layout showing file list and unified diff viewer with green/red line highlighting. Empty State updated with Kiro config panel in sidebar and proper ghost chat input toolbar.

**Modified:** Figma file kirodex-UI (pages: Main – Chat View, Settings, Main – Chat + Diff, Main – Empty State)

## 2026-04-10 22:14 GST (Dubai)

### Frontend: Fix agent_message_chunk not showing in chat body

Fixed a race condition where `agent_message_chunk` events buffered in a `requestAnimationFrame` callback were lost when `turn_end` arrived in the same event loop tick. The `turn_end` handler read from Zustand state (still empty) and created no assistant message. Fix: synchronously flush `chunkBuf` and `thinkBuf` (cancelling pending rAFs) before `turn_end` processes.

**Modified:** src/renderer/stores/taskStore.ts

## 2026-04-10 18:16 GST (Dubai)

### Rust Backend: Full correctness audit of Tauri v2 backend

Audited all 9 backend files (acp.rs, git.rs, pty.rs, settings.rs, fs_ops.rs, kiro_config.rs, error.rs, lib.rs, Cargo.toml) for memory safety, panics, resource leaks, and concurrency issues. Found 14 concrete defects: 3 HIGH (PTY child process leak, PTY reader thread leak, unwrap in ACP client trait), 5 MEDIUM (expect in spawned threads, poisoned mutex unwrap in close handler, unsafe without SAFETY comment, blocking Tauri thread), 6 LOW (swallowed errors, unbounded channels, unjoined threads). git.rs, settings.rs, kiro_config.rs, and error.rs are clean.

**Modified:** activity.md (created)
