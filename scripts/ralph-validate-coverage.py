#!/usr/bin/env python3
"""Validate that the latest klaudex commit covers the upstream commit's files.

Exits 0 if coverage is OK (or commit was a legitimate SKIP delegated to the
caller — this script is only invoked for PORTED outcomes). Exits non-zero
with a single-line reason on stdout if coverage looks wrong.

Coverage rules:
  - Build the set of files touched by the upstream diff.
  - Drop protected paths (branding/release/CI) — those are intentionally
    not ported.
  - Drop pure-rename "side B" entries that are just kiro-cli→klaudex naming
    aliases of paths already counted.
  - For each remaining upstream file, verify the latest local commit
    touched the file OR a rename-equivalent path. If anything is missing,
    the port is incomplete: fail.

A file is considered "rename-equivalent" if upstream path contains
'kirodex' and local touches the same path with 'klaudex' substituted, or
vice versa.
"""
from __future__ import annotations
import argparse, re, subprocess, sys, fnmatch

PROTECTED_GLOBS = [
    "README.md", "CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md",
    "SECURITY_AUDIT.md", "SKILLS_SECURITY_AUDIT.md", "CHANGELOG.md",
    ".github/**", ".github/*",
    "scripts/release.sh", "scripts/bump-version.sh", "scripts/generate-notes.sh",
    "downloads.json", "agents-lock.json",
    "website/**", "website/*",
    "activity.md",
    # screenshots / branding assets
    "screenshots/**", "screenshots/*",
    "src-tauri/icons/**", "src-tauri/icons/*",
    "public/**", "public/*",
    # lockfiles regen on demand; not a coverage signal
    "bun.lock", "package-lock.json", "src-tauri/Cargo.lock",
    # command registration glue — mod.rs of commands/ often differs across forks
    "src-tauri/src/commands/mod.rs",
]

def is_protected(path: str) -> bool:
    for g in PROTECTED_GLOBS:
        if fnmatch.fnmatch(path, g):
            return True
    return False

DIFF_FILE_RE = re.compile(r'^diff --git a/(.+?) b/(.+?)$')

def upstream_files(diff_path: str) -> set[str]:
    files: set[str] = set()
    with open(diff_path, encoding='utf-8', errors='replace') as f:
        for line in f:
            m = DIFF_FILE_RE.match(line.rstrip('\n'))
            if m:
                a, b = m.group(1), m.group(2)
                files.add(a)
                if a != b:
                    files.add(b)
    return files

def local_files(sha: str) -> set[str]:
    out = subprocess.check_output(
        ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", sha],
        text=True,
    )
    return {ln.strip() for ln in out.splitlines() if ln.strip()}

def rename_equivalents(path: str) -> set[str]:
    eq = {path}
    for s, d in (("kirodex", "klaudex"), ("klaudex", "kirodex"),
                 ("Kirodex", "Klaudex"), ("Klaudex", "Kirodex")):
        if s in path:
            eq.add(path.replace(s, d))
    return eq

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sha", required=True, help="upstream SHA being ported")
    ap.add_argument("--diff", required=True, help="path to upstream diff file")
    ap.add_argument("--local-sha", default="HEAD", help="local commit to check (default HEAD)")
    args = ap.parse_args()

    up = upstream_files(args.diff)
    if not up:
        print(f"upstream diff has no files (sha={args.sha[:10]})")
        return 1

    up_non_protected = {p for p in up if not is_protected(p)}
    if not up_non_protected:
        # everything upstream was protected — legitimate full-skip, but
        # caller already saw PORTED. accept.
        print(f"all upstream files protected — accept (sha={args.sha[:10]})")
        return 0

    loc = local_files(args.local_sha)
    if not loc:
        print(f"local commit {args.local_sha} touched no files")
        return 1

    missing: list[str] = []
    for u in up_non_protected:
        if any(eq in loc for eq in rename_equivalents(u)):
            continue
        missing.append(u)

    if missing:
        head = ",".join(missing[:5])
        more = f" (+{len(missing) - 5} more)" if len(missing) > 5 else ""
        print(f"missing local coverage for {len(missing)}/{len(up_non_protected)} files: {head}{more}")
        return 2

    return 0

if __name__ == "__main__":
    sys.exit(main())
