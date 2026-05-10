# Plan: Claude Code feature parity (permissions / orange theme / output styles / hooks / statusline / commands / memory)

> Generated: 2026-05-10
> Branch: `feat/claude-code-features`
> Mode: HOLD

## Overview

Bring Klaudex closer to Claude Code feature parity by layering a real permission model on top of the existing `auto_approve` flag, adding a "Claude Orange" theme variant, surfacing output styles / hooks / statusline configs that Claude Code reads from `~/.claude/settings.json`, and adding in-app browsers for slash commands and CLAUDE.md memory files. Reuses Klaudex's existing `auto_approve` plumbing, `claude_config.rs` parsers, theme infrastructure, and settings-panel sections — only builds what's net-new on top.

## Scope Challenge

User selected **HOLD** mode after Phase 0 review of existing code:

- **Bypass permission:** Klaudex already has `AppSettings.auto_approve: bool` and a wired `task_set_auto_approve` Tauri command at `src-tauri/src/commands/acp/commands.rs:286`. There's even an existing `AutoApproveToggle.tsx`. The gap is the **UX layer**: a real allowlist/denylist model (Claude Code's `permissions.allow` / `permissions.deny` patterns), a header YOLO toggle with safety banner, a `Settings → Permissions` section, and a Cmd+Shift+Y shortcut. We're keeping the existing `auto_approve` boolean as a migration bridge (true → mode=`bypass`, false → mode=`ask`).
- **Theme:** Klaudex already has `theme: "dark" | "light" | "system"` with a `ThemeSelector.tsx` and Tailwind CSS variables in `src/tailwind.css`. Adding a 4th `"claude"` variant is a 3-file change — adding a `.claude` CSS class block, extending the type, and adding the option to the selector.
- **Output styles / hooks / statusline:** none of these exist in Klaudex today. `claude_config.rs` already parses `ClaudeAgent`, `ClaudeSkill`, `ClaudeCommand`, `ClaudeSteeringRule`, `ClaudeMemoryFile`, `ClaudeMcpServer` — extending it with three more parsers + types follows the existing pattern.
- **Slash command browser + memory editor:** `ClaudeCommand` and `ClaudeMemoryFile` are already parsed; only the UI viewer/editor components are missing. The existing `ClaudeSkillRow.tsx` is the template.

Ruled out for this plan:
- **Klaudex executing hooks itself.** Hooks run inside the `claude` subprocess that Klaudex spawns; Claude Code already executes them. Klaudex only needs to view/edit the hook config, not run hooks. This collapses what would be a 5-task feature into 2.
- **Subagent orchestration UI.** Already partially shipped in earlier waves (`AcpSubagentDisplay.tsx`).
- **Plan mode.** Already wired in `useSlashAction.ts`.

## Architecture

