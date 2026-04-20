//! Integration tests against the real Claude Code CLI binary.
//!
//! These tests require `claude` to be installed and in PATH.
//! Run with: `cargo test --test claude_cli_integration`
//!
//! Tests marked #[ignore] require an API key and make real API calls.
//! Run them with: `cargo test --test claude_cli_integration -- --ignored`

use std::process::Command;
use std::time::Duration;
use wait_timeout::ChildExt;

const TIMEOUT: Duration = Duration::from_secs(15);

/// Run a command with a timeout. Kills the child if it exceeds the deadline.
fn run_with_timeout(cmd: &mut Command) -> std::process::Output {
    let mut child = cmd
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("failed to spawn command");
    match child.wait_timeout(TIMEOUT) {
        Ok(Some(status)) => {
            let stdout = child.stdout.take().map(|mut r| {
                let mut buf = Vec::new();
                std::io::Read::read_to_end(&mut r, &mut buf).ok();
                buf
            }).unwrap_or_default();
            let stderr = child.stderr.take().map(|mut r| {
                let mut buf = Vec::new();
                std::io::Read::read_to_end(&mut r, &mut buf).ok();
                buf
            }).unwrap_or_default();
            std::process::Output { status, stdout, stderr }
        }
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            panic!("command timed out after {TIMEOUT:?}");
        }
        Err(e) => panic!("wait_timeout error: {e}"),
    }
}

/// Find the claude binary, returning None if not installed.
fn find_claude_bin() -> Option<String> {
    let candidates = [
        dirs::home_dir().map(|h| h.join(".local/bin/claude").to_string_lossy().to_string()),
        Some("/usr/local/bin/claude".to_string()),
        Some("/opt/homebrew/bin/claude".to_string()),
    ];
    for candidate in candidates.into_iter().flatten() {
        if std::path::Path::new(&candidate).exists() {
            return Some(candidate);
        }
    }
    Command::new("which")
        .arg("claude")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

// ── Basic CLI availability ──────────────────────────────────────

#[test]
fn claude_cli_is_installed() {
    assert!(find_claude_bin().is_some(), "claude CLI not found in PATH or known locations");
}

#[test]
fn claude_cli_version_returns_success() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(Command::new(&bin).arg("--version"));
    assert!(output.status.success(), "claude --version failed: {}", String::from_utf8_lossy(&output.stderr));
    let version = String::from_utf8_lossy(&output.stdout);
    assert!(version.contains("Claude Code"), "unexpected version output: {version}");
}

#[test]
fn claude_cli_help_returns_success() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(Command::new(&bin).arg("--help"));
    assert!(output.status.success(), "claude --help failed");
    let help = String::from_utf8_lossy(&output.stdout);
    assert!(help.contains("--output-format"), "help missing --output-format");
    assert!(help.contains("--input-format"), "help missing --input-format");
    assert!(help.contains("--print"), "help missing --print");
    assert!(help.contains("--verbose"), "help missing --verbose");
}

// ── Flag validation ─────────────────────────────────────────────

#[test]
fn claude_cli_has_no_cwd_flag() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(Command::new(&bin).arg("--help"));
    let help = String::from_utf8_lossy(&output.stdout);
    assert!(!help.contains("--cwd"), "claude should NOT have a --cwd flag (use .current_dir instead)");
}

#[test]
fn claude_cli_accepts_output_format_stream_json() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--output-format", "stream-json", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --output-format stream-json");
}

#[test]
fn claude_cli_accepts_input_format_stream_json() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--input-format", "stream-json", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --input-format stream-json");
}

// ── Working directory via process cwd ───────────────────────────

#[test]
fn claude_cli_respects_current_dir() {
    let bin = find_claude_bin().expect("claude not installed");
    let tmp = tempfile::tempdir().expect("failed to create tempdir");
    let output = run_with_timeout(
        Command::new(&bin).arg("--version").current_dir(tmp.path()),
    );
    assert!(output.status.success(), "claude --version should work with custom cwd");
}

// ── Arg construction matches what connection.rs builds ──────────

