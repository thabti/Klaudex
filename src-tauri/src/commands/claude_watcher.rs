//! Filesystem watcher for Claude Code config directories.
//!
//! Watches both:
//!   - `~/.claude/` (global) — set up once at app start via [`watch_global_claude`]
//!   - `<workspace>/.claude/` (project) — registered/unregistered per project via
//!     the [`watch_claude_path`] / [`unwatch_claude_path`] Tauri commands.
//!
//! Emits `claude-config-changed` events to the frontend with a payload of the
//! form `{ scope: "global" | "project", path: string }` (camelCase).
//!
//! Project-vs-global precedence is handled in `claude_config.rs`; this module
//! just forwards raw debounced events with the correct `scope` derived from the
//! changed path.

use crate::commands::error::AppError;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

type Debouncer = notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>;

/// Debounce window per path. Tuned to coalesce editor save bursts (Vim/VSCode
/// often touch a file 2-3 times in <100ms) without adding perceptible UI lag.
const DEBOUNCE_MS: u64 = 300;

/// Maximum number of concurrent project watchers to prevent leaks.
const MAX_PROJECT_WATCHERS: usize = 5;

/// Subdirectories inside `.claude/` that contain config we care about.
/// Watched non-recursively to avoid tracking `node_modules` inside skills, etc.
const WATCHED_SUBDIRS: &[&str] = &["agents", "skills", "steering", "settings", "commands"];

/// Scope of a `claude-config-changed` event.
#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum Scope {
    Global,
    Project,
}

/// Payload emitted to the frontend when `.claude/` files change.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeConfigChanged {
    scope: Scope,
    /// The changed path (file or directory) reported by `notify`.
    path: String,
}

/// Holds active file watchers keyed by the `.claude/` directory path.
/// Each entry owns one debouncer that watches multiple subdirs.
pub struct ClaudeWatcherState {
    watchers: Mutex<HashMap<PathBuf, Debouncer>>,
}

impl Default for ClaudeWatcherState {
    fn default() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

impl Drop for ClaudeWatcherState {
    fn drop(&mut self) {
        // Explicitly drain so each Debouncer's Drop runs deterministically and
        // its background thread is signaled to stop before the process tears
        // down the rest of Tauri state.
        let mut watchers = self.watchers.lock();
        let count = watchers.len();
        watchers.clear();
        if count > 0 {
            log::info!("ClaudeWatcherState drop: stopped {} watcher(s)", count);
        }
    }
}

/// Returns true if `path` should be ignored by the watcher.
///
/// Denylist:
///   - any segment named `cache` (e.g. `~/.claude/cache/...`)
///   - filenames ending in `.lock`
///   - filenames containing `.tmp.` (editor swap files like `foo.tmp.123`)
fn is_denylisted(path: &Path) -> bool {
    // Segment-based: skip anything under a `cache` directory.
    if path
        .components()
        .any(|c| c.as_os_str().eq_ignore_ascii_case("cache"))
    {
        return true;
    }
    // Filename patterns.
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.ends_with(".lock") {
            return true;
        }
        if name.contains(".tmp.") {
            return true;
        }
    }
    false
}

/// Resolve the global `~/.claude/` directory, if a home directory exists.
fn global_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// Start watching the global `~/.claude` directory. Called once at app setup.
pub fn watch_global_claude(app: &AppHandle) {
    let Some(global) = global_claude_dir() else {
        return;
    };
    if !global.is_dir() {
        return;
    }
    let Some(state) = app.try_state::<ClaudeWatcherState>() else {
        log::warn!("ClaudeWatcherState not managed; skipping global watcher");
        return;
    };
    start_watcher(&state, &global, Scope::Global, app.clone());
}

/// Start watching a project's `.claude/` directory.
///
/// `path` is the workspace root; the watcher resolves `<path>/.claude/`.
#[tauri::command]
pub fn watch_claude_path(app: AppHandle, path: String) -> Result<(), AppError> {
    let claude_dir = PathBuf::from(&path).join(".claude");
    if !claude_dir.is_dir() {
        // Not an error — the project may simply not have any Claude config yet.
        return Ok(());
    }
    let state = app
        .try_state::<ClaudeWatcherState>()
        .ok_or_else(|| AppError::Other("ClaudeWatcherState not managed".to_string()))?;

    // Enforce max project watchers (global watcher doesn't count toward limit).
    {
        let watchers = state.watchers.lock();
        let global = global_claude_dir();
        let project_count = watchers
            .keys()
            .filter(|k| global.as_ref().map_or(true, |g| *k != g))
            .count();
        if project_count >= MAX_PROJECT_WATCHERS {
            log::warn!(
                "Max project watchers ({}) reached, skipping {}",
                MAX_PROJECT_WATCHERS,
                claude_dir.display()
            );
            return Ok(());
        }
    }

    start_watcher(&state, &claude_dir, Scope::Project, app.clone());
    Ok(())
}

