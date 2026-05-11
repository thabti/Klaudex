//! Real-time VCS status broadcasting.
//!
//! Provides a `git_vcs_status` command that returns the current git status
//! for a workspace (branch, ahead/behind counts, dirty state). The frontend
//! polls this on file-change events from the project watcher to keep the
//! sidebar indicators up to date.

use git2::Repository;
use serde::Serialize;
use std::process::Command;

use super::error::AppError;

/// VCS status payload returned to the renderer.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VcsStatus {
    /// Current branch name (or "HEAD" if detached).
    pub branch: String,
    /// Number of commits ahead of upstream.
    pub ahead_count: u32,
    /// Number of commits behind upstream.
    pub behind_count: u32,
    /// Whether there are uncommitted changes (staged or unstaged).
    pub is_dirty: bool,
    /// Number of modified/added/deleted files.
    pub changed_file_count: u32,
    /// Whether the branch has an upstream configured.
    pub has_upstream: bool,
}

/// Tauri command — get the current VCS status for a workspace.
#[tauri::command]
pub fn git_vcs_status(cwd: String) -> Result<VcsStatus, AppError> {
    let repo = Repository::discover(&cwd)?;

    // Get current branch — distinguish between a real branch and detached HEAD
    let branch = match repo.head() {
        Ok(head) => {
            if head.is_branch() {
                head.shorthand().unwrap_or("HEAD").to_string()
            } else {
                // Truly detached HEAD — return empty string so frontend shows "(detached HEAD)"
                String::new()
            }
        }
        Err(_) => String::new(), // Unborn branch or other error
    };

    // Get ahead/behind counts using git CLI (handles remote tracking correctly)
    let (ahead_count, behind_count, has_upstream) = get_ahead_behind(&cwd, &branch);

    // Get dirty state
    let statuses = repo.statuses(Some(
        git2::StatusOptions::new()
            .include_untracked(true)
            .recurse_untracked_dirs(false),
    ))?;

    let changed_file_count = statuses.len() as u32;
    let is_dirty = changed_file_count > 0;

    Ok(VcsStatus {
        branch,
        ahead_count,
        behind_count,
        is_dirty,
        changed_file_count,
        has_upstream,
    })
}

/// Get ahead/behind counts using `git rev-list --left-right --count`.
/// Returns (ahead, behind, has_upstream).
fn get_ahead_behind(cwd: &str, branch: &str) -> (u32, u32, bool) {
    let range = format!("{branch}...@{{u}}");
    let output = Command::new("git")
        .args(["rev-list", "--left-right", "--count", &range])
        .current_dir(cwd)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = text.trim().split('\t').collect();
            if parts.len() == 2 {
                let ahead = parts[0].parse::<u32>().unwrap_or(0);
                let behind = parts[1].parse::<u32>().unwrap_or(0);
                (ahead, behind, true)
            } else {
                (0, 0, true)
            }
        }
        _ => (0, 0, false), // No upstream or error
    }
}

// ── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vcs_status_works_on_real_repo() {
        // This test runs against the klaudex repo itself
        let cwd = env!("CARGO_MANIFEST_DIR").to_string();
        let result = git_vcs_status(cwd);
        // Should succeed on any git repo
        assert!(result.is_ok(), "git_vcs_status failed: {:?}", result.err());
        let status = result.unwrap();
        assert!(!status.branch.is_empty(), "branch should not be empty");
    }

    #[test]
    fn vcs_status_errors_on_non_repo() {
        let result = git_vcs_status("/tmp".to_string());
        assert!(result.is_err());
    }
}