#[test]
fn connection_args_are_valid_claude_flags() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(Command::new(&bin).args([
        "--output-format", "stream-json",
        "--verbose",
        "--input-format", "stream-json",
        "--help",
    ]));
    assert!(
        output.status.success(),
        "claude should accept all connection.rs flags: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn connection_args_with_dangerously_skip_permissions() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(Command::new(&bin).args([
        "--output-format", "stream-json",
        "--verbose",
        "--input-format", "stream-json",
        "--dangerously-skip-permissions",
        "--help",
    ]));
    assert!(
        output.status.success(),
        "claude should accept --dangerously-skip-permissions: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

// ── New flags wired in connection.rs ─────────────────────────────

#[test]
fn claude_cli_accepts_model_flag() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--model", "sonnet", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --model: {}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn claude_cli_accepts_permission_mode_plan() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--permission-mode", "plan", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --permission-mode plan: {}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn claude_cli_accepts_agent_flag() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--agent", "some-agent", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --agent: {}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn claude_cli_accepts_no_session_persistence() {
    let bin = find_claude_bin().expect("claude not installed");
    let output = run_with_timeout(
        Command::new(&bin).args(["--no-session-persistence", "--help"]),
    );
    assert!(output.status.success(), "claude should accept --no-session-persistence: {}", String::from_utf8_lossy(&output.stderr));
}

#[test]
fn connection_full_args_with_model_and_mode() {
    let bin = find_claude_bin().expect("claude not installed");
    // Simulate the full arg set that connection.rs now builds
    let output = run_with_timeout(Command::new(&bin).args([
        "--output-format", "stream-json",
        "--verbose",
        "--input-format", "stream-json",
        "--model", "sonnet",
        "--permission-mode", "plan",
        "--no-session-persistence",
        "--help",
    ]));
    assert!(
        output.status.success(),
        "claude should accept full connection.rs arg set: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

// ── Print mode (requires API key) ───────────────────────────────

#[test]
#[ignore]
fn claude_cli_print_mode_returns_output() {
    let bin = find_claude_bin().expect("claude not installed");
    let tmp = tempfile::tempdir().expect("failed to create tempdir");
    let output = run_with_timeout(
        Command::new(&bin)
            .args(["--bare", "-p", "respond with exactly: PING"])
            .current_dir(tmp.path()),
    );
    assert!(output.status.success(), "claude -p failed: {}", String::from_utf8_lossy(&output.stderr));
    assert!(!output.stdout.is_empty(), "claude -p returned empty output");
}

#[test]
#[ignore]
fn claude_cli_stream_json_produces_valid_json_lines() {
    let bin = find_claude_bin().expect("claude not installed");
    let tmp = tempfile::tempdir().expect("failed to create tempdir");
    let output = run_with_timeout(
        Command::new(&bin)
            .args(["--bare", "--output-format", "stream-json", "-p", "respond with exactly: PONG"])
            .current_dir(tmp.path()),
    );
    assert!(output.status.success(), "stream-json failed: {}", String::from_utf8_lossy(&output.stderr));
    let stdout = String::from_utf8_lossy(&output.stdout);
    let has_json = stdout.lines().any(|l| {
        let t = l.trim();
        !t.is_empty() && serde_json::from_str::<serde_json::Value>(t).is_ok()
    });
    assert!(has_json, "stream-json should contain valid JSON lines, got: {stdout}");
}

#[test]
#[ignore]
fn claude_cli_stream_json_with_current_dir() {
    let bin = find_claude_bin().expect("claude not installed");
    let tmp = tempfile::tempdir().expect("failed to create tempdir");
    std::fs::write(tmp.path().join("marker.txt"), "integration-test").unwrap();
    let output = run_with_timeout(
        Command::new(&bin)
            .args([
                "--bare", "--output-format", "stream-json", "--verbose",
                "-p", "list the files in the current directory using ls",
                "--dangerously-skip-permissions",
            ])
            .current_dir(tmp.path()),
    );
    assert!(output.status.success(), "claude failed: {}", String::from_utf8_lossy(&output.stderr));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("marker.txt"), "claude should see marker.txt in cwd, got: {stdout}");
}