/// Stop watching a project's `.claude/` directory.
#[tauri::command]
pub fn unwatch_claude_path(
    state: State<'_, ClaudeWatcherState>,
    path: String,
) -> Result<(), AppError> {
    let claude_dir = PathBuf::from(&path).join(".claude");
    let mut watchers = state.watchers.lock();
    if watchers.remove(&claude_dir).is_some() {
        log::info!("Stopped watching {}", claude_dir.display());
    }
    Ok(())
}

/// Stop all watchers. Called during app shutdown.
pub fn stop_all(app: &AppHandle) {
    if let Some(state) = app.try_state::<ClaudeWatcherState>() {
        let mut watchers = state.watchers.lock();
        let count = watchers.len();
        watchers.clear();
        if count > 0 {
            log::info!("Stopped {} claude watcher(s)", count);
        }
    }
}

fn start_watcher(
    state: &ClaudeWatcherState,
    claude_dir: &Path,
    scope: Scope,
    app: AppHandle,
) {
    let mut watchers = state.watchers.lock();
    if watchers.contains_key(claude_dir) {
        return;
    }
    let app_handle = app.clone();
    let scope_arc = Arc::new(scope);

    let debouncer = new_debouncer(
        Duration::from_millis(DEBOUNCE_MS),
        move |result: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            let Ok(events) = result else { return };
            for event in events {
                if event.kind != DebouncedEventKind::Any {
                    continue;
                }
                if is_denylisted(&event.path) {
                    log::trace!("denylisted: {}", event.path.display());
                    continue;
                }
                let payload = ClaudeConfigChanged {
                    scope: *scope_arc,
                    path: event.path.to_string_lossy().into_owned(),
                };
                log::debug!(
                    "Claude config changed (scope={:?}): {}",
                    payload.scope_str(),
                    payload.path
                );
                let _ = app_handle.emit("claude-config-changed", payload);
            }
        },
    );

    match debouncer {
        Ok(mut watcher) => {
            use notify::Watcher;
            let mut watched = 0;
            // Watch `.claude/` itself non-recursively for root-level files
            // (CLAUDE.md, settings.json, etc.).
            if watcher
                .watcher()
                .watch(claude_dir, notify::RecursiveMode::NonRecursive)
                .is_ok()
            {
                watched += 1;
            }
            for subdir in WATCHED_SUBDIRS {
                let path = claude_dir.join(subdir);
                if path.is_dir()
                    && watcher
                        .watcher()
                        .watch(&path, notify::RecursiveMode::NonRecursive)
                        .is_ok()
                {
                    watched += 1;
                }
            }
            if watched == 0 {
                log::warn!("No watchable subdirs in {}", claude_dir.display());
                return;
            }
            log::info!(
                "Watching {} ({} paths, scope={:?})",
                claude_dir.display(),
                watched,
                scope_str(scope)
            );
            watchers.insert(claude_dir.to_path_buf(), watcher);
        }
        Err(e) => {
            log::error!("Failed to create watcher for {}: {}", claude_dir.display(), e);
        }
    }
}

fn scope_str(scope: Scope) -> &'static str {
    match scope {
        Scope::Global => "global",
        Scope::Project => "project",
    }
}

impl ClaudeConfigChanged {
    fn scope_str(&self) -> &'static str {
        scope_str(self.scope)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denylist_cache_directory() {
        assert!(is_denylisted(Path::new(
            "/Users/me/.claude/cache/index.json"
        )));
        assert!(is_denylisted(Path::new("/proj/.claude/agents/cache/x.md")));
    }

    #[test]
    fn denylist_lock_files() {
        assert!(is_denylisted(Path::new("/proj/.claude/settings.json.lock")));
        assert!(is_denylisted(Path::new("/proj/.claude/agents/foo.lock")));
    }

    #[test]
    fn denylist_tmp_files() {
        assert!(is_denylisted(Path::new("/proj/.claude/agents/foo.tmp.123")));
        assert!(is_denylisted(Path::new(
            "/proj/.claude/skills/bar.tmp.swp"
        )));
    }

    #[test]
    fn allows_normal_paths() {
        assert!(!is_denylisted(Path::new("/Users/me/.claude/agents/foo.md")));
        assert!(!is_denylisted(Path::new("/proj/.claude/skills/bar/SKILL.md")));
        assert!(!is_denylisted(Path::new("/proj/.claude/CLAUDE.md")));
        assert!(!is_denylisted(Path::new(
            "/proj/.claude/settings/mcp.json"
        )));
    }

    #[test]
    fn cache_match_is_case_insensitive() {
        assert!(is_denylisted(Path::new("/proj/.claude/Cache/x")));
        assert!(is_denylisted(Path::new("/proj/.claude/CACHE/x")));
    }

    #[test]
    fn scope_serializes_lowercase() {
        let payload = ClaudeConfigChanged {
            scope: Scope::Global,
            path: "/x".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"scope\":\"global\""));
        let payload = ClaudeConfigChanged {
            scope: Scope::Project,
            path: "/x".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"scope\":\"project\""));
    }
}
