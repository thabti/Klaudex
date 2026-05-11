Kirodex was the original project, and we dividged, there some key difference in the project, however the idea to make these two project feature and design parity, while maintaining one uses kiro-cli acp and the other use claude code (claude) acp. 
don't rename the project don't use kiro features. 

You are porting ONE upstream commit from `kirodex` into THIS repo (`klaudex`).

UPSTREAM REMOTE: `upstream` (= https://github.com/thabti/kirodex.git)
UPSTREAM COMMIT
SHA:     {{SHA}}
SUBJECT: {{SUBJECT}}
AUTHOR:  {{AUTHOR}}

UPSTREAM MESSAGE
{{MESSAGE}}

UPSTREAM DIFF
See {{DIFF_PATH}}

GOAL
Cherry-pick this commit into klaudex. Do NOT touch klaudex branding or
release/infra files. If the change is brand/release only, SKIP.

PROTECTED PATHS — never modify these (revert to HEAD if cherry-pick touches them)
- README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md
- SECURITY_AUDIT.md, SKILLS_SECURITY_AUDIT.md, CHANGELOG.md
- package.json fields: name, version, bin, productName (other fields like deps OK to change)
- src-tauri/tauri.conf.json fields: identifier, productName, version (other fields OK)
- src-tauri/Cargo.toml package.name and package.version
- .github/** (klaudex CI, do not overwrite)
- scripts/release.sh, scripts/bump-version.sh, scripts/generate-notes.sh
- downloads.json, agents-lock.json
- website/**
- index.html title/branding lines (functional changes OK)
- activity.md (klaudex's log, do not overwrite — append your own entry at end)

NAME REWRITE — anywhere the cherry-picked content introduces these literals
in non-protected files, rewrite before staging:
- `kirodex` → `klaudex`
- `Kirodex` → `Klaudex`
- `KIRODEX` → `KLAUDEX`
- `rs.kirodex` → `rs.klaudex`
- Bundle ids / app ids referencing kirodex → klaudex equivalent
Do NOT rewrite mentions inside upstream commit messages or the upstream diff
file itself; only rewrite in files you stage.

PROCEDURE
1. Run `git status` — must be clean. If dirty, write SKIP to {{DONE_PATH}}: "SKIP: worktree dirty".
2. Inspect {{DIFF_PATH}} and the upstream message.
3. Decide SKIP if:
   - Commit only touches protected paths (release bump, downloads.json, README, etc.)
   - Commit is a kirodex-specific branding change
   - Commit subject matches `chore(analytics): update downloads.json`
   - Commit subject matches `chore: release v*`
   - Change already present in klaudex (verify by reading target files)
   In that case write {{DONE_PATH}} with body: `SKIP: <one-line reason>` and STOP.
4. Otherwise: `git cherry-pick -n --strategy=recursive -X theirs {{SHA}}`
   - `-n` = no auto-commit; you stage and commit manually
   - If cherry-pick reports CONFLICT, resolve by reading the conflict markers,
     understanding the upstream intent, and editing the files to match the
     intent in klaudex's idiom. After resolving every conflict run
     `git add <resolved-files>`.
5. For every file in the staging area:
   - If path is protected → `git checkout HEAD -- <path>` to revert it
   - Else apply NAME REWRITE rules in-place, then `git add <path>`
6. Run validation:
   - `bun run check:ts`
   - Fix any new TS errors caused by the port (do not "fix" unrelated pre-existing errors)
7. Prepend a port entry to activity.md (per CLAUDE.md convention) at the TOP
   of the file. Then `git add activity.md` so it lands in the same commit.
   The orchestrator REQUIRES the worktree to be clean after your commit —
   if you leave activity.md unstaged the next iteration will refuse to start.
8. Commit with the ORIGINAL upstream subject + body, plus trailers:
   ```
   git commit -m "<original subject>" \
              -m "<original body>" \
              -m "Co-authored-by: Klaudex <274876363+klaudex@users.noreply.github.com>" \
              -m "Cherry-picked-from: kirodex@{{SHA}}"
   ```
   Use a heredoc to preserve the original message faithfully. Do NOT add
   AI-generated commentary to the commit message.
9. Run `git status` — it MUST report "nothing to commit, working tree clean".
   If anything is unstaged, `git add` it and `git commit --amend --no-edit`.
10. Write {{DONE_PATH}} with body:
   ```
   PORTED <new local sha>
   <one-paragraph summary>
   Modified:
   - path/one
   - path/two
   ```

HARD RULES
- Never `git push`, never `git reset --hard`, never `git checkout --` a tracked
  file outside the cherry-pick scope.
- If you cannot resolve a conflict sensibly, run `git cherry-pick --abort` and
  write {{DONE_PATH}} with body: `SKIP: unresolvable conflict — <reason>`.
- Do NOT modify .ralph/.
- One commit per run. Stop after writing {{DONE_PATH}}.
