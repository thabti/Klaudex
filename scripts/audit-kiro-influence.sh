#!/usr/bin/env bash
# audit-kiro-influence.sh — flag any kiro-cli / kirodex remnants left by the
# cherry-pick ports. Klaudex uses Claude Code, not kiro-cli, so any of the
# below in production code is suspect.
#
# Usage:
#   scripts/audit-kiro-influence.sh           # report
#   scripts/audit-kiro-influence.sh --fail    # exit non-zero on findings

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0
[[ "${1:-}" == "--fail" ]] && FAIL=1

PATTERNS=(
  'kirodex'
  'Kirodex'
  'KIRODEX'
  'rs\.kirodex'
  'kiro[_-]cli'
  'kiroBin'
  'kiroStore'
  'kiro_config'
  'kiro_watcher'
  'detect_kiro_cli'
  'kiro_whoami'
)

EXCLUDES=(
  ':!/.ralph/**'
  ':!scripts/ralph-*'
  ':!scripts/audit-kiro-influence.sh'
  ':!*.md'
  ':!*.lock'
  ':!agents-lock.json'
  ':!website/**'
  ':!screenshots/**'
  ':!src-tauri/icons/**'
)

TOTAL=0
for pat in "${PATTERNS[@]}"; do
  echo "═══ /$pat/ ═══"
  HITS=$(git grep -nE "$pat" -- "${EXCLUDES[@]}" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    echo "$HITS"
    COUNT=$(echo "$HITS" | wc -l | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))
  fi
  echo ""
done

echo "════════════════════════════════════════════════════════════════"
echo "[audit] total hits: $TOTAL"
echo "════════════════════════════════════════════════════════════════"

if [[ "$TOTAL" -gt 0 && "$FAIL" -eq 1 ]]; then
  exit 1
fi
exit 0
