# Klaudex security audit

**Date:** 2026-05-13
**Scope:** Full Rust backend — Tauri config, capabilities, all `src-tauri/src/` modules
**Auditor:** Automated review via source code analysis (rust-architecture-reviewer agent)

---

## Executive summary

Klaudex is a Tauri v2 desktop app with a Rust backend and React frontend. The architecture is generally sound: IPC uses Tauri's invoke system, most git operations use libgit2, ACP connections run on dedicated OS threads with proper `!Send` handling, and the permission system has a timeout guard and correct managed-state access.

The main risks are: **the tight-sandbox is wired but disconnected** (C2), **a renderer-callable stdio subprocess spawner with no allowlist** (C3), **the kirodex sandbox-bypass-via-`/` persists** (C1), **two new osascript injection sites in `project_watcher.rs`** (H1, H2), and **`claude_bin` validation missing in oneshot and MCP paths** (H5).

Several kirodex findings were fixed (`fs_ops.rs` osascript injection, partial file-read blocklist), but the same patterns reappeared in the new `project_watcher.rs` and `claude_config.rs` modules.

---

## Findings

### Critical

#### C1. Sandbox bypass via root path `/` persists from kirodex

**File:** `src-tauri/src/commands/acp/sandbox.rs`, lines 117–139

The same kirodex bug remains: when the allowed set contains `"/"`, `is_path_strictly_allowed` permits any absolute path, including `/etc/passwd`. The test at `commands/acp/tests.rs:359–364` literally encodes this as the *expected* behavior (`fn strict_root_slash_not_allowed` asserts `is_path_strictly_allowed(&allowed, "/etc/passwd")` returns **true**).

Now compounded by C2 — even with the bug present, the function is currently dead. But if anything re-wires `tight_sandbox`, this hole is back instantly.

**Fix:** Reject `"/"` (and other overly broad paths like `"/Users"`, `"/home"`, `"/tmp"`) in `extract_paths_from_message` or require at least two path segments. Flip the test assertion to `false`.

---

#### C2. Sandbox is unwired — `tight_sandbox` does nothing

**File:** `src-tauri/src/commands/acp/connection.rs`, lines 87, 161, 636–659, 938–944

`spawn_connection(..., tight_sandbox: bool, ...)` plumbs the flag to `run_claude_connection`, where it is renamed `_tight_sandbox: bool` (explicit "unused" prefix). An `allowed_paths: Arc<Mutex<BTreeSet<String>>>` is built and populated from `extract_paths_from_message` on every `Prompt`/`SteerInject`, but neither `is_path_strictly_allowed`, `is_path_allowed`, nor `is_within_workspace` is ever called against tool inputs.

Effect: every project preference `tightSandbox = true` is a no-op. The renderer surfaces the "tight sandbox" toggle (`commands/acp/commands.rs:50–53, 279–281, 382–384, 494–496, 701–703`), but the backend honors only the Claude CLI's own `--permission-prompt-tool` flow — and only when `auto_approve` is off. A user who turns auto-approve on with tight-sandbox enabled believes they are sandboxed but is not.

**Fix:** Wire `_tight_sandbox` to a real check. On every tool-call `rawInput`, call `extract_paths_from_json` and gate on `is_within_workspace` plus `is_path_strictly_allowed`/`is_path_allowed` against `allowed_paths`. Emit a permission request when paths fall outside. Until wired, remove the `tight_sandbox` toggle from the renderer to avoid security theater.

---

#### C3. `mcp_transport_test` lets the frontend spawn arbitrary subprocesses

**File:** `src-tauri/src/commands/transport.rs`, lines 80–127, 482–527

`mcp_transport_test` accepts `TransportConfig::Stdio(StdioConfig { command, args, env, working_directory })` directly from the renderer. `StdioTransport::new` calls `Command::new(&config.command)` with no allowlist on the executable path, no path validation, no cwd validation, and arbitrary env injection.

