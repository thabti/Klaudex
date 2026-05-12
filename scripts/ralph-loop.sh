#!/usr/bin/env bash
# ralph-loop.sh — feature-parity ralph loop using kiro-cli
#
# Walks commits in SOURCE_REPO oldest→newest, and for each unprocessed commit
# spawns kiro-cli in TARGET_REPO with a prompt describing the commit's intent
# and diff. kiro-cli re-implements the change in the target's stack. Loop
# repeats until commit's DONE marker appears and validation passes, or
# MAX_ATTEMPTS is hit.
#
# Usage:
#   ralph-loop.sh <source-repo> <target-repo> [--from <sha>] [--from-tag <tag>]
#                 [--branch <name>] [--max-attempts N] [--validate "<cmd>"]
#                 [--dry-run]
#
# State lives in <target-repo>/.ralph/:
#   last_sha       — last fully-processed source SHA
#   processed.log  — append-only log of {sha, attempts, status, ts}
#   prompt.md      — prompt template (auto-created on first run; edit freely)
#   current/       — per-iteration scratch (diff.patch, prompt.txt, DONE marker)

set -euo pipefail

# -------- args --------
SOURCE_REPO=""
TARGET_REPO=""
FROM_SHA=""
FROM_TAG=""
BRANCH="main"
MAX_ATTEMPTS=5
VALIDATE_CMD=""
DRY_RUN=0

usage() {
  sed -n '2,20p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)         FROM_SHA="$2"; shift 2 ;;
    --from-tag)     FROM_TAG="$2"; shift 2 ;;
    --branch)       BRANCH="$2"; shift 2 ;;
    --max-attempts) MAX_ATTEMPTS="$2"; shift 2 ;;
    --validate)     VALIDATE_CMD="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      usage ;;
    *)
      if [[ -z "$SOURCE_REPO" ]]; then SOURCE_REPO="$1"
      elif [[ -z "$TARGET_REPO" ]]; then TARGET_REPO="$1"
      else echo "unknown arg: $1" >&2; usage; fi
      shift ;;
  esac
done

[[ -z "$SOURCE_REPO" || -z "$TARGET_REPO" ]] && usage
[[ -d "$SOURCE_REPO/.git" ]] || { echo "source not a git repo: $SOURCE_REPO" >&2; exit 1; }
[[ -d "$TARGET_REPO/.git" ]] || { echo "target not a git repo: $TARGET_REPO" >&2; exit 1; }
command -v kiro-cli >/dev/null || { echo "kiro-cli not found in PATH" >&2; exit 1; }

SOURCE_REPO="$(cd "$SOURCE_REPO" && pwd)"
TARGET_REPO="$(cd "$TARGET_REPO" && pwd)"
RALPH_DIR="$TARGET_REPO/.ralph"
PROMPT_FILE="$RALPH_DIR/prompt.md"
LAST_SHA_FILE="$RALPH_DIR/last_sha"
LOG_FILE="$RALPH_DIR/processed.log"
CURRENT_DIR="$RALPH_DIR/current"

mkdir -p "$RALPH_DIR" "$CURRENT_DIR"

# -------- prompt template --------
if [[ ! -f "$PROMPT_FILE" ]]; then
  cat > "$PROMPT_FILE" <<'EOF'
You are porting one upstream commit into THIS repository.

GOAL: Re-implement the upstream change in the target codebase. Match the
INTENT and FEATURES, not necessarily the file layout, language, or stack.
The target repo may use a different framework — adapt accordingly.

UPSTREAM COMMIT
SHA:     {{SHA}}
SUBJECT: {{SUBJECT}}
AUTHOR:  {{AUTHOR}}

UPSTREAM MESSAGE
{{MESSAGE}}

UPSTREAM DIFF
See {{DIFF_PATH}}

INSTRUCTIONS
1. Read the upstream diff and message to understand intent.
2. Explore THIS repo to find equivalent modules/components.
3. Apply the equivalent change here. Reuse existing patterns and idioms.
4. Run the project's own type-check and tests if available. Fix what breaks.
5. When done, write the file: {{DONE_PATH}}
   Contents: one paragraph describing what you changed, then a list of
   modified files.
6. If the commit does not apply (already done, irrelevant, infra-only),
   write {{DONE_PATH}} with the body: SKIP: <reason>

DO NOT commit. The orchestrator handles commits.
DO NOT modify .ralph/.
EOF
  echo "[ralph] wrote prompt template: $PROMPT_FILE"
fi

# -------- pick source SHAs --------
cd "$SOURCE_REPO"
git fetch --quiet origin "$BRANCH" 2>/dev/null || true
git fetch --quiet origin --tags 2>/dev/null || true

