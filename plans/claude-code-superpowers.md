# Plan: Claude Code Superpowers — Skills Palette + Subagent Visual Upgrade + Context Window Meter

> Generated: 2026-05-13
> Branch: `feat/claude-code-superpowers`
> Mode: EXPANSION

## Overview

Ship three first-class desktop surfaces for Claude Code mechanics that today live invisibly in the terminal: (1) a Cmd+K Skills Palette that fuzzy-searches `.claude/skills/*/SKILL.md` and invokes them inline, (2) a richer Subagent visualizer with nested-tree rendering, role-colored cards, elapsed-time clocks, and click-to-focus, and (3) a Context Window Meter promoted into the AppHeader with an extended tooltip showing token breakdown, $cost, and an auto-compact estimate. Target user: Klaudex power users who want Claude Code's hidden capabilities exposed natively.

## Scope Challenge

CodeMap scans surfaced significant existing scaffolding that should be **reused, not rebuilt**:

- `ContextRing` already exists at `src/renderer/components/chat/ContextRing.tsx` (gradient tiers, tooltip, compaction-aware). It is rendered inside `ChatInput.tsx:129`, not the AppHeader. Scope: relocate / dual-mount, then extend the tooltip — not build from scratch.
- `AcpSubagentDisplay` exists at `src/renderer/components/chat/AcpSubagentDisplay.tsx` (expand/collapse, status icons, role labels, progress bar, auto-collapse). Scope: enhance the flat list into a nested tree, add role-colored avatars, add elapsed clock, add click-to-focus — not rewrite.
- Skills are already parsed via `claude_config.rs::scan_skills` (line 251) and surfaced as `useClaudeConfigStore.config.skills`. The `ClaudeSkill` Rust struct and `ClaudeSkill` TS interface both omit `description` and `bodyExcerpt`. Scope: extend parser + types, then build a dedicated palette modal.
- Fuzzy search is already implemented at `src/renderer/lib/fuzzy-search.ts::fuzzyScore`. The `FileMentionPicker` shows a working pattern for in-chat pickers; the Skills Palette will be a global Cmd+K Radix dialog rather than an in-input picker.
- Compaction proximity is already partially handled by `CompactSuggestBanner.tsx` (threshold 30). The header tooltip will surface a complementary "auto-compact in ~N turns" estimate without duplicating the banner.

The pre-existing `plans/claude-code-features.md` plan covered permissions / output styles / hooks viewer / statusline / slash command browser / CLAUDE.md memory editor — most of which shipped in commit `1375610`. This plan deliberately **does not overlap** with that scope.

EXPANSION mode selected because the three features cover three distinct surfaces (skills, subagents, header) and each has nontrivial edge cases that deserve dedicated test tasks.

## Architecture

```
                                ┌──────────────────────────────────────────┐
                                │              AppHeader                    │
                                │  Breadcrumb │ HeaderToolbar              │
                                │             │   ContextRing  [TASK-009]  │
                                │             │   + tooltip ext [TASK-010] │
                                └─────────────┬────────────────────────────┘
                                              │  task.usage
                                              ▼
              ┌──────────────────────────────────────────────────────────┐
              │                       ChatPanel                            │
              │  MessageList                                                │
              │    └─ ToolCallDisplay                                       │
              │         └─ AcpSubagentDisplay  [TASK-011 nested tree]      │
              │              ├─ AgentCard      [TASK-012 role colors,      │
              │              │                  elapsed clock]              │
              │              └─ click → scroll-to-toolcall [TASK-013]      │
              │  ChatInput  (existing ContextRing left intact)              │
              └──────────────────────────────────────────────────────────┘

  Cmd+K [TASK-006]
       │
       ▼
  ┌──────────────────────────────────────┐
  │  SkillsPalette (Radix Dialog)        │  [TASK-007, mounted by TASK-008]
  │   fuzzy search input                  │
  │   skill cards: name + description     │
  │   ↑↓ navigate • ↵ invoke • esc close   │
  └──────────────────────────────────────┘
                │                                  ┌────────────────────────┐
                │ reads                            │ subagent-style.ts      │
                ▼                                  │  [TASK-002]            │
  ┌──────────────────────────────────────┐         │  role → color/icon    │
  │  skillsPaletteStore   [TASK-004]     │         └────────────────────────┘
  │  open, query, selectedIndex          │
  └──────────────────────────────────────┘
                │                                  ┌────────────────────────┐
                │ reads config.skills              │ useSkillInvoke         │
                ▼                                  │  [TASK-005]            │
  ┌──────────────────────────────────────┐         │  dispatches            │
  │  useClaudeConfigStore (existing)     │         │  'splash-insert' CE     │
  └──────────────────────────────────────┘         └────────────────────────┘
                │
                │ via Tauri  get_claude_config
                ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Rust: claude_config.rs                                                 │
  │   ClaudeSkill { name, source, filePath, description, bodyExcerpt }    │
  │   scan_skills() — extended  [TASK-003]                                │
  └──────────────────────────────────────────────────────────────────────┘
                │
                ▼
  ~/.claude/skills/<name>/SKILL.md      ← YAML frontmatter parsed
  .claude/skills/<name>/SKILL.md
```