A compromised renderer (or any future XSS through markdown/log rendering) can spawn anything on the host as the user. The HTTP variant has solid SSRF guards (`validate_mcp_url`, lines 290–335) — the stdio variant has none.

**Fix:** Either remove the stdio variant from the renderer-facing `mcp_transport_test` command (force it through the validated `mcp_add_server` flow), or restrict `StdioConfig.command` to the same absolute-path allowlist used in `acp/connection.rs:749–770`, and intersect `working_directory` with the active workspace.

---

### High

#### H1. `osascript` injection in `project_watcher::trash_entry`

**File:** `src-tauri/src/commands/project_watcher.rs`, lines 756–775

```rust
let path_str = path.to_string_lossy();
let script = format!(
    "tell application \"Finder\" to delete POSIX file \"{}\"",
    path_str.replace('"', "\\\"")
);
```

The only escape is `"` → `\"`. AppleScript treats `\` as an escape character too, so a file name containing `\` or a newline breaks the quoted string. A workspace tracked by klaudex can contain arbitrary file names (created by agents, git clones, etc.), and `validate_path_containment` keeps them inside the workspace but does not bound the file name.

The safe pattern (env-var pass-through) was applied in `fs_ops.rs:144–150, 233–239, 1027–1033` and `project_watcher.rs:1067–1071` but not here.

**Fix:** Replace the AppleScript string with an env-var pass-through (`system attribute "KLAUDEX_TRASH_PATH"`), or use the `trash` Rust crate (`trash = "5"`) to skip osascript entirely.

---

#### H2. `osascript` injection in `project_watcher::open_finder_search`

**File:** `src-tauri/src/commands/project_watcher.rs`, lines 1136–1166

```rust
let script = format!(
    r#"tell application "Finder"
    ...
    set targetFolder to POSIX file "{}" as alias
    ...
end tell"#,
    path.replace('"', "\\\"")
);
```

Same defect as H1, and this command is registered (`lib.rs:600`) with `path: String` straight from the renderer — without any `validate_path_containment` or workspace check. A renderer can pass `evil"\nset volume output volume 0\n--` to inject arbitrary AppleScript. The non-macOS branch passes `path` to `open::that(&path)`, which can trigger arbitrary URL handlers.

**Fix:** Same env-var pass-through pattern; also add a workspace/recents containment check before any OS call.

---

#### H3. File reads blocked only by home-prefix denylist, not workspace allowlist

**File:** `src-tauri/src/commands/fs_ops.rs`, lines 28–79

`read_text_file` and `read_file_base64` accept an arbitrary `path` and only block five home-relative prefixes (`~/.ssh/`, `~/.gnupg/`, `~/.aws/`, `~/.config/gh/`, `~/.netrc`). Absolute paths outside the home directory (`/etc/shadow`, `/private/var/db/...`, any peer home directory on multi-user systems) and common secrets files like `~/.docker/config.json`, browser cookie jars, and application keychains are not blocked.

This is the kirodex H1 finding only partially remediated.

**Fix:** Switch from "blocklist sensitive prefixes" to "allowlist within active workspaces and a small known-safe set." Plumb the active workspaces from `AcpState` or `recent_projects`.

---

#### H4. `git_worktree_create` / `git_worktree_remove` still shell out to `git`

**File:** `src-tauri/src/commands/git.rs`, lines 735–771

```rust
let output = Command::new("git")
    .args(["worktree", "add", "-B", &branch, &worktree_path, "HEAD"])
    .current_dir(&cwd)
    .output()?;
```

The project convention documented in `CLAUDE.md` explicitly requires using `git2` instead of `Command::new("git")`. Worktree creation/removal is local-only (no auth/SSH excuse). The `--force` flag also wipes local commits without the user-confirmation step that the `git2` API would surface.

