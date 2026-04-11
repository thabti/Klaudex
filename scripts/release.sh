#!/usr/bin/env bash
set -euo pipefail

# Usage: bun run release              → bump patch, commit, tag, push
#        bun run release -- minor     → bump minor
#        bun run release -- major     → bump major
#        bun run release -- 1.2.3     → set exact version

BUMP="${1:-patch}"

# 1. Bump version
bash "$(dirname "$0")/bump-version.sh" "$BUMP"

# 2. Get the new version
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
TAG="v$VERSION"

# 3. Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ Tag $TAG already exists. Bump to a new version first."
  exit 1
fi

# 4. Commit
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: release $TAG"

# 5. Tag
git tag "$TAG"

# 6. Push commit + tag (triggers release workflow)
git push origin main --tags

echo ""
echo "🚀 Released $TAG"
echo "   GitHub Actions will now build, sign, and publish the release."
echo "   Watch: gh run watch"
