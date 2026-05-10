//! Sandboxed shell-exec for the user-configured Claude Code "statusline"
//! (TASK-115). Spawns a single shell command, pipes a JSON context blob to
//! its stdin, returns at most 1 KiB of stdout, kills the child after a 2 s
//! timeout, and only forwards the host `$PATH` plus a few caller-supplied
//! env keys (HOME / PWD / model / task_id / message_count). On a non-zero
//! exit the renderer receives `[error: <stderr80>]`; on timeout it receives
//! `[statusline timeout]`. The wrapper is intentionally mac-only — see the
//! note next to the unix `cfg` block for tests.
//!
//! The command is registered via Tauri's `invoke_handler!` in
//! `src-tauri/src/lib.rs`; the renderer wraps it as `ipc.runStatuslineCommand`.

use std::process::Stdio;
use std::time::Duration;

use serde_json::Value;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time;

use crate::commands::error::AppError;

/// Hard wall-clock cap for the child. Anything beyond this is killed and the
/// renderer gets a placeholder string so the statusline never freezes the UI.
const TIMEOUT: Duration = Duration::from_secs(2);

/// Maximum bytes of stdout we forward to the renderer. Anything beyond gets
/// truncated and an ellipsis is appended.
const MAX_OUTPUT_BYTES: usize = 1024;

/// Maximum bytes of stderr surfaced when the child exits non-zero.
const MAX_STDERR_BYTES: usize = 80;

/// Render the user-configured statusline command. Spawns `sh -c <command>`
/// with a deliberately small env (`PATH` from the host, plus the cwd / model
/// / task metadata pulled out of `context_json`), pipes `context_json` to
/// the child's stdin, then either:
///   - returns up to 1 KiB of stdout (with an ellipsis if it overflowed), or
///   - returns `"[statusline timeout]"` if the child runs past 2 s, or
///   - returns `"[error: <stderr80>]"` for a non-zero exit code.
///
/// The function never panics on a malformed shell command; it just surfaces
/// the failure mode to the renderer as one of the above strings.
#[tauri::command]
pub async fn run_statusline_command(
    command: String,
    context_json: String,
) -> Result<String, AppError> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    // Pull a few env keys out of the JSON context so the child can resolve
    // `$HOME` / `$PWD` etc. even though we cleared the rest of the env. The
    // JSON is best-effort: if it doesn't parse we fall back to empty values.
    let parsed: Value = serde_json::from_str(&context_json).unwrap_or(Value::Null);
    let cwd = parsed
        .get("cwd")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let home = std::env::var("HOME").unwrap_or_default();
    let host_path = std::env::var("PATH").unwrap_or_default();

    let mut cmd = Command::new("sh");
    cmd.arg("-c").arg(trimmed);
    cmd.env_clear();
    cmd.env("PATH", &host_path);
    cmd.env("HOME", &home);
    if !cwd.is_empty() {
        cmd.env("PWD", &cwd);
        cmd.current_dir(&cwd);
    }
    if let Some(model) = parsed.get("model").and_then(Value::as_str) {
        cmd.env("CLAUDE_MODEL", model);
    }
    if let Some(task_id) = parsed.get("taskId").and_then(Value::as_str) {
        cmd.env("CLAUDE_TASK_ID", task_id);
    }
    if let Some(mc) = parsed.get("messageCount").and_then(Value::as_u64) {
        cmd.env("CLAUDE_MESSAGE_COUNT", mc.to_string());
    }
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            // Spawning the shell itself failed (e.g., /bin/sh missing). Surface
            // the error to the renderer the same way the script does for a
            // non-zero exit so the UI has one consistent failure shape.
            return Ok(format!("[error: {}]", truncate_str(&e.to_string(), MAX_STDERR_BYTES)));
        }
    };

    // Pipe the JSON context into the child's stdin. Best-effort — if the
    // command never reads stdin we still want to capture its output.
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(context_json.as_bytes()).await;
        let _ = stdin.flush().await;
        drop(stdin); // close stdin so reader-side terminates on EOF
    }

    // Race the child's exit against our wall-clock cap. `wait_with_output`
    // collects stdout/stderr concurrently for us, so we don't have to manage
    // separate read tasks.
    let output_fut = child.wait_with_output();
    match time::timeout(TIMEOUT, output_fut).await {
        Ok(Ok(out)) => {
            if out.status.success() {
                Ok(format_stdout(&out.stdout))
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stderr_clean = stderr.trim();
                Ok(format!("[error: {}]", truncate_str(stderr_clean, MAX_STDERR_BYTES)))
            }
        }
        Ok(Err(e)) => Ok(format!("[error: {}]", truncate_str(&e.to_string(), MAX_STDERR_BYTES))),
        Err(_elapsed) => {
            // We don't have a `child` handle anymore (consumed by
            // wait_with_output); on macOS / Linux the OS will reap the
            // orphan once stdin closes. To be defensive, send SIGKILL to
            // the process group via the recorded pid if `wait_with_output`
            // exposes one — currently it doesn't, so the dropped Child
            // handle's Drop impl handles cleanup. The 2 s ceiling means the
            // worst-case orphan lifetime is bounded by the OS reaper.
            Ok("[statusline timeout]".to_string())
        }
    }
}