**Fix:** Replace with `git2::Repository::worktree()` / `Worktree::prune()`. If shelling out remains necessary, document why and tighten input bounds.

---

#### H5. `claude_bin` validation absent in oneshot and MCP spawn paths

**File:** `src-tauri/src/commands/git_ai.rs`, lines 243–290; `src-tauri/src/commands/claude_config.rs`, lines 590–602

`run_claude_oneshot` (shared by commit-message, branch-name, PR-content, and thread-title generation) calls `Command::new(claude_bin)` with whatever path is in `SettingsState`, with no path-allowlist check. The same gap exists in `mcp_add_server` / `mcp_remove_server` in `claude_config.rs`.

Contrast with `acp/connection.rs:749–770`, which validates `claude_bin` against known trusted prefixes (`/usr/local/bin/`, `/opt/homebrew/bin/`, `/Applications/`, `~/.local/bin/`, `~/.claude/bin/`).

The `claude_bin` setting is writable via `save_settings`; a tampered TOML or a compromised renderer can redirect all oneshot spawns to any executable.

**Fix:** Factor the `claude_bin` validation from `acp/connection.rs` into a shared helper in `fs_ops.rs` and call it from every spawn site.

---

### Medium

#### M1. `pty_create` cwd allowlist is still broad

**File:** `src-tauri/src/commands/pty.rs`, lines 67–96

The cwd allowlist accepts everything under `$HOME`, `/tmp`, `/private/tmp`, `/Volumes` on macOS. On a developer machine `$HOME` includes `~/.ssh`, `~/.aws`, etc. A spawned shell (with `-l`) inherits the user's full login profile and can access all of them.

**Fix:** Tie cwd to either an active task's workspace (canonicalized) or the recent-projects list.

---

#### M2. `devtools` Cargo feature is unconditional

**File:** `src-tauri/Cargo.toml`, line 15

```toml
tauri = { version = "2", features = ["macos-private-api", "devtools"] }
```

Production builds ship with WebKit's web inspector enabled. Anyone with physical access can open the inspector and execute arbitrary JavaScript in the app's context.

**Fix:** Gate behind `#[cfg(debug_assertions)]` or a Cargo feature flag:

```toml
[features]
devtools = ["tauri/devtools"]
```

---

#### M3. CSP allows two PostHog wildcards on `connect-src`

**File:** `src-tauri/tauri.conf.json`

```
connect-src 'self' ipc: http://ipc.localhost https://*.posthog.com https://*.i.posthog.com
```

Two wildcards widen the exfiltration surface. `*.posthog.com` covers tenant subdomains an attacker controls in PostHog Cloud.

**Fix:** Pin to specific origins (`https://us.i.posthog.com` / `https://eu.i.posthog.com`) and drop wildcards.

---

#### M4. Lock dropped between read and write in `task_send_message` reconnect

**File:** `src-tauri/src/commands/acp/commands.rs`, lines 258–296

`task_send_message` takes the connections lock, checks `alive`, drops it; re-takes the lock, removes the stale handle, drops; spawns a new connection; re-takes the lock, inserts. Two concurrent calls for the same `task_id` can both observe `need_reconnect = true`, spawn two fresh Claude subprocesses, and have only one handle survive — the orphan receives the prompt, starts a turn, then dies when its `cmd_rx` is dropped.

Same pattern in `task_resume` (lines 364–399) and `task_set_model` (681–717).

**Fix:** Hold the connections lock across the entire kill-then-spawn block, or move reconnect into the connection thread's command loop.

---

#### M5. `open_finder_search` accepts arbitrary path with no workspace check

See H2 — separately from the injection risk, the non-macOS branch passes `path` to `open::that()`, which can be a remote URL (`file://`, `vnc://`, `smb://`) triggering arbitrary default handlers.

---

#### M6. `pty_resize` has no upper bound on `cols` / `rows`

**File:** `src-tauri/src/commands/pty.rs`, lines 179–202