```
                          ┌─────────────────────────────────────┐
                          │  src-tauri/src/commands/            │
                          │                                      │
   AppSettings extension  │  ┌─────────────────┐                │
   (TASK-101) ───────────►│  │  settings.rs     │                │
                          │  │   + Permissions  │                │
                          │  │   + theme="claude"│               │
                          │  └────────┬─────────┘                │
                          │           │                          │
   Pattern matcher        │  ┌────────▼──────────┐               │
   (TASK-102) ───────────►│  │ permissions.rs    │ NEW           │
                          │  │  Rule, match_*    │               │
                          │  └────────┬──────────┘               │
                          │           │                          │
   ACP integration        │  ┌────────▼──────────┐               │
   (TASK-105) ───────────►│  │ acp/client.rs     │ EXTEND        │
                          │  │ request_permission│               │
                          │  └───────────────────┘               │
                          │                                      │
   Config types/parsers   │  ┌───────────────────┐               │
   (TASK-104, 108, 109,   │  │ claude_config.rs  │ EXTEND        │
    110) ────────────────►│  │  + scan_output_   │               │
                          │  │    styles         │               │
                          │  │  + scan_hooks     │               │
                          │  │  + read_statusline│               │
                          │  └───────────────────┘               │
                          └─────────────────────────────────────┘
                                            │
                          ┌─────────────────┼────────────────────┐
                          │  src/renderer/                       │
                          │                                      │
   Theme variant          │  src/tailwind.css      (TASK-103)    │
   ───────────────────────│  ThemeSelector.tsx     (TASK-103)    │
                          │  appearance-section.tsx (TASK-103)   │
                          │                                      │
   YOLO header toggle     │  AppHeader.tsx          (TASK-107)   │
   + Cmd+Shift+Y shortcut │  useKeyboardShortcuts.ts (TASK-107)  │
                          │                                      │
   Permissions UI         │  settings/permissions-section.tsx    │
                          │    (TASK-106, NEW)                   │
                          │  TASK-116 adds import-from-disk      │
                          │                                      │
   Output style picker    │  chat/OutputStylePicker.tsx          │
                          │    (TASK-113, NEW)                   │
                          │                                      │
   Hooks viewer           │  settings/hooks-section.tsx          │
                          │    (TASK-114, NEW)                   │
                          │                                      │
   Statusline             │  chat/Statusline.tsx                 │
                          │    (TASK-115, NEW)                   │
                          │  Mounted under ChatInput.tsx         │
                          │                                      │
   Slash command browser  │  sidebar/ClaudeCommandRow.tsx        │
                          │    (TASK-111, NEW)                   │
                          │  Mounted in ClaudeConfigPanel.tsx    │
                          │                                      │
   CLAUDE.md editor       │  sidebar/MemoryFileEditor.tsx        │
                          │    (TASK-112, NEW)                   │
                          │                                      │
   Tests                  │  *.test.tsx for each section         │
                          │    (TASK-117, TASK-118)              │
                          └──────────────────────────────────────┘
```

## Existing Code Leverage

| Sub-problem | Existing Code | Action |
|---|---|---|
| Auto-approve infra (per-task + global) | `AppSettings.auto_approve`, `acp/client.rs auto_approve: AtomicBool`, `task_set_auto_approve` cmd | Reuse as migration bridge — `true → mode=bypass` |
| Settings file persistence | `confy` via `settings.rs save_settings/get_settings` | Reuse |
| Theme tokens | `:root` and `.dark` blocks in `src/tailwind.css`, `--color-primary`, `--accent`, etc. | Extend — add `.claude` block |
| Theme selector UI | `src/renderer/components/settings/ThemeSelector.tsx` (178 LOC) | Extend — add option |
| Theme persistence | `AppSettings.theme: String` already typed | Extend — add `"claude"` to valid values |
| Claude config parsing | `claude_config.rs` parsers (`scan_agents`, `scan_skills`, `scan_commands`, `scan_steering_rules`, `scan_memory_files`, `parse_mcp_servers`) | Extend — add 3 more parsers |
| Slash commands data | `ClaudeCommand` struct + `scan_commands` | Reuse — only UI is missing |
| Memory files data | `ClaudeMemoryFile` struct + `scan_memory_files` | Reuse — only editor UI is missing |
| Settings panel section pattern | `settings/general-section.tsx`, `account-section.tsx`, `keymap-section.tsx`, etc. + `SettingsPanel.tsx` mount logic | Reuse pattern |
| Sidebar row pattern | `ClaudeSkillRow.tsx`, `ClaudeMcpRow.tsx`, `ClaudeSteeringRow.tsx` | Reuse as template |
| Keyboard shortcut hook | `src/renderer/hooks/useKeyboardShortcuts.ts` | Extend — add Cmd+Shift+Y |
| Slash command dispatch | `src/renderer/hooks/useSlashAction.ts` | Extend — add `/yolo` command (toggle bypass) |
| Watcher subscription | `claudeConfigStore` watcher (wave 3) | Reuse — re-loads on `~/.claude/settings.json` change |

## Tasks

### TASK-101: Permissions Rust type + AppSettings extension (with per-project migration)

Add a `Permissions` struct to `src-tauri/src/commands/settings.rs` with `mode: PermissionMode` (`Ask | AllowListed | Bypass`), `allow: Vec<String>`, `deny: Vec<String>`. Add `permissions: Permissions` field to `AppSettings` with `#[serde(default)]`. Also add `permissions: Option<Permissions>` to `ProjectPrefs` (mirrors how `auto_approve: Option<bool>` is per-project today).