## Existing Code Leverage

| Sub-problem | Existing Code | Action |
|------------|---------------|--------|
| Skill data scanning | `src-tauri/src/commands/claude_config.rs::scan_skills` (line 251) | Extend — add description + body excerpt |
| Skill state in renderer | `src/renderer/stores/claudeConfigStore.ts` | Reuse as-is |
| Fuzzy search algorithm | `src/renderer/lib/fuzzy-search.ts::fuzzyScore` | Reuse as-is |
| Modal primitive | `src/renderer/components/ui/dialog.tsx` (Radix) | Reuse as-is |
| Keyboard shortcut hook | `src/renderer/hooks/useKeyboardShortcuts.ts` (329 lines, line 38 handler) | Extend — add Cmd+K binding |
| Inline insert protocol | `src/renderer/components/chat/EmptyThreadSplash.tsx` `splash-insert` CustomEvent | Reuse — palette dispatches same event |
| Skill row visual reference | `src/renderer/components/sidebar/ClaudeSkillRow.tsx` (57 lines) | Reference pattern; palette card is new |
| Context ring component | `src/renderer/components/chat/ContextRing.tsx` (82 lines) | Reuse as-is in new mount location |
| Context usage type | `task.usage.contextUsage: { used, size }` + `CompactionStatus` (types/index.ts:59) | Reuse as-is |
| Token formatters | `src/renderer/components/chat/UsagePanel.tsx::formatTokens, formatCost` (line 8, 15) | Reuse — extract or import |
| Header toolbar slot | `src/renderer/components/AppHeader.tsx` line 94 (`HeaderToolbar`) | Extend — accept ContextRing slot |
| Subagent base component | `src/renderer/components/chat/AcpSubagentDisplay.tsx` (182 lines) | Refactor — flat → nested |
| Subagent type | `SubagentInfo` at `src/renderer/types/index.ts:378` | Extend optionally — add `parent?: string` if not present in ACP payload |
| Subagent test harness | `src/renderer/components/chat/AcpSubagentDisplay.test.tsx` | Extend — add nested-tree assertions |
| Subagent listener | `src/renderer/stores/task-store-listeners.ts::parseSubagents` (line 122) | Extend if ACP payload includes parent relations |
| Compaction proximity | `src/renderer/components/chat/CompactSuggestBanner.tsx` (`COMPACT_SUGGEST_THRESHOLD = 30`) | Reference — header tooltip uses complementary estimate |

## Tasks

### TASK-001: Extend `ClaudeSkill` TS interface with description and bodyExcerpt fields

Add two optional fields to `ClaudeSkill` in `src/renderer/types/index.ts:325`:
- `description?: string` — parsed from the SKILL.md frontmatter `description` key
- `bodyExcerpt?: string` — first ~200 chars of the markdown body after the frontmatter

These flow through serde camelCase from Rust. No Rust changes here; this task only ensures the TypeScript surface accepts the fields when TASK-003 starts emitting them.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `ClaudeSkill` has `description?: string` and `bodyExcerpt?: string` optional fields
- [ ] All existing consumers (`ClaudeSkillRow.tsx`, `claudeConfigStore.ts`) compile without changes
- [ ] `bun run check:ts` passes (failure case: extra fields must not break existing tests)

**Agent:** react-vite-tailwind-engineer

**Priority:** P0

---

### TASK-002: Create subagent role → style mapping module