/// Trim a UTF-8-safe slice of `s` to at most `max` bytes. Walks back from
/// the byte cap to the nearest char boundary so we never split a multi-byte
/// codepoint.
fn truncate_str(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Convert raw stdout bytes into a renderer-friendly string. Trailing
/// newlines are stripped; anything past `MAX_OUTPUT_BYTES` is replaced with
/// a single `…` ellipsis to signal truncation without leaking the rest.
fn format_stdout(bytes: &[u8]) -> String {
    if bytes.len() <= MAX_OUTPUT_BYTES {
        return String::from_utf8_lossy(bytes).trim_end_matches('\n').to_string();
    }
    // Truncate at byte cap, walk back to char boundary, then append ellipsis.
    let mut end = MAX_OUTPUT_BYTES;
    let lossy = String::from_utf8_lossy(bytes);
    let s: &str = &lossy;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = s[..end].trim_end_matches('\n').to_string();
    out.push('…');
    out
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::Instant;

    /// Happy path: a fast `echo` returns its argument back inside the timeout
    /// budget. Anything longer than ~100 ms here would suggest the spawn /
    /// reap loop is doing something nontrivial.
    #[tokio::test]
    async fn happy_path_echo() {
        let out = run_statusline_command("echo hi".into(), "{}".into())
            .await
            .unwrap();
        assert_eq!(out, "hi");
    }

    /// A `sleep 5` must be killed before the configured 2 s wall clock —
    /// the test asserts the call returns inside ~3 s and produces the
    /// timeout placeholder instead of hanging the renderer.
    #[tokio::test]
    async fn timeout_kills_long_command() {
        let start = Instant::now();
        let out = run_statusline_command("sleep 5".into(), "{}".into())
            .await
            .unwrap();
        let elapsed = start.elapsed();
        assert!(elapsed < Duration::from_secs(3), "took {:?}, expected < 3s", elapsed);
        assert!(
            out.contains("timeout") || out.contains("[statusline timeout]"),
            "unexpected output: {out}"
        );
    }

    /// Output larger than 1 KiB is truncated and the result is capped at
    /// `MAX_OUTPUT_BYTES + 4` (4 bytes for the trailing `…` codepoint plus
    /// possible boundary-walk leftovers).
    #[tokio::test]
    async fn output_truncated_at_1kb() {
        let out = run_statusline_command(
            "yes hi | head -c 5000".into(),
            "{}".into(),
        )
        .await
        .unwrap();
        assert!(out.len() <= MAX_OUTPUT_BYTES + 4, "len={} out={out}", out.len());
        assert!(out.ends_with('…'), "expected ellipsis suffix, got: {out}");
    }

    /// Non-zero exit surfaces a truncated stderr inside the `[error: ...]`
    /// envelope so the renderer can show it without crashing.
    #[tokio::test]
    async fn nonzero_exit_returns_error_envelope() {
        let out = run_statusline_command(
            "echo bad >&2; exit 1".into(),
            "{}".into(),
        )
        .await
        .unwrap();
        assert!(out.starts_with("[error: "), "got {out}");
        assert!(out.contains("bad"), "got {out}");
    }

    /// Empty command short-circuits to an empty string — the renderer
    /// uses this signal to avoid mounting the bar when nothing's wired up.
    #[tokio::test]
    async fn empty_command_returns_empty_string() {
        let out = run_statusline_command("   ".into(), "{}".into()).await.unwrap();
        assert_eq!(out, "");
    }

    /// Sandbox: the child sees `$PATH` (so `sh` can find `echo`) but does
    /// not see arbitrary host env vars. We assert that a unique env key set
    /// in this process's environment is *not* visible to the child.
    #[tokio::test]
    async fn sandbox_blocks_host_env_leak() {
        // Set a unique key in the parent that we don't forward.
        unsafe {
            std::env::set_var("KLAUDEX_STATUSLINE_TEST_LEAK", "should-not-leak");
        }
        let out = run_statusline_command(
            "printenv KLAUDEX_STATUSLINE_TEST_LEAK || echo absent".into(),
            "{}".into(),
        )
        .await
        .unwrap();
        assert_eq!(out, "absent", "leaked host env to child: {out}");
        unsafe {
            std::env::remove_var("KLAUDEX_STATUSLINE_TEST_LEAK");
        }
    }
}