Migration on deserialize:
- **Global:** if legacy `auto_approve: true` and `permissions` is absent → `permissions = { mode: Bypass, allow: [], deny: [] }`. If false/absent → `mode: Ask`.
- **Per-project:** if legacy `projectPrefs[ws].auto_approve = Some(true)` and `permissions` is None → `projectPrefs[ws].permissions = Some({ mode: Bypass })`. If `Some(false)` → `mode: Ask`. If `None`, leave `permissions: None` so the global setting wins.

Patterns are stored as raw strings like `Bash(npm test:*)` — matching is in TASK-102.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] `Permissions` struct + `PermissionMode` enum compile, both `#[serde(rename_all = "camelCase")]`
- [ ] `AppSettings.permissions` defaults to `{ mode: Ask, allow: [], deny: [] }` when missing
- [ ] `ProjectPrefs.permissions` is `Option<Permissions>`; `None` means "fall back to global"
- [ ] Backward compat (global): existing settings file with `auto_approve: true` and no `permissions` block deserializes to `mode: Bypass`
- [ ] Backward compat (per-project): `projectPrefs[*].auto_approve: Some(true)` migrates to `projectPrefs[*].permissions = Some({ mode: Bypass })`; `Some(false)` → `mode: Ask`; `None` → `permissions: None`
- [ ] Round-trip: serialize → deserialize preserves all fields including per-project
- [ ] `bun run check:rust` passes

**Agent:** general-purpose

**Priority:** P0

---

### TASK-102: Permission pattern matcher

Create `src-tauri/src/commands/permissions.rs` with a pattern matcher: given a tool name (e.g., `Bash`), arguments (e.g., `npm test --watch`), and a list of patterns, return `Allow | Deny | NoMatch`. Pattern grammar: `Tool(arg-glob:*)` where `*` is a glob. Examples: `Bash(npm test:*)` matches any bash invocation starting with `npm test`. `Read(./src/**)` matches any read under src. `Bash(rm:*)` matches `rm anything`. Deny rules always win over allow rules (Claude Code semantics). Pure function, table-driven tests.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] `match_permission(tool, args, allow, deny) → Decision` returns `Deny` if any deny pattern matches even when an allow pattern also matches
- [ ] `Bash(npm test:*)` matches `tool=Bash, args="npm test"` AND `tool=Bash, args="npm test --watch"`
- [ ] `Read(./src/**)` does NOT match `Read(./node_modules/foo.ts)` (failure case)
- [ ] Empty allow + empty deny + mode=ask returns `NoMatch`
- [ ] Malformed pattern (e.g., `Bash(`) is logged and skipped, not panicked
- [ ] Tests cover: glob `*`, prefix match, exact match, deny-overrides-allow, malformed input

**Agent:** general-purpose

**Priority:** P0

---

### TASK-103: Claude Orange theme variant

Add a `"claude"` theme option. Modifies three files:

