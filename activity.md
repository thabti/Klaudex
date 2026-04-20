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