New file `src/renderer/lib/subagent-style.ts` exporting:
- `getSubagentRoleColor(role: string): { from: string; to: string; bg: string; text: string }` — gradient + tints, mirroring `ContextRing.tsx` TIERS pattern
- `getSubagentRoleIcon(role: string): React.ComponentType` — Tabler icon per role (planner→IconBrain, research→IconSearch, guide→IconBook, builder→IconHammer, default→IconRobot)
- Role taxonomy: `default | plan | guide | research | builder` plus the kiro_* aliases already in `AcpSubagentDisplay.tsx:11-19`

Pure module, no React hooks. Tabler icons must come from `@tabler/icons-react` per CLAUDE.md icon rule.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Module exports two pure functions plus the role taxonomy constant
- [ ] Each known role returns distinct colors (no two roles share the same `from` gradient stop)
- [ ] Unknown roles fall back to `default` without throwing (failure case: getSubagentRoleColor("garbage") must return the default tier)

**Agent:** react-vite-tailwind-engineer

**Priority:** P0

---

### TASK-003: Extend Rust `ClaudeSkill` struct and `scan_skills` to parse description and body excerpt

Modify `src-tauri/src/commands/claude_config.rs`:
- Add `description: Option<String>` and `body_excerpt: Option<String>` to `ClaudeSkill` struct (line 24). Keep `#[serde(rename_all = "camelCase")]` so TS receives `bodyExcerpt`.
- In `scan_skills` (line 251), after locating each `<name>/SKILL.md`, call the existing `split_frontmatter` helper (line 102) and `body_excerpt` helper (line 128) to populate the new fields.
- If the frontmatter has no `description`, leave the field as `None`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `scan_skills` populates `description` from YAML frontmatter `description` key
- [ ] `body_excerpt` is truncated to ~200 chars and excludes heading lines (use existing helper)
- [ ] Skills with malformed YAML frontmatter still return a `ClaudeSkill` with `None` description rather than panicking (failure case)
- [ ] `bun run check:rust` and `bun run test:rust` both pass

**Agent:** general-purpose

**Priority:** P0

---

### TASK-004: Create `skillsPaletteStore` Zustand store

New file `src/renderer/stores/skillsPaletteStore.ts` exporting `useSkillsPaletteStore` with state:
- `isOpen: boolean`
- `query: string`
- `selectedIndex: number`

And actions: `open()`, `close()`, `toggle()`, `setQuery(q)`, `setSelectedIndex(i)`, `moveSelection(delta: 1 | -1)`.

Follow the bail-out-guard pattern from CLAUDE.md (every setter checks if value changed before calling set). Wrap `setQuery` to reset `selectedIndex` to 0 when query changes.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] All actions update state via bail-out-guarded `set` calls
- [ ] `setQuery` resets `selectedIndex` to 0 on each query change
- [ ] `moveSelection` clamps to [0, listLength-1] given a list-length parameter — verify by passing 0 and a large index (failure case: must not go negative or overflow)

**Agent:** react-vite-tailwind-engineer

**Priority:** P0

---

### TASK-005: Create `useSkillInvoke` hook to dispatch skill activation

New file `src/renderer/hooks/useSkillInvoke.ts` exporting `useSkillInvoke()` which returns a function `invoke(skill: ClaudeSkill)`. Behavior:
- Dispatches a `splash-insert` CustomEvent on `document` with `detail: \`/${skill.name}\`` (same protocol used by `EmptyThreadSplash.tsx:13`)
- If no active task exists, fallback: copy `skill.bodyExcerpt ?? skill.name` to `navigator.clipboard` and surface a toast notification (use existing toast pattern if present, else `console.warn`)
- Always closes the palette via `useSkillsPaletteStore.getState().close()`

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Dispatches `splash-insert` with the correct slash-prefixed skill name
- [ ] Closes the palette after invocation
- [ ] When `document` is in an unusual state (no active input listener), invocation does not throw — only warns (failure case)

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-006: Add Cmd+K (Ctrl+K on non-mac) binding to toggle Skills Palette

