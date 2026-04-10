#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bump-version.sh <version>
# Example: ./scripts/bump-version.sh 0.8.0
#
# Updates version in:
#   - package.json
#   - src-tauri/Cargo.toml
#   - src-tauri/tauri.conf.json

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.8.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be semver (e.g. 0.8.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# package.json
sed -i.bak -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"
rm -f "$ROOT/package.json.bak"

# src-tauri/Cargo.toml (only the package version, not dependency versions)
sed -i.bak -E "0,/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/s//version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"
rm -f "$ROOT/src-tauri/Cargo.toml.bak"

# src-tauri/tauri.conf.json
sed -i.bak -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$VERSION\"/" "$ROOT/src-tauri/tauri.conf.json"
rm -f "$ROOT/src-tauri/tauri.conf.json.bak"

echo "Bumped to $VERSION in:"
echo "  - package.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