# resolve --from-tag to a SHA (takes precedence over --from if both given)
if [[ -n "$FROM_TAG" ]]; then
  FROM_SHA="$(git rev-list -1 "$FROM_TAG" 2>/dev/null)" \
    || { echo "tag not found in source repo: $FROM_TAG" >&2; exit 1; }
  echo "[ralph] resolved tag '$FROM_TAG' → $FROM_SHA"
fi

if [[ -z "$FROM_SHA" && -f "$LAST_SHA_FILE" ]]; then
  FROM_SHA="$(cat "$LAST_SHA_FILE")"
fi

if [[ -n "$FROM_SHA" ]]; then
  RANGE="${FROM_SHA}..${BRANCH}"
else
  RANGE="$BRANCH"
fi

mapfile -t SHAS < <(git rev-list --reverse --no-merges "$RANGE")

if [[ ${#SHAS[@]} -eq 0 ]]; then
  echo "[ralph] nothing to do. target already at $(cat "$LAST_SHA_FILE" 2>/dev/null || echo HEAD)"
  exit 0
fi

echo "[ralph] ${#SHAS[@]} commit(s) to process from $SOURCE_REPO → $TARGET_REPO"

# -------- loop --------
for SHA in "${SHAS[@]}"; do
  cd "$SOURCE_REPO"
  SUBJECT="$(git log -1 --format='%s' "$SHA")"
  AUTHOR="$(git log -1 --format='%an <%ae>' "$SHA")"
  MESSAGE="$(git log -1 --format='%B' "$SHA")"
  DIFF_PATH="$CURRENT_DIR/diff.patch"
  PROMPT_PATH="$CURRENT_DIR/prompt.txt"
  DONE_PATH="$CURRENT_DIR/DONE"

  git show --no-color --binary "$SHA" > "$DIFF_PATH"

  # render prompt
  sed -e "s|{{SHA}}|$SHA|g" \
      -e "s|{{SUBJECT}}|${SUBJECT//|/\\|}|g" \
      -e "s|{{AUTHOR}}|${AUTHOR//|/\\|}|g" \
      -e "s|{{DIFF_PATH}}|$DIFF_PATH|g" \
      -e "s|{{DONE_PATH}}|$DONE_PATH|g" \
      "$PROMPT_FILE" > "$PROMPT_PATH.tmp"

  # message body is multiline — write to file and use perl for safe substitution
  printf '%s' "$MESSAGE" > "$CURRENT_DIR/message.txt"
  MSG_FILE="$CURRENT_DIR/message.txt" perl -0777 -pe '
    BEGIN { local $/; open F, $ENV{MSG_FILE}; $m = <F>; close F }
    s/\{\{MESSAGE\}\}/$m/g
  ' "$PROMPT_PATH.tmp" > "$PROMPT_PATH"
  rm -f "$PROMPT_PATH.tmp"

  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "[ralph] $SHA  $SUBJECT"
  echo "════════════════════════════════════════════════════════════════"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[ralph] DRY RUN — prompt at $PROMPT_PATH"
    continue
  fi

  # -------- attempt loop --------
  cd "$TARGET_REPO"
  rm -f "$DONE_PATH"
  STATUS="failed"

  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    echo "[ralph] attempt $attempt/$MAX_ATTEMPTS"

    if ! kiro-cli chat \
        --no-interactive \
        --trust-all-tools \
        "$(cat "$PROMPT_PATH")"; then
      echo "[ralph] kiro-cli exited non-zero (attempt $attempt)"
      continue
    fi

    if [[ ! -f "$DONE_PATH" ]]; then
      echo "[ralph] no DONE marker (attempt $attempt) — retrying"
      continue
    fi

    if grep -q '^SKIP:' "$DONE_PATH"; then
      echo "[ralph] commit SKIPPED: $(head -1 "$DONE_PATH")"
      STATUS="skipped"
      break
    fi

    if [[ -n "$VALIDATE_CMD" ]]; then
      echo "[ralph] validating: $VALIDATE_CMD"
      if ! bash -c "$VALIDATE_CMD"; then
        echo "[ralph] validation failed (attempt $attempt) — retrying"
        rm -f "$DONE_PATH"
        continue
      fi
    fi

    STATUS="done"
    break
  done

  if [[ "$STATUS" == "failed" ]]; then
    echo "[ralph] giving up on $SHA after $MAX_ATTEMPTS attempts"
    printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$SHA" "$MAX_ATTEMPTS" "failed" >> "$LOG_FILE"
    exit 2
  fi

  printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$SHA" "$attempt" "$STATUS" >> "$LOG_FILE"
  echo "$SHA" > "$LAST_SHA_FILE"
  echo "[ralph] ✓ $SHA — $STATUS"
done

echo ""
echo "[ralph] all commits processed. last: $(cat "$LAST_SHA_FILE")"