Extend `src/renderer/hooks/useKeyboardShortcuts.ts` (line 38 handler):
- Detect `(e.metaKey || e.ctrlKey) && e.key === 'k'` (lowercase) and `!e.shiftKey && !e.altKey`
- Call `useSkillsPaletteStore.getState().toggle()`
- `e.preventDefault()` to suppress the browser's default address-bar focus
- Skip when an input/textarea is focused **unless** the user wants the palette anyway — match existing convention: allow Cmd+K to fire even from textareas (it's a top-level palette)

Audit current bindings to confirm Cmd+K is not already claimed. If it is, escalate by switching to Cmd+Shift+K and document in TASK-019.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Cmd+K (Ctrl+K on Linux/Windows) toggles `isOpen` in `useSkillsPaletteStore`
- [ ] Shortcut fires even when chat input is focused
- [ ] Existing shortcuts (Cmd+L focus, Cmd+Shift+L split, Cmd+Shift+Y yolo) still work unchanged (failure case: regression test all three)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-004
**Priority:** P1

---

### TASK-007: Build `SkillsPalette` modal component

New file `src/renderer/components/chat/SkillsPalette.tsx` — Radix `Dialog`-based command palette. Structure:
- Reads `useSkillsPaletteStore` for `isOpen`, `query`, `selectedIndex`
- Reads `useClaudeConfigStore((s) => s.config.skills)` (defaulted to `[]`)
- Filters skills via `fuzzyScore(query, skill.name + ' ' + (skill.description ?? ''))`, sorts ascending by score, slices top 50
- Renders a fuzzy search input that updates `query` on change and handles ArrowUp/Down/Enter/Escape via key handler
- Each skill card displays: name, source badge (`global` / `local`), `description` (or `bodyExcerpt` fallback truncated to 150 chars), filePath as subtitle
- Selected card has `bg-accent` highlight; clicking or pressing Enter invokes `useSkillInvoke()`
- Empty state: "No skills match" with a hint to install skills under `~/.claude/skills/`
- Match the `Dialog`/`DialogContent` shell pattern from `WhatsNewDialog.tsx`

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] Fuzzy filter ranks exact-prefix matches highest (e.g., "com" surfaces `commit` above `cost-estimate`)
- [ ] ArrowDown beyond list length stays clamped to last item
- [ ] Pressing Enter on an empty list does NOT crash and does NOT close the palette (failure case)
- [ ] Pressing Escape closes the palette without invoking any skill

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-001, TASK-004, TASK-005
**Priority:** P1

---

### TASK-008: Mount `SkillsPalette` as a global overlay in `App.tsx`

Mount `<SkillsPalette />` once in `src/renderer/App.tsx` so it is available regardless of which view is active. Place it outside the main layout flex so it does not affect layout when closed. Ensure the keyboard hook from TASK-006 is also active at the App level (it likely already is).

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `SkillsPalette` is mounted exactly once in the React tree
- [ ] Closed palette adds zero DOM cost (Radix `Dialog` handles this via portal)
- [ ] Mounting works whether the user is on Dashboard, ChatPanel, or SettingsPanel views (failure case: verify no view crashes when palette is open)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-007
**Priority:** P1

---

### TASK-009: Render `ContextRing` inside `HeaderToolbar`

Extend `src/renderer/components/header-toolbar.tsx` (read first to confirm signature). Inside the toolbar, read `useTaskStore` for the active task's `usage.contextUsage` and `compactionStatus`, and render `<ContextRing used={ctx.used} size={ctx.size} compactionStatus={status} />` when contextUsage exists. The component already exists at `src/renderer/components/chat/ContextRing.tsx` — import and reuse.

The duplicate ContextRing in `ChatInput.tsx:129` stays. Both ring from the same store value, so they will always agree.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] AppHeader shows `ContextRing` when a task with usage is active
- [ ] No ring shown when no task is active or when `contextUsage` is null
- [ ] Header ring and ChatInput ring always show the same percentage (failure case: snapshot both, assert equality)

**Agent:** react-vite-tailwind-engineer

**Priority:** P1

---

### TASK-010: Extend `ContextRing` tooltip with token breakdown and auto-compact estimate