`cols: u16, rows: u16` from the renderer with no upper bound. `cols = 65535, rows = 65535` can DoS the pty with a giant terminal buffer.

**Fix:** Cap to e.g. 1024 cols / 1024 rows.

---

#### M7. `task_id` interpolated into git ref names without validation

**File:** `src-tauri/src/commands/checkpoint.rs`, lines 80, 105, 157, 166, 257, 274

`format!("refs/klaudex/cp/{task_id}/{turn}")` where `task_id` can come from `CreateTaskParams.existing_id: Option<String>` with no validation. Git ref names disallow `..`, `~`, `^`, `:`, space, etc.

**Fix:** Validate `task_id` against `[a-zA-Z0-9-]+` before interpolating into ref names.

---

#### M8. `reset_app_data` only removes top-level files

**File:** `src-tauri/src/lib.rs`, lines 38–50

Reads only top-level entries and skips subdirectories — nested files survive the reset. Either use `remove_dir_all` or rename the command to reflect its shallow behavior.

---

#### M9. `claude_watcher::stop_all` called twice on shutdown

**File:** `src-tauri/src/lib.rs`, lines 126 and 139

Benign double call — the second is always a no-op. Remove the duplicate.

---

### Low

#### L1. Orphan modules and unregistered Tauri commands

`commands/mod.rs` does not declare `permissions` or `statusline`, yet both files exist. Several commands are defined as `#[tauri::command]` but not in `invoke_handler!`:

- `commands/permissions.rs` — `pub fn match_permission` and its full glob engine are dead
- `commands/statusline.rs` — `#[tauri::command] pub async fn run_statusline_command` is not registered
- `commands/claude_watcher.rs::watch_global_claude` is never called from `lib.rs::setup`
- `commands/settings.rs::read_claude_settings_permissions` is not in `invoke_handler!`

The renderer presumably has IPC calls wired to these that silently fail. See CLAUDE.md: "Dead code traps in component wiring."

**Fix:** Register the commands or remove the files; update inline comments that claim registration.

---

#### L2. `task_delete` swallows channel-send failures silently

**File:** `src-tauri/src/commands/acp/commands.rs`, lines 447–454

`let _ = h.cmd_tx.send(AcpCommand::Kill)` on a dead channel is silently swallowed, but the task is removed from the map unconditionally. The orphan thread keeps running until `cmd_rx.recv()` returns `None`.

---

#### L3. `task_pause` leaves stale `ConnectionHandle` in the map

**File:** `src-tauri/src/commands/acp/commands.rs`, lines 334–349

Sends `AcpCommand::Cancel` (which kills the subprocess) but does not remove the handle from `state.connections`. The brief two-handle window (old handle + fresh handle from `task_resume`) is a footgun for future code.

---

#### L4. Inconsistent error semantics across steering commands

**File:** `src-tauri/src/commands/acp/commands.rs`, lines 313–331, 642–650, 660–670

`task_steer_inject` checks `alive` before sending (good). `set_mode` returns the error on send failure (good). `set_model` returns `Ok(())` even when send fails on a closed channel. Three commands, three different failure behaviors.

---

#### L5. PTY reader chunks may corrupt multi-byte UTF-8

**File:** `src-tauri/src/commands/pty.rs`, lines 126–146

`String::from_utf8_lossy` converts each 16 KiB chunk independently, corrupting multi-byte characters that straddle chunk boundaries. Fix: base64-encode raw bytes for transit.

---

#### L6. `is_within_workspace` falls back to lexical `starts_with` on canonicalization failure

**File:** `src-tauri/src/commands/acp/sandbox.rs`, lines 5–22

```rust
Err(_) => return std::path::Path::new(path).starts_with(workspace),
```

Lexical `starts_with` on `/Users/me/p` matches `/Users/me/p-evil/...`. Should fail closed (`return false`) instead.

---

#### L7. `extract_paths_from_message` only sees `/`-prefixed paths