1. `src-tauri/src/commands/settings.rs` — extend the inline doc on `theme` to include `"claude"` as a valid value (no enum change needed, it's a `String`).
2. `src/tailwind.css` — add a `.claude` class block with `color-scheme: dark`, base background tokens copied from the existing `.dark` block, and override `--primary`, `--accent`, `--ring`, `--border` to `#D97757` (Claude Code's official orange / terracotta) and tonal variants.
3. `src/renderer/components/settings/ThemeSelector.tsx` — add the `"claude"` option with an orange swatch preview, label "Claude" or "Claude Orange".

The theme switcher in `appearance-section.tsx` should automatically pick this up if it iterates `ThemeSelector`'s options array.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Selecting "Claude" in Settings → Appearance applies the `.claude` class to `<html>` and changes accent color to orange immediately
- [ ] Other themes (dark, light, system) continue to work unchanged
- [ ] `system` theme matches OS dark-mode preference but stays in the orange variant if user explicitly picked "claude" (don't downgrade to plain dark on OS change)
- [ ] Failure case: setting `theme: "invalid"` falls back to `dark` without crashing
- [ ] `bun run check:ts` and `bun run check:rust` pass

**Agent:** react-vite-tailwind-engineer

**Priority:** P0

---

### TASK-104: Output style + hook + statusline Rust types

In `src-tauri/src/commands/claude_config.rs`, add three new structs:

- `ClaudeOutputStyle { name: String, body: String, source: PathBuf, is_global: bool }` — markdown-with-frontmatter under `<base>/output-styles/*.md`.
- `ClaudeHook { event: String, matcher: Option<String>, command: String, source: PathBuf }` — parsed from `<base>/settings.json` `hooks` block. Events: `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`.
- `StatuslineConfig { kind: String, command: String, padding: Option<u32>, source: PathBuf }` — parsed from `<base>/settings.json` `statusLine` block.

Add to `ClaudeConfig`: `output_styles: Vec<ClaudeOutputStyle>`, `hooks: Vec<ClaudeHook>`, `statusline: Option<StatuslineConfig>`. Default to empty/None. Parsers come in TASK-108/109/110.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] All three structs derive `Serialize, Deserialize, Clone, Debug` with `#[serde(rename_all = "camelCase")]`
- [ ] `ClaudeConfig` gains the three fields with `#[serde(default)]`
- [ ] Existing `get_claude_config` callers don't break — empty arrays / None for the new fields
- [ ] `bun run check:rust` passes

**Agent:** general-purpose

**Priority:** P0

---

### TASK-105: Wire permission matcher into ACP request_permission flow

Extend `src-tauri/src/commands/acp/client.rs` (around line 131 where `auto_approve` is already checked). Replace the boolean check with a 3-step decision:

1. Get the active tool name + args from the permission request.
2. Read `settings.permissions.deny` then `.allow`. Call `match_permission` from TASK-102.
3. Apply rule:
   - `Decision::Deny` → auto-deny the permission.
   - `Decision::Allow` → auto-approve.
   - `Decision::NoMatch + mode=Bypass` → auto-approve (preserves current YOLO behavior).
   - `Decision::NoMatch + mode=AllowListed` → fall through to user prompt.
   - `Decision::NoMatch + mode=Ask` → fall through to user prompt.

Keep the existing `auto_approve: AtomicBool` on `AcpClient` for backward-compat; it acts as the runtime mirror of `mode == Bypass`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Allow-listed Bash invocation auto-approves without prompt
- [ ] Deny-listed Bash invocation auto-denies even when mode is Bypass (deny > bypass)
- [ ] No-match in Ask mode prompts the user (existing behavior preserved)
- [ ] Failure case: if `match_permission` panics, the request falls back to user prompt (don't auto-anything dangerous)
- [ ] No `Send`/`!Send` regression — the matcher is sync + pure so this is safe inside the !Send local set

**Agent:** general-purpose

**Depends on:** TASK-101, TASK-102

**Priority:** P1

---

### TASK-106: Settings → Permissions UI section

Create `src/renderer/components/settings/permissions-section.tsx`. Sections:

1. **Mode radio:** `Always ask` / `Allow listed` / `Bypass` (red warning text under Bypass).
2. **Allow list:** scrollable list of allow patterns. Each row shows the pattern + a remove button. "Add rule" button opens a small inline form (Tool dropdown + arg input).
3. **Deny list:** same shape as allow list.
4. **Import button:** disabled placeholder for now — TASK-116 wires the actual import.

Mount in `SettingsPanel.tsx` as a new `'permissions'` section, matching how `'memory'` was wired in wave-3 TASK-024. Persists via existing `settingsStore.save`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Selecting a mode persists to settings and survives app restart
- [ ] Adding / removing patterns updates state immediately and persists
- [ ] Failure case: empty allow + empty deny + Bypass mode renders correctly with the same banner as the header (consistency)
- [ ] `bun run check:ts` passes

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-101

**Priority:** P1

---

### TASK-107: YOLO mode header toggle + safety banner + Cmd+Shift+Y shortcut + retire AutoApproveToggle

Extend `src/renderer/components/AppHeader.tsx` with a permission-mode chip showing the current mode (icon + short label, e.g., `🛡 Ask` / `📋 Listed` / `⚠ Bypass`). Click cycles Ask → Listed → Bypass. When `Bypass` is active, render a thin red banner above the chat panel reading "⚠ Bypassing permissions — anything the agent runs is auto-approved [Disable]".

Add Cmd+Shift+Y to `src/renderer/hooks/useKeyboardShortcuts.ts` that toggles between `Ask` and `Bypass` (skipping `AllowListed` since that needs setup).

Add a `/yolo` slash command in `useSlashAction.ts` that does the same toggle (returns `{ handled: true }` per the existing dispatch contract).

**Retire the legacy AutoApproveToggle.** `src/renderer/components/chat/AutoApproveToggle.tsx` is the existing per-task shield button bound to `settings.autoApprove` + `projectPrefs[ws].autoApprove`. After this task, the new header chip is the canonical UI for permission mode. Two acceptable resolutions:
- **(preferred) Remove `AutoApproveToggle.tsx`** + remove its mount points (grep for `<AutoApproveToggle`). Drop `selectAutoApprove` selector. The header chip is now the only mode UI.
- **(fallback) Rebind `AutoApproveToggle`** to read `permissions.mode === 'bypass'` (with per-project override) and write through the new permissions model. Update `selectAutoApprove` accordingly.

Pick (preferred) unless removal cascades into 5+ unrelated files; in that case fall back to rebind. Either way, no widget should still write to the legacy `auto_approve` boolean after this task.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Mode chip reflects `settings.permissions.mode` and updates on settings change
- [ ] Click on chip cycles modes (3-way)
- [ ] Cmd+Shift+Y toggles between Ask ↔ Bypass
- [ ] `/yolo` slash command toggles same way; tab-completes to `/yolo` after typing `/y`
- [ ] Red safety banner appears within one render of switching to Bypass and disappears when switching off
- [ ] Failure case: settings save fails → toast error, mode reverts to previous
- [ ] `bun run check:ts` passes

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-101

**Priority:** P1

---

### TASK-108: scan_output_styles parser

Add `scan_output_styles(base: &Path, is_global: bool) -> Vec<ClaudeOutputStyle>` to `src-tauri/src/commands/claude_config.rs`. Reads `<base>/output-styles/*.md`, parses YAML frontmatter with `serde_yaml` (already a dep) for the `name` field (falls back to filename), strips frontmatter, stores body. Pattern matches existing `scan_agents` (line ~200) and `scan_skills` (line ~251). Wire into `get_claude_config` after `scan_steering_rules`.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Returns empty Vec when `<base>/output-styles/` doesn't exist
- [ ] Parses frontmatter `name` field correctly; falls back to filename when absent
- [ ] Handles malformed YAML — logs warning, skips that file, doesn't fail the whole scan (existing pattern)
- [ ] Two unit tests: happy path + missing dir

**Agent:** general-purpose

**Depends on:** TASK-104

**Priority:** P1

---

### TASK-109: scan_hooks parser

Add `scan_hooks(base: &Path) -> Vec<ClaudeHook>` to `claude_config.rs`. Reads `<base>/settings.json`, parses the optional `hooks` object. Schema (matches Claude Code's actual format): `{ "<eventName>": [{ "matcher": "...", "command": "..." }] }`. Each combination produces one `ClaudeHook` entry. Read-only — no execution; Klaudex doesn't run hooks itself, that happens inside the `claude` subprocess. Wire into `get_claude_config` for both global and project scopes.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Returns empty Vec when `<base>/settings.json` doesn't exist or has no `hooks` key
- [ ] Parses the canonical Claude Code hooks schema (event → array of {matcher, command})
- [ ] Failure case: malformed JSON in settings.json — log warning, return empty, don't fail
- [ ] One unit test for happy path with all 4 events (PreToolUse / PostToolUse / SessionStart / Stop)

**Agent:** general-purpose

**Depends on:** TASK-104

**Priority:** P1

---

### TASK-110: read_statusline parser

Add `read_statusline(base: &Path) -> Option<StatuslineConfig>` to `claude_config.rs`. Reads `<base>/settings.json`, parses the optional `statusLine` object. Schema: `{ type: "command", command: "...", padding?: number }`. Project scope wins over global if both define it. Wire into `get_claude_config`.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Returns `None` when `<base>/settings.json` is absent or has no `statusLine`
- [ ] Returns `Some(StatuslineConfig)` with correct fields when present
- [ ] Failure case: `type` is not `"command"` → log warning, return None (we don't support other kinds yet)
- [ ] One unit test for happy path + one for missing config

**Agent:** general-purpose

**Depends on:** TASK-104

**Priority:** P1

---

### TASK-111: Slash command browser sidebar row

Create `src/renderer/components/sidebar/ClaudeCommandRow.tsx` modeled on `ClaudeSkillRow.tsx`. Each row renders one `ClaudeCommand` from `claudeConfigStore.config.commands` (already populated by wave-1 `scan_commands`). The existing `ClaudeCommand` struct only exposes `{ name, source, file_path }` (no `body`), so render command name + the relative file path; clicking the row reveals the full file contents via a lightweight read using `ipc.readTextFile` (already exists in `lib/ipc.ts` — verify) on demand. No struct change required. Mount inside the existing `ClaudeConfigPanel.tsx` as a new section between Skills and Steering.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Renders one row per command from `claudeConfigStore.config.commands` showing name + relative file path
- [ ] Empty state: "No slash commands" placeholder when array is empty
- [ ] Click expands; lazy-reads the file via `ipc.readTextFile` and shows body. Second click collapses.
- [ ] Failure case: file read fails (deleted/permission) → row shows inline "Could not read file" text instead of crashing
- [ ] `bun run check:ts` passes

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-112: CLAUDE.md memory file editor

Create `src/renderer/components/sidebar/MemoryFileEditor.tsx`. Triggered when user clicks a `ClaudeMemoryFile` row in the existing memory-file list (assume the existing list emits a click event or pass a prop). Opens a Dialog (using the existing `@/components/ui/dialog` primitive) with a textarea bound to the file's body, "Save" button that calls `ipc.writeTextFile` (already available — verify the exact name) and a "Reload" button that re-reads from disk. Subscribes to `onClaudeConfigChanged` so external edits hot-reload.

If `ipc.writeTextFile` doesn't exist in `lib/ipc.ts`, this task adds a small new wrapper around the Tauri `fs` plugin's `writeTextFile`. Stays inside the renderer; no new Rust command.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Editor opens with the file body pre-loaded
- [ ] Save persists to disk; reload pulls latest from disk
- [ ] External edit (touch the file in a separate process) re-loads the editor body within ~300ms via the watcher
- [ ] Failure case: write error → inline error message in the dialog, body preserved so user can retry
- [ ] `bun run check:ts` passes

**Agent:** react-vite-tailwind-engineer

**Priority:** P2

---

### TASK-113: Output style picker UI + subprocess flag wiring

Create `src/renderer/components/chat/OutputStylePicker.tsx`, a small dropdown next to the existing `<ModelPicker />` in `ChatToolbar.tsx` (verified mount point: `ChatToolbar.tsx:74`). Lists `claudeConfigStore.config.outputStyles` (after TASK-108 lands). Selecting one writes to `task.outputStyle` (new optional field on the task — extend BOTH `src/renderer/stores/task-store-types.ts` (TS) AND the Rust `Task` struct in `src-tauri/src/commands/acp/types.rs` line 83-region — both must stay in serde-sync). On the next `task_send_message` in `acp/commands.rs`, append `--output-style <name>` to the `claude` subprocess invocation. If the user picks "default" (or none), don't append.

Files: create `OutputStylePicker.tsx`; modify `ChatToolbar.tsx`, `acp/commands.rs`, `acp/types.rs`, `task-store-types.ts`.

**Type:** feature
**Effort:** M

**Acceptance Criteria:**
- [ ] Picker renders `outputStyles` from the store; "Default" is always the first option
- [ ] Switching style on a task persists to the task record
- [ ] Subsequent `claude` invocations include `--output-style <name>` flag (verify via debug log)
- [ ] Failure case: invalid style name (e.g., user-renamed file) — `claude` rejects it; Klaudex catches stderr and surfaces an error toast
- [ ] `bun run check:ts` and `bun run check:rust` pass

**Agent:** general-purpose

**Depends on:** TASK-108

**Priority:** P2

---

### TASK-114: Hooks viewer in Settings → Advanced

Create `src/renderer/components/settings/hooks-section.tsx`. Read-only display of `claudeConfigStore.config.hooks`. Group by event (PreToolUse / PostToolUse / SessionStart / Stop). Each entry shows the matcher pattern and the command. Add a small note: "Hooks are executed by the Claude CLI, not Klaudex. Edit `~/.claude/settings.json` to change them." Mount in `SettingsPanel.tsx` as a new section under Advanced.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Renders all hooks grouped by event name
- [ ] Empty state when no hooks defined
- [ ] Failure case: a hook with an empty command renders as `<empty>` rather than crashing
- [ ] `bun run check:ts` passes

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-109

**Priority:** P2

---

### TASK-115: Statusline renderer with sandboxed shell exec

Create `src/renderer/components/chat/Statusline.tsx`. Mounts under `ChatInput.tsx` (or at the bottom of the chat panel, find existing layout). Reads `claudeConfigStore.config.statusline` (after TASK-110). If present, on every task message send / receive event, runs the configured shell command via a new Tauri command `run_statusline_command(command: String, context_json: String) -> Result<String, AppError>`. Pipes a JSON context (cwd, model, task_id, message_count) to stdin. Captures stdout up to 1KB, 2-second timeout, isolated env (PATH only). Renders the result as a thin status bar.

This task adds the new Tauri command + frontend component + IPC wrapper.

**Type:** feature
**Effort:** L

**Acceptance Criteria:**
- [ ] Statusline appears only when `config.statusline` is non-null
- [ ] Re-renders on task state change without flicker
- [ ] Failure case: command times out → renders "[statusline timeout]" placeholder, no app crash
- [ ] Failure case: command produces > 1KB stdout → truncated with ellipsis
- [ ] Failure case: command exits non-zero → renders the stderr (truncated to 80 chars), doesn't crash
- [ ] Sandbox: only PATH is forwarded from the host env; HOME and PWD are explicitly set
- [ ] **Integration test (cargo)**: invoke `run_statusline_command` with three inputs: (a) fast happy-path (`echo hi`) → returns "hi" within 100ms; (b) hanging command (`sleep 5`) → terminates and returns timeout placeholder at ~2s; (c) oversized output (`yes` or equivalent infinite stdout) → returns truncated 1KB output. Lives in `src-tauri/src/commands/statusline.rs` `#[cfg(test)] mod tests`.
- [ ] `bun run check:ts` and `bun run check:rust` pass

**Agent:** general-purpose

**Depends on:** TASK-110

**Priority:** P2

---

### TASK-116: Import permissions from `~/.claude/settings.json`

Add an "Import from Claude Code settings" button to the Settings → Permissions section (TASK-106). Reads `~/.claude/settings.json` `permissions` block and merges into Klaudex's allow/deny lists with deduplication (no duplicates added if a pattern is already present). Shows a confirmation dialog before merging: "Import N allow rules and M deny rules from ~/.claude/settings.json?".

Adds a small Tauri command `read_claude_settings_permissions() -> Result<{ allow: Vec<String>, deny: Vec<String> }, AppError>` to keep the file read on the Rust side.

**Type:** feature
**Effort:** S

**Acceptance Criteria:**
- [ ] Button reads the file, opens confirm dialog with counts
- [ ] After confirm, dedup-merges into current settings and saves
- [ ] Failure case: file missing → button disabled with tooltip "No ~/.claude/settings.json found"
- [ ] Failure case: malformed JSON → toast error, no merge
- [ ] `bun run check:ts` and `bun run check:rust` pass

**Agent:** react-vite-tailwind-engineer

**Depends on:** TASK-106

**Priority:** P3

---

### TASK-117: Permission matcher + UI integration tests

Add `src-tauri/src/commands/permissions.rs` test module if not already in TASK-102 (it should be — but verify). Add `src/renderer/components/settings/permissions-section.test.tsx`. Test cases:

- Matcher: glob `*`, prefix match, exact match, deny-overrides-allow, malformed input, empty lists
- UI: render with all three modes, add rule, remove rule, import button disabled state, mode change triggers banner

**Type:** test
**Effort:** M

**Acceptance Criteria:**
- [ ] At least 8 matcher test cases pass
- [ ] At least 5 UI test cases pass
- [ ] Failure case test: deny rule that matches AND allow rule that matches → result is Deny
- [ ] All tests pass under `npx vitest run` and `cargo test`

**Agent:** general-purpose

**Depends on:** TASK-102, TASK-105, TASK-106

**Priority:** P2

---

### TASK-118: Output style + hook + statusline parser tests

Add `#[cfg(test)]` modules to `claude_config.rs` covering `scan_output_styles`, `scan_hooks`, `read_statusline`. Each: happy path, missing dir/file, malformed input. Use `tempfile` (already a dev-dep — verify) for isolated test directories.

**Type:** test
**Effort:** S

**Acceptance Criteria:**
- [ ] At least 2 tests per parser (happy + failure)
- [ ] All tests pass under `cargo test`
- [ ] Failure case: malformed JSON in settings.json — `scan_hooks` and `read_statusline` both return empty/None without panicking

**Agent:** general-purpose

**Depends on:** TASK-108, TASK-109, TASK-110

**Priority:** P2

---

## Failure Modes

| Risk | Affected Tasks | Mitigation |
|---|---|---|
| Pattern matcher mishandles glob edge cases (e.g., `**`) → over-permissive auto-approve | TASK-102, TASK-105 | TASK-117's table-driven tests cover glob + edge cases. Default to Deny on malformed pattern. |
| User imports `~/.claude/settings.json` with broad allow rules they didn't author themselves | TASK-116 | Confirmation dialog shows per-rule preview before merge. Merge is dedup, not replace, so user can remove unwanted rules manually. |
| Statusline shell command runs untrusted code from `~/.claude/settings.json` | TASK-115 | Sandbox: 2s timeout, 1KB stdout cap, PATH-only env. Klaudex doesn't add new attack surface — Claude Code itself runs the same command. |
| Theme switch flickers / FOUC during page load | TASK-103 | Apply `.claude` class to `<html>` in `index.html` AND in `main.tsx` before React renders, matching the existing dark-theme pattern documented in CLAUDE.md. |
| Bypass mode + deny rule conflict → user confused which wins | TASK-105, TASK-107 | Deny always wins (Claude Code semantics). Banner text reads "Bypassing permissions (deny rules still enforced)" when there's a non-empty deny list. |
| `auto_approve: true` legacy setting + new permissions block both present after upgrade | TASK-101 | Migration: if both are present, the explicit `permissions` block wins. Once user touches permissions UI, `auto_approve` is dropped on next save. |
| Hooks UI suggests Klaudex executes hooks (it doesn't) | TASK-114 | Explicit copy: "Hooks are executed by the Claude CLI, not Klaudex." |
| Statusline command depends on env vars not in PATH-only sandbox | TASK-115 | Pipe context as JSON on stdin (cwd, model, task_id, message_count). Document the contract in code comment + statusline section copy. |

## Test Coverage Map

| New Codepath | Covering Task | Test Type |
|---|---|---|
| `Permissions` struct serde round-trip + legacy migration | TASK-117 (matcher tests cover the type indirectly) | unit |
| `match_permission` matcher (all glob cases) | TASK-117 | unit |
| ACP `request_permission` integration with matcher | TASK-117 | integration |
| Permissions section UI: mode switch, add/remove rule | TASK-117 | unit (Vitest) |
| Theme switching from dark → claude → dark, persistence | not explicitly covered — manual smoke | manual |
| `scan_output_styles` parser | TASK-118 | unit (Rust) |
| `scan_hooks` parser | TASK-118 | unit (Rust) |
| `read_statusline` parser | TASK-118 | unit (Rust) |
| Output style flag passing to subprocess | TASK-113's manual smoke test | manual |
| Hooks viewer rendering | not explicitly tested — purely presentational | smoke |
| Statusline command exec sandbox (timeout, truncation, env) | TASK-115 | integration |
| Slash command sidebar row | not explicitly tested — purely presentational | smoke |
| Memory file editor save / reload | not explicitly tested — manual | manual |

## Task Dependencies

```json
{
  "TASK-101": [],
  "TASK-102": [],
  "TASK-103": [],
  "TASK-104": [],
  "TASK-105": ["TASK-101", "TASK-102"],
  "TASK-106": ["TASK-101"],
  "TASK-107": ["TASK-101"],
  "TASK-108": ["TASK-104"],
  "TASK-109": ["TASK-104"],
  "TASK-110": ["TASK-104"],
  "TASK-111": [],
  "TASK-112": [],
  "TASK-113": ["TASK-108"],
  "TASK-114": ["TASK-109"],
  "TASK-115": ["TASK-110"],
  "TASK-116": ["TASK-106"],
  "TASK-117": ["TASK-102", "TASK-105", "TASK-106"],
  "TASK-118": ["TASK-108", "TASK-109", "TASK-110"]
}
```