Modify `src/renderer/components/chat/ContextRing.tsx`. Replace the single-line `tooltipText` (line 39-43) with a structured tooltip body:
- Row 1: `Context: {pct}% used  ·  {used/1000}k / {size/1000}k tokens`
- Row 2: per-category breakdown: `input | output | cache-read | cache-creation` with token counts (reuse `formatTokens` from `UsagePanel.tsx:8`)
- Row 3: cost in $ for the current task (reuse `formatCost` from `UsagePanel.tsx:15`)
- Row 4: "Auto-compact in ~{N} turns" estimate computed as `Math.max(0, Math.floor((100 - pct) / avgPctPerTurn))` where `avgPctPerTurn` is derived from `(pct / Math.max(1, Math.floor(task.messages.length / 2)))` (assistant-message count as turn proxy) and defaults to `5` when message count is zero. `task.contextUsage` lives at `src/renderer/types/index.ts:120`; there is no `task.usage.turns` field so derivation must come from message history.

When the tooltip body exceeds the standard Radix `TooltipContent` width, switch to `Popover` or set `className="max-w-[280px]"`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Tooltip displays four labelled rows when full usage data is present
- [ ] When per-category breakdown is missing (e.g., older task), tooltip gracefully shows only the totals (failure case)
- [ ] Auto-compact estimate is `0` (rendered as "soon") when `pct >= 95`

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-009
**Priority:** P1

---

### TASK-011: Refactor `AcpSubagentDisplay` to nested-tree renderer

Modify `src/renderer/components/chat/AcpSubagentDisplay.tsx`. Replace the flat `subagents.map(...)` (line 119) with a tree-builder that:
- Groups subagents by `parent` field if present in the ACP payload (check `task-store-listeners.ts::parseSubagents` at line 122); falls back to flat list when no parent relationships exist
- Renders each level with `paddingLeft: depth * 12px`
- Uses a tree-line guide character on left edge of nested rows

If the ACP payload does not yet expose a parent field, add an optional `parent?: string` to `SubagentInfo` in `types/index.ts:378` and parse it from the raw payload in `parseSubagents`. Document the addition in `CLAUDE.md` learnings in TASK-020.

**Type:** refactor
**Effort:** M

**Acceptance Criteria:**
- [ ] Subagents with `parent` field render indented under their parent card
- [ ] When no subagent has a `parent` field, layout is identical to today (regression preserved)
- [ ] Circular parent references do not cause infinite recursion (failure case: detect and render flat with a warning)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-001, TASK-002
**Priority:** P1

---

### TASK-012: Enrich `AgentCard` with role color, elapsed-time clock, and depth indent

Modify the `AgentCard` component inside `src/renderer/components/chat/AcpSubagentDisplay.tsx:133`. Changes:
- Replace the static `IconRobot` (line 144) with `getSubagentRoleIcon(agent.role)` from `lib/subagent-style.ts` (TASK-002)
- Tint the role badge background using `getSubagentRoleColor(agent.role).bg`
- Add an elapsed-time clock next to the status: stores `startedAt` from first `running` transition; renders `MM:SS` ticking every second using a `useElapsedTime(startedAt)` helper or `useEffect` with `setInterval`. Stop ticking when status becomes `completed` or `failed`.
- Accept a `depth` prop to apply indent padding

Refer to existing tabular-nums + Tabler icon patterns in the file.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Each agent card shows a role-specific icon and tinted role badge
- [ ] Elapsed timer ticks once per second while `status === 'running'` and stops on terminal states
- [ ] An agent that never transitions to `running` shows no clock at all (failure case: no "00:00" placeholder)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-002, TASK-011
**Priority:** P1

---

### TASK-013: Add click-to-focus interaction to subagent cards

Modify `src/renderer/components/chat/AcpSubagentDisplay.tsx` AND `src/renderer/components/chat/MessageList.tsx`. **No exported scroll helper exists today** — `MessageList` only uses internal `virtualizer.scrollToIndex(idx, ...)` at lines 175 and 259. This task creates the CustomEvent bridge:

1. In `MessageList.tsx`, add a `useEffect` that listens for the `chat-scroll-to` CustomEvent on `document` (carrying `detail: { messageId: string }`). On receipt, locate the timeline row index for that messageId and call `virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })`. Clean up the listener on unmount.
2. In `AcpSubagentDisplay.tsx`, make each `AgentCard` clickable. On click:
   - Find the first tool call in the active task's messages where `tool_use_id` or `subagent_name` matches `agent.name` (read from `useTaskStore` messages array)
   - Dispatch `document.dispatchEvent(new CustomEvent('chat-scroll-to', { detail: { messageId } }))` for the located tool-call message id
   - Set `userToggledRef.current = true` to suppress auto-collapse (line 49-54)
   - Add `role="button"`, `tabIndex={0}`, and Enter/Space key handlers for a11y