**File:** `src-tauri/src/commands/acp/sandbox.rs`, lines 58–72

Relative paths (`./src/`, `~/code/`, `../other-repo/.env`) are never added to the allowed set. If the sandbox is re-wired (C2), the agent can access parent-of-workspace files via relative paths that were never extracted for checking.

---

#### L8. Permission resolvers leak on connection drop without a resolver firing

**File:** `src-tauri/src/commands/acp/connection.rs`, lines 588–613; `acp/types.rs:177`

If a task is killed while a permission request is pending, `handle_control_request` correctly emits Deny, but the `permission_resolvers` map retains the sender keyed by `request_id`. Mid-session abandons accumulate stale entries until `shutdown_app`.

**Fix:** On connection drop, sweep `permission_resolvers` for entries belonging to this task. Easiest: keep a per-connection `Vec<String>` of `request_id`s and drain it in the exit path.

---

#### L9. `mcp_add_server` / `mcp_remove_server` accept `claude_bin` without allowlist check

**File:** `src-tauri/src/commands/claude_config.rs`, lines 590–602, 679–747

Renderer-supplied `claude_bin` is passed to `Command::new(&bin)` without the absolute-path / known-prefix check used in `acp/connection.rs`. Covered by the H5 fix.

---

#### L10. Default panic hook fires in release builds

**File:** `src-tauri/src/lib.rs`, lines 55–82

The custom panic hook calls the default hook unconditionally, walking the symbol table and printing colored output in release builds. Gate `default_hook(info)` on `#[cfg(debug_assertions)]`.

---

## Positive findings

1. **`claude_bin` allowlist in ACP** — `acp/connection.rs:749–770` validates the binary path against known trusted prefixes and rejects relative paths. This is the bar all other spawn sites should match.

2. **PATH sanitization for ACP subprocess** — `acp/connection.rs:725–745` filters user-PATH entries to trusted prefixes before passing to the subprocess.

3. **HTTP SSRF mitigations in `mcp_transport_test`** — `transport.rs:290–335` blocks RFC1918, link-local, GCP metadata, and non-localhost HTTP.

4. **`osascript` env-var pass-through in `fs_ops.rs`** — `fs_ops.rs:144–150, 233–239, 1027–1033` and `project_watcher.rs:1067–1071` use the correct injection-free pattern. H1 and H2 should adopt the same approach.

5. **Path containment in git stage** — `git.rs:525–557` rejects `..` components and canonicalizes against the repo root.

6. **`signal_process` enforces descendancy** — `process_diagnostics.rs:56–85` refuses to signal non-descendants.

7. **Tight, well-tested error model** — `commands/error.rs` is small, `#[from]`-derived, `Serialize`-able.

8. **PTY drop impl kills and waits the child** — `pty.rs:29–34` ensures `PtyInstance::drop` reaps the child.

9. **ACP concurrency model** — `std::thread` + `current_thread tokio` + `LocalSet::block_on` faithfully implemented; permission handler uses `app.try_state::<AcpState>()` (not a cloned copy).

10. **`probe_capabilities` race guard** — `commands/acp/commands.rs:807–812` uses `AtomicBool::swap`.

11. **`validate_path_containment` handles non-existent destinations** — `project_watcher.rs:62–106` walks ancestors when the leaf doesn't exist yet.

12. **Worktree slug validator** — `git.rs:693–709` is a narrow allowlist and well-tested.

13. **SQL parameterization in `thread_db.rs`** — All queries use parameterized statements; no interpolation.

14. **Thread DB corruption recovery** — Integrity checks with timestamped backups and in-memory fallback.

---

## Recommended fixes (priority order)

