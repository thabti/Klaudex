#!/usr/bin/env bash
# ralph-watcher.sh — keeps ralph-cherry-pick running until commits.txt is
# fully processed. Designed to be invoked every 5 minutes (cron or `loop`
# skill). One-shot per invocation: checks if anything is unprocessed and
# nothing is running, then starts ralph-cherry-pick in the foreground for
# this invocation (cron/loop will reschedule the next pass).
#
# Exit codes:
#   0 — work done (or already in progress; nothing to do this tick)
#   1 — configuration error
#   2 — ralph-cherry-pick failed; manual inspection required
#
# Usage:
#   scripts/ralph-watcher.sh                # one tick
#   scripts/ralph-watcher.sh --status       # show progress, exit 0
#
# To run forever with 5-min cadence, prefer the `loop` skill / cron rather
# than baking a loop into this script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RALPH_DIR="$REPO_ROOT/.ralph"
COMMITS_FILE="$RALPH_DIR/commits.txt"
LOG_FILE="$RALPH_DIR/processed.log"
LOCK_FILE="$RALPH_DIR/watcher.lock"
TICK_LOG="$RALPH_DIR/watcher.log"

if [[ "${1:-}" == "--status" ]]; then
  TOTAL=$(wc -l < "$COMMITS_FILE" 2>/dev/null || echo 0)
  DONE=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
  echo "[watcher] $DONE / $TOTAL processed"
  tail -5 "$LOG_FILE" 2>/dev/null || true
  exit 0
fi

cd "$REPO_ROOT"

if [[ ! -f "$COMMITS_FILE" ]]; then
  echo "[watcher] no $COMMITS_FILE" >&2; exit 1
fi

# Anything left to do?
TOTAL=$(wc -l < "$COMMITS_FILE")
DONE=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
REMAINING=$((TOTAL - DONE))
echo "[$(date -u +%FT%TZ)] tick — $DONE/$TOTAL done, $REMAINING remain" | tee -a "$TICK_LOG"

if [[ "$REMAINING" -le 0 ]]; then
  echo "[watcher] all commits processed — nothing to do"
  exit 0
fi

# Another ralph already running? Don't start a second one.
if pgrep -f "scripts/ralph-cherry-pick.sh" >/dev/null; then
  echo "[watcher] ralph-cherry-pick already running — skip tick"
  exit 0
fi
if pgrep -f "kiro-cli .* chat .* --no-interactive" >/dev/null; then
  echo "[watcher] kiro-cli still busy on previous commit — skip tick"
  exit 0
fi

# stale lock?
if [[ -f "$LOCK_FILE" ]]; then
  PID=$(cat "$LOCK_FILE" 2>/dev/null || true)
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "[watcher] another watcher tick still active (pid=$PID) — skip"
    exit 0
  else
    echo "[watcher] stale lock, removing"
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# Worktree must be clean to start (a failed previous run leaves dirt; ralph
# refuses to start dirty, so the watcher should notice and bail).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[watcher] worktree dirty — refusing to start ralph. Resolve and rerun." | tee -a "$TICK_LOG"
  exit 2
fi

echo "[watcher] starting ralph-cherry-pick"
if "$REPO_ROOT/scripts/ralph-cherry-pick.sh" 2>&1 | tee -a "$TICK_LOG"; then
  echo "[watcher] ralph-cherry-pick exited 0" | tee -a "$TICK_LOG"
else
  CODE=$?
  echo "[watcher] ralph-cherry-pick exited $CODE — will retry on next tick unless commits.txt is exhausted" | tee -a "$TICK_LOG"
fi