If no matching message exists, no-op silently — do NOT dispatch the event.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Clicking an agent card scrolls the chat to the matching tool call
- [ ] Cards have keyboard focus support (Tab and Enter work)
- [ ] Clicking a card with no matching message does not crash, scroll, or close the panel (failure case)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-012
**Priority:** P1

---

### TASK-014: Rust test — `scan_skills` extracts description and body excerpt

Extend the `tests` module in `src-tauri/src/commands/claude_config.rs` (line 590). Add new test cases:
- `scan_skills_extracts_description_from_frontmatter` — write a fake `SKILL.md` with `description: Foo bar` and assert the scanned skill has `description: Some("Foo bar")`
- `scan_skills_returns_none_when_description_missing` — assert `None` when no description key
- `scan_skills_body_excerpt_truncates_long_body` — assert excerpt is ≤ ~200 chars
- `scan_skills_body_excerpt_skips_headings` — body excerpt should skip lines starting with `#` (existing helper behavior)

**Type:** test
**Effort:** S

**Acceptance Criteria:**
- [ ] All four new test cases pass under `bun run test:rust`
- [ ] Tests use the existing `write_file` helper (line 594) and tempfile pattern
- [ ] A SKILL.md with a single-character description (edge case) still parses correctly (failure case: `description: x` should yield `Some("x")`)

**Agent:** general-purpose

**Depends on:** TASK-003
**Priority:** P2

---

### TASK-015: Test `skillsPaletteStore` state transitions

New file `src/renderer/stores/skillsPaletteStore.test.ts`. Test cases:
- `open() sets isOpen to true`
- `close() resets isOpen, query, selectedIndex`
- `setQuery resets selectedIndex to 0`
- `moveSelection clamps within bounds`
- `bail-out guard: open() called twice does not trigger a second state change` (verify via a subscribe spy)

Follow patterns from `src/renderer/stores/settingsStore.test.ts` and `src/renderer/stores/diffStore.test.ts`.

**Type:** test
**Effort:** S

**Acceptance Criteria:**
- [ ] 100% coverage of all actions exported by the store
- [ ] At least one test verifies the bail-out guard does not double-fire `set`
- [ ] Test runs under `bun run test`, not `bun test` (per `bunfig.toml` redirect — failure case if mistakenly run)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-004
**Priority:** P2

---

### TASK-016: Component test — `SkillsPalette` rendering, filtering, navigation, invocation

New file `src/renderer/components/chat/SkillsPalette.test.tsx`. Test cases:
- Renders when `isOpen` is true; renders nothing when false
- Fuzzy filter — typing "comm" surfaces `commit` skill ahead of `cost-estimate`
- ArrowDown moves selection; clamps at last item
- Pressing Enter calls the invocation handler with the selected skill
- Pressing Escape calls `close()`
- Empty state renders "No skills match" when filter has no results
- Cmd+K opening — fire a `keydown` event with `metaKey: true` and `key: 'k'` and assert palette opens

Use `@testing-library/react` and mock `useClaudeConfigStore` with a fixture of skills.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] All seven cases above pass
- [ ] Mocking `useSkillInvoke` returns a spy that is called exactly once on Enter
- [ ] Skills with `description: undefined` still render without throwing (failure case)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-008
**Priority:** P2

---

### TASK-017: Component test — `ContextRing` tooltip extension

Extend `src/renderer/components/chat/ContextRing.test.tsx`. Add cases:
- Tooltip shows breakdown rows when `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens` are all present
- Tooltip falls back to single-line summary when breakdown is missing
- Auto-compact estimate renders "soon" when `pct >= 95`
- Cost row displays in `$X.XX` format using `formatCost`

The original tests at `ContextRing.test.tsx:8` set the baseline; do not break them.

**Type:** test
**Effort:** S

**Acceptance Criteria:**
- [ ] All four new assertions pass alongside existing tests
- [ ] When passed `used: 0, size: 100`, tooltip shows "0%" and an estimate of more than zero turns until auto-compact (failure case: must not show "in -1 turns")

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-010
**Priority:** P2

---

### TASK-018: Component test — `AcpSubagentDisplay` nested tree, role colors, click-to-focus