| # | Severity | Finding | Effort | Impact |
|---|----------|---------|--------|--------|
| 1 | Critical | C3: Remove/gate stdio variant in `mcp_transport_test` | Small | Prevents renderer from spawning arbitrary executables |
| 2 | Critical | C2: Wire `_tight_sandbox` to actual path checks, or remove the toggle | Medium | Fixes silent security theater for tight-sandbox users |
| 3 | Critical | C1: Block `/` and shallow paths; flip test assertion | Small | Prevents full-filesystem access via sandbox bypass |
| 4 | High | H1: Replace osascript interpolation in `trash_entry` with env-var pattern | Small | Eliminates injection in file-deletion path |
| 5 | High | H2: Same fix for `open_finder_search`; add containment check | Small | Eliminates injection in search path |
| 6 | High | H3: Switch file reads from denylist to workspace allowlist | Medium | Prevents arbitrary file reads from compromised renderer |
| 7 | High | H4: Migrate worktree commands to `git2` | Medium | Aligns with project convention, removes shell surface |
| 8 | High | H5+L9: Factor `claude_bin` allowlist into shared helper; call from all spawn sites | Small | Closes spawn hijacking via settings tamper |
| 9 | Medium | M2: Gate `devtools` behind `cfg(debug_assertions)` | Small | Removes inspector access from release builds |
| 10 | Medium | M3: Pin CSP `connect-src` to specific PostHog hosts | Small | Reduces exfiltration surface |
| 11 | Medium | M4: Hold connections lock across kill-then-spawn block | Small | Eliminates orphan-subprocess race |
| 12 | Medium | M1: Tie PTY cwd to active workspaces/recents | Small | Narrows shell-spawn surface |
| 13 | Medium | M6: Cap `pty_resize` cols/rows | Tiny | Prevents pty DoS |
| 14 | Medium | M7: Validate `task_id` in checkpoint ref construction | Small | Prevents malformed git refs |
| 15 | Low | L1: Register orphan commands or delete orphan files | Small | Fixes silent feature breakage |
| 16 | Low | L5: Base64-encode PTY bytes instead of `from_utf8_lossy` | Small | Preserves byte fidelity |
| 17 | Low | L6: Fail closed in `is_within_workspace` on canonicalization error | Tiny | Removes lexical-match fallback |
| 18 | Low | L8: Sweep `permission_resolvers` on connection drop | Small | Prevents minor memory leak |
| 19 | Low | L2/L3/L4: Normalize send-failure semantics across ACP commands | Small | Makes failure behavior predictable |
| 20 | Low | M9: Remove duplicate `claude_watcher::stop_all` call | Tiny | Code clarity |

---

## Cross-reference with kirodex audit

| kirodex finding | klaudex status |
|---|---|
| C1 — sandbox bypass via `/` | **Persists** — same code, same test assertion |
| H1 — unrestricted file reads | **Partially fixed** — 5-prefix denylist added; outside-home reads still unrestricted |
| H2/H3 — osascript injection in `fs_ops.rs` | **Fixed** — migrated to env-var pass-through |
| H4 — git worktree shelling out | **Persists** — `git.rs:735–771` |
| M1 — `pty_create` cwd validation | **Partially fixed** — allowlist added but still broad |
| M3 — `devtools` unconditional | **Persists** — `Cargo.toml:15` |
| M4 — CSP wildcards | **Persists** — `*.posthog.com`, `*.i.posthog.com` |

New issues in klaudex-specific modules (no kirodex equivalent):

- **C2** — `tight_sandbox` parameter disconnected during rewrite to direct Claude CLI subprocess
- **C3** — renderer-spawnable stdio MCP transport in new `transport.rs`
- **H1/H2** — new osascript injection sites in `project_watcher.rs` (env-var fix not carried over from `fs_ops.rs`)
- **H5/L9** — `claude_bin` validation regression in oneshot and MCP paths (new modules forked spawn code without ACP's allowlist)
- **L1** — orphan `permissions.rs`, `statusline.rs`, `watch_global_claude`, `read_claude_settings_permissions` indicate partially-wired features
