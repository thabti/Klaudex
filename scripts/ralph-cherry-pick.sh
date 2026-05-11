#!/usr/bin/env bash
# ralph-cherry-pick.sh — drive kiro-cli to cherry-pick each upstream commit.
#
# Reads .ralph/commits.txt (one "SHA SUBJECT" per line), and for each
# unprocessed commit renders the prompt at .ralph/prompt.md, hands it to
# kiro-cli, and waits for kiro-cli to write .ralph/current/DONE.
#
# State:
#   .ralph/commits.txt        — input list (regen with the awk one-liner)
#   .ralph/processed.log      — append-only TSV: ts \t sha \t status \t note
#   .ralph/last_sha           — last SHA we attempted (resume marker)
#   .ralph/current/diff.patch — upstream diff for the current SHA
#   .ralph/current/prompt.txt — rendered prompt
#   .ralph/current/DONE       — written by kiro-cli on completion
#
# Usage:
#   scripts/ralph-cherry-pick.sh                 # process all remaining
#   scripts/ralph-cherry-pick.sh --max 5         # only first 5 unprocessed
#   scripts/ralph-cherry-pick.sh --dry-run       # render prompts, no LLM
#   scripts/ralph-cherry-pick.sh --resume <sha>  # start from this SHA

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RALPH_DIR="$REPO_ROOT/.ralph"
COMMITS_FILE="$RALPH_DIR/commits.txt"
PROMPT_TPL="$RALPH_DIR/prompt.md"
LOG_FILE="$RALPH_DIR/processed.log"
LAST_SHA_FILE="$RALPH_DIR/last_sha"
CURRENT_DIR="$RALPH_DIR/current"

MAX=0
DRY_RUN=0
RESUME_SHA=""
MAX_ATTEMPTS=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max)          MAX="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=1; shift ;;
    --resume)       RESUME_SHA="$2"; shift 2 ;;
    --max-attempts) MAX_ATTEMPTS="$2"; shift 2 ;;
    -h|--help)      sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -f "$COMMITS_FILE" ]] || { echo "missing $COMMITS_FILE" >&2; exit 1; }
[[ -f "$PROMPT_TPL" ]]   || { echo "missing $PROMPT_TPL" >&2; exit 1; }
command -v kiro-cli >/dev/null || { echo "kiro-cli not in PATH" >&2; exit 1; }
mkdir -p "$CURRENT_DIR"
touch "$LOG_FILE"

cd "$REPO_ROOT"

# already-processed SHAs (any status)
processed_shas() {
  awk -F'\t' '{print $2}' "$LOG_FILE" 2>/dev/null
}

# resume cursor
RESUMING=1
if [[ -z "$RESUME_SHA" ]]; then RESUMING=0; fi

count=0
while IFS=' ' read -r SHA SUBJECT_REST; do
  [[ -z "$SHA" ]] && continue
  SUBJECT="$SUBJECT_REST"

  if [[ $RESUMING -eq 1 ]]; then
    if [[ "$SHA" == "$RESUME_SHA" ]]; then RESUMING=0; else continue; fi
  fi

  if processed_shas | grep -q "^$SHA$"; then
    continue
  fi

  count=$((count + 1))
  if [[ "$MAX" -gt 0 && "$count" -gt "$MAX" ]]; then break; fi

  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "[ralph] [$count] $SHA  $SUBJECT"
  echo "════════════════════════════════════════════════════════════════"

  # worktree clean check
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[ralph] worktree dirty — stop. Resolve and rerun."
    exit 3
  fi

  AUTHOR="$(git log -1 --format='%an <%ae>' "$SHA")"
  MESSAGE="$(git log -1 --format='%B' "$SHA")"
  DIFF_PATH="$CURRENT_DIR/diff.patch"
  PROMPT_PATH="$CURRENT_DIR/prompt.txt"
  DONE_PATH="$CURRENT_DIR/DONE"

  git show --no-color --binary "$SHA" > "$DIFF_PATH"

  python3 - "$PROMPT_TPL" "$PROMPT_PATH" \
    "$SHA" "$SUBJECT" "$AUTHOR" "$MESSAGE" "$DIFF_PATH" "$DONE_PATH" <<'PY'
import sys, pathlib
tpl, out, sha, subj, author, msg, diff_path, done_path = sys.argv[1:9]
text = pathlib.Path(tpl).read_text()
text = (text
    .replace("{{SHA}}", sha)
    .replace("{{SUBJECT}}", subj)
    .replace("{{AUTHOR}}", author)
    .replace("{{MESSAGE}}", msg)
    .replace("{{DIFF_PATH}}", diff_path)
    .replace("{{DONE_PATH}}", done_path))
pathlib.Path(out).write_text(text)
PY

  echo "$SHA" > "$LAST_SHA_FILE"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[ralph] DRY RUN — prompt at $PROMPT_PATH"
    continue
  fi

  rm -f "$DONE_PATH"
  STATUS="failed"
  NOTE=""

  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    echo "[ralph] attempt $attempt/$MAX_ATTEMPTS"
    if ! kiro-cli chat --no-interactive --trust-all-tools "$(cat "$PROMPT_PATH")"; then
      echo "[ralph] kiro-cli non-zero exit (attempt $attempt)"
    fi

    if [[ ! -f "$DONE_PATH" ]]; then
      echo "[ralph] no DONE marker — retry"
      continue
    fi

    if head -1 "$DONE_PATH" | grep -q '^SKIP:'; then
      STATUS="skipped"
      NOTE="$(head -1 "$DONE_PATH")"
      break
    fi

    if head -1 "$DONE_PATH" | grep -q '^PORTED'; then
      # Coverage validation: every non-protected file upstream touched must
      # appear in the local HEAD commit (klaudex may rename/rewrite content
      # but must still touch the same files, modulo protected paths).
      VALIDATION_NOTE="$(python3 "$REPO_ROOT/scripts/ralph-validate-coverage.py" \
        --sha "$SHA" \
        --diff "$DIFF_PATH" 2>&1)" || VALIDATION_FAIL=1
      if [[ "${VALIDATION_FAIL:-0}" -eq 1 ]]; then
        echo "[ralph] validation failed: $VALIDATION_NOTE"
        echo "[ralph] reverting commit + retrying"
        git reset --soft HEAD~1 >/dev/null 2>&1 || true
        git reset HEAD -- . >/dev/null 2>&1 || true
        git checkout -- . >/dev/null 2>&1 || true
        git clean -fd >/dev/null 2>&1 || true
        rm -f "$DONE_PATH"
        VALIDATION_FAIL=0
        continue
      fi
      STATUS="ported"
      NOTE="$(head -1 "$DONE_PATH") | validated"
      break
    fi

    echo "[ralph] unrecognised DONE format — retry"
    rm -f "$DONE_PATH"
  done

  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$SHA" "$STATUS" "$NOTE" >> "$LOG_FILE"

  case "$STATUS" in
    ported)  echo "[ralph] ✓ ported $SHA" ;;
    skipped) echo "[ralph] ⊘ $NOTE" ;;
    failed)
      echo "[ralph] ✗ failed $SHA after $MAX_ATTEMPTS — stop. Inspect, fix, rerun with --resume <next-sha>."
      exit 2 ;;
  esac
done < "$COMMITS_FILE"

echo ""
echo "[ralph] done. processed log: $LOG_FILE"