Extend `src/renderer/components/chat/AcpSubagentDisplay.test.tsx`. Add cases:
- Subagents with `parent: 'agent-a'` render with indent under `agent-a`
- Two siblings render at the same indent depth
- Circular parent reference renders flat without infinite loop
- Click on an agent card dispatches the `chat-scroll-to` CustomEvent or calls the scroll helper with the correct message id
- Role-colored icons differ between `plan` and `research` roles
- Elapsed clock element appears only when agent is in `running` state

Use a fixture of `SubagentInfo[]` with `parent` fields. Mock `document.dispatchEvent` if needed.

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] All six new assertions pass alongside existing tests
- [ ] Existing flat-list tests still pass (regression preserved)
- [ ] Test for circular reference asserts only ~3 second timeout, no recursion stack overflow (failure case)

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-013
**Priority:** P2

---

### TASK-019: Update `docs/keyboard-shortcuts.md` with Cmd+K Skills Palette entry

Append a new section to `docs/keyboard-shortcuts.md` documenting:
- `Cmd+K` (macOS) / `Ctrl+K` (Linux/Windows): "Open Skills Palette"
- Inside palette: `↑` / `↓` navigate, `↵` invoke, `esc` close, type to fuzzy-filter
- A one-line note that skills come from `~/.claude/skills/` and `.claude/skills/`

Keep the existing structure of the file (do not reformat).

**Type:** docs
**Effort:** S

**Acceptance Criteria:**
- [ ] New section is appended in the existing style (matching headers and table format)
- [ ] Mentions both macOS and non-macOS modifiers
- [ ] Existing shortcut documentation is unchanged byte-for-byte (failure case: diff must be additive only)

**Agent:** general-purpose

**Depends on:** TASK-008
**Priority:** P3

---

### TASK-020: Update `CLAUDE.md` engineering learnings + append `activity.md` entry

Add two new bullets to the `## Engineering learnings` section of `CLAUDE.md`:
- "Skills palette pattern — Reuse `splash-insert` CustomEvent, fuzzy-search lib, Radix Dialog. Always close palette via `getState().close()` from the invoke handler, not from the modal's onOpenChange — that avoids stale state when invocation needs to fire side effects."
- "Subagent nested tree — Detect circular parent references before rendering; fall back to flat list. Elapsed-time clocks tick from the first `running` transition only; do not start at task creation or `pending`."

Then prepend a new entry to `activity.md` in the existing format (timestamp heading in Dubai time, title, 1-3 sentence summary, `**Modified:**` line listing all changed files). The entry summarizes the entire Claude Code Superpowers feature batch.

**Type:** docs
**Effort:** S

**Acceptance Criteria:**
- [ ] `CLAUDE.md` has both new learning bullets in the `Engineering learnings` section
- [ ] `activity.md` gets one new entry prepended (not appended)
- [ ] Activity log entry timestamps use Dubai GST and follow the existing `YYYY-MM-DD HH:MM GST (Dubai)` format (failure case: any other timezone or format breaks the convention)

**Agent:** general-purpose

**Depends on:** TASK-008, TASK-010, TASK-013
**Priority:** P3

---

## Failure Modes

