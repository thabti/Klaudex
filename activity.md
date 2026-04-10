## 2026-04-11 03:54 GST (Dubai)
### Build: Fix Windows CI failure — missing icon.ico
The `icon.ico` file existed locally but was never committed to git. Tauri requires it for Windows resource file generation. Staged the file for commit.
**Modified:** src-tauri/icons/icon.ico (staged)

## 2026-04-11 03:33 GST (Dubai)
### README: Update intro and platform scope
Updated the README intro to say "native desktop client" instead of "native macOS desktop client", merged the OpenAI Codex and T3 Code acknowledgements into the intro line with GitHub repo links, and updated the platform badge to include Windows and Linux.
**Modified:** README.md

# Activity Log

## 2026-04-11

- **03:21 GST** — Created `docs/pr-guidelines.md` with PR title/description conventions and conditions.
- **03:21 GST** — Expanded PR description content guidance with per-section writing rules.

## 2026-04-11 03:42 GST (Dubai)
### Investigation: Git concurrency across agent threads
Audited `git.rs` and `acp.rs` to answer how Kirodex handles concurrent Git access from multiple agent threads. Findings: Kirodex does neither workspace isolation nor Git operation serialization. Each task shares the same workspace directory, and every Git command opens a fresh `Repository::open()` with no Mutex or RwLock guarding the repository or working tree. The README lists "Git worktree" as a planned feature to address this gap.
**Files reviewed:** `src-tauri/src/commands/git.rs`, `src-tauri/src/commands/acp.rs`

## 2026-04-11 03:42 GST (Dubai)
### CI/CD: Cross-platform release workflow and version bump script
- Created `.github/workflows/release.yml` with matrix builds for macOS (aarch64 + x86_64), Ubuntu 22.04, and Windows. Triggers on `v*` tags or manual dispatch. Uses `tauri-apps/tauri-action@v0` to build artifacts and create draft GitHub releases.
- Synced versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to `0.7.0` (were out of sync: package.json had 0.7.0, others had 0.6.0).
- Updated `tauri.conf.json` bundle targets from `["dmg", "app"]` to `"all"` and added `icon.ico` for Windows builds.
- Generated `src-tauri/icons/icon.ico` from existing `icon.png` using ImageMagick.
- Created `scripts/bump-version.sh` to update all three version sources in one command with semver validation.
**Modified:** `.github/workflows/release.yml`, `scripts/bump-version.sh`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/icons/icon.ico`