| Risk | Affected Tasks | Mitigation |
|------|---------------|------------|
| Cmd+K conflicts with existing shortcut | TASK-006 | Audit `useKeyboardShortcuts.ts` first; if claimed, fall back to Cmd+Shift+K and document in TASK-019 |
| Two `ContextRing` instances drift (header vs chat input) | TASK-009, TASK-010 | Both read from same `useTaskStore.tasks[id].usage` source — drift is structurally impossible. Snapshot test in TASK-017 |
| Skills with no description leave palette cards looking empty | TASK-007 | Fall back to `bodyExcerpt`; if both missing, fall back to filePath. Truncate to 150 chars |
| Skill body could be huge — palette UI explodes | TASK-003, TASK-007 | Body excerpt is server-side truncated by `body_excerpt` Rust helper (TASK-003); palette card additionally clamps via Tailwind `line-clamp-2` |
| ACP payload does not yet expose `parent` on subagents | TASK-011 | Tree builder falls back to flat list when no agent has a parent — preserves today's behavior |
| Circular parent references in subagent payload | TASK-011, TASK-018 | Detect cycle via visited-set during tree build; emit `console.warn` and render flat |
| `splash-insert` CustomEvent not heard when no input is mounted | TASK-005 | Hook copies skill body to clipboard as fallback and surfaces a warning toast |
| Elapsed clock leaks `setInterval` after card unmounts | TASK-012 | Cleanup in `useEffect` return; verify in TASK-018 with `vi.useFakeTimers()` |
| Tooltip exceeds Radix max-width and clips | TASK-010 | Apply `className="max-w-[280px]"` to `TooltipContent`; switch to `Popover` if rich content is needed |
| Auto-collapse fires before user can click an agent | TASK-013 | Set `userToggledRef.current = true` on first card interaction |
| Description field with non-string YAML (e.g., array) crashes Rust parser | TASK-003 | Use `serde_yaml::from_str::<HashMap<String, Value>>` then coerce to string; non-string returns `None` |
| `bun test` (Bun native runner) executes Vitest files | TASK-015, TASK-016, TASK-017, TASK-018 | Per CLAUDE.md learning, `bunfig.toml` already redirects this — verify it still does before merging |
| User-installed skill name collides with built-in slash command (e.g., a skill named `model` shadows `/model`) | TASK-005, TASK-007 | Detect collision at palette render time by intersecting `config.skills[].name` with the `SlashCommand[]` list from `useSettingsStore`. Show a small badge "conflicts with built-in /name" on the card. Invocation still dispatches `splash-insert` with `/skill-name`; the existing slash-command handler resolves built-ins first by design. |
| `task.contextUsage.turns` does not exist — older plan referenced it | TASK-010 | Derive `avgPctPerTurn` from `Math.floor(task.messages.length / 2)` (assistant-message count as turn proxy) with fallback of `5` when message count is zero. `task.contextUsage` at `src/renderer/types/index.ts:120` does not carry a turn count. |

## Test Coverage Map

| New Codepath | Covering Task | Test Type |
|-------------|--------------|-----------|
| `scan_skills` description extraction | TASK-014 | unit (Rust) |
| `scan_skills` body excerpt truncation | TASK-014 | unit (Rust) |
| `skillsPaletteStore.open/close/toggle/setQuery/moveSelection` | TASK-015 | unit |
| Bail-out guard in `skillsPaletteStore.set` | TASK-015 | unit |
| `SkillsPalette` fuzzy filter ranking | TASK-016 | integration |
| `SkillsPalette` keyboard navigation (↑↓↵esc) | TASK-016 | integration |
| `SkillsPalette` invocation dispatches `splash-insert` | TASK-016 | integration |
| `SkillsPalette` empty state rendering | TASK-016 | integration |
| Cmd+K opens palette globally | TASK-016 | integration |
| `ContextRing` tooltip token breakdown | TASK-017 | unit |
| `ContextRing` auto-compact estimate | TASK-017 | unit |
| `ContextRing` cost formatting | TASK-017 | unit |
| `AcpSubagentDisplay` nested tree rendering | TASK-018 | integration |
| `AcpSubagentDisplay` circular parent fallback | TASK-018 | integration |
| `AcpSubagentDisplay` click-to-focus dispatch | TASK-018 | integration |
| `AgentCard` role color icon mapping | TASK-018 | integration |
| `AgentCard` elapsed clock lifecycle | TASK-018 | integration |
| `getSubagentRoleColor` / `getSubagentRoleIcon` mappings | TASK-018 | unit (via Display test) |

## Task Dependencies

```json
{
  "TASK-001": [],
  "TASK-002": [],
  "TASK-003": [],
  "TASK-004": [],
  "TASK-005": [],
  "TASK-006": ["TASK-004"],
  "TASK-007": ["TASK-001", "TASK-004", "TASK-005"],
  "TASK-008": ["TASK-007"],
  "TASK-009": [],
  "TASK-010": ["TASK-009"],
  "TASK-011": ["TASK-001", "TASK-002"],
  "TASK-012": ["TASK-002", "TASK-011"],
  "TASK-013": ["TASK-012"],
  "TASK-014": ["TASK-003"],
  "TASK-015": ["TASK-004"],
  "TASK-016": ["TASK-008"],
  "TASK-017": ["TASK-010"],
  "TASK-018": ["TASK-013"],
  "TASK-019": ["TASK-008"],
  "TASK-020": ["TASK-008", "TASK-010", "TASK-013"]
}
```
