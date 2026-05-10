use serde::{Deserialize, Serialize};
use parking_lot::Mutex;
use std::path::Path;

use super::error::AppError;

/// Maximum number of recent project entries persisted in `AppSettings`.
pub const MAX_RECENT_PROJECTS: usize = 10;

/// A single entry in the recent-projects list.
///
/// `last_opened` is a Unix timestamp in **milliseconds**, not seconds — chosen
/// to match the JavaScript `Date.now()` value the renderer sends in.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentProfile {
    pub id: String,
    pub name: String,
    pub agent_id: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_default: bool,
}

/// Permission decision mode for the ACP request_permission flow.
///
/// - `Ask` — show a permission dialog for every tool call (default).
/// - `AllowListed` — auto-approve when an allow pattern matches and no deny
///   pattern matches; otherwise fall back to `Ask`.
/// - `Bypass` — auto-approve every tool call. Replaces the legacy
///   `auto_approve: true` boolean.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PermissionMode {
    Ask,
    AllowListed,
    Bypass,
}

impl Default for PermissionMode {
    fn default() -> Self {
        Self::Ask
    }
}

/// Permission policy bundle consumed by the ACP client. Patterns are stored as
/// raw strings (e.g., `Bash(npm test:*)`); pattern matching lives in
/// `commands/permissions.rs` (TASK-102).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    #[serde(default)]
    pub mode: PermissionMode,
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub deny: Vec<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPrefs {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Legacy boolean retained for backward-compat. Superseded by
    /// [`ProjectPrefs::permissions`]; on first deserialize a `Some(true)`
    /// migrates to `permissions = Some({ mode: Bypass, .. })` and `Some(false)`
    /// to `permissions = Some({ mode: Ask, .. })`. Continues to serialize so
    /// older Klaudex builds reading the same on-disk file keep working.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_approve: Option<bool>,
    /// Per-project permission override. `None` means "fall back to the global
    /// `AppSettings.permissions`". `Some(_)` always wins over the global
    /// policy when the active workspace matches this project key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Permissions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symlink_directories: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tight_sandbox: Option<bool>,
}

// ---------------------------------------------------------------------------
// ProjectPrefs migration (TASK-101)
//
// We keep `Serialize` derived on the public type but route deserialization
// through a private shadow struct so we can run a one-time migration of the
// legacy `auto_approve: Option<bool>` into the new `permissions: Option<_>`
// shape. Migration rules:
//
//   auto_approve == Some(true)  AND permissions == None → permissions = Some({ mode: Bypass })
//   auto_approve == Some(false) AND permissions == None → permissions = Some({ mode: Ask })
//   auto_approve == None        AND permissions == None → leave None (fall back to global)
//
// If the on-disk file already has `permissions`, we never overwrite it.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectPrefsRaw {
    #[serde(default)]
    model_id: Option<String>,
    #[serde(default)]
    auto_approve: Option<bool>,
    #[serde(default)]
    permissions: Option<Permissions>,
    #[serde(default)]
    worktree_enabled: Option<bool>,
    #[serde(default)]
    symlink_directories: Option<Vec<String>>,
    #[serde(default)]
    tight_sandbox: Option<bool>,
}

impl From<ProjectPrefsRaw> for ProjectPrefs {
    fn from(raw: ProjectPrefsRaw) -> Self {
        let permissions = match (raw.permissions, raw.auto_approve) {
            (Some(p), _) => Some(p),
            (None, Some(true)) => Some(Permissions {
                mode: PermissionMode::Bypass,
                allow: Vec::new(),
                deny: Vec::new(),
            }),
            (None, Some(false)) => Some(Permissions {
                mode: PermissionMode::Ask,
                allow: Vec::new(),
                deny: Vec::new(),
            }),
            (None, None) => None,
        };
        Self {
            model_id: raw.model_id,
            auto_approve: raw.auto_approve,
            permissions,
            worktree_enabled: raw.worktree_enabled,
            symlink_directories: raw.symlink_directories,
            tight_sandbox: raw.tight_sandbox,
        }
    }
}

impl<'de> Deserialize<'de> for ProjectPrefs {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        ProjectPrefsRaw::deserialize(deserializer).map(Into::into)
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Path to the Claude CLI binary. Renamed from `kiroBin`; the old key is
    /// accepted on deserialization for backward compatibility.
    #[serde(default = "default_claude_bin", alias = "kiroBin")]
    pub claude_bin: String,
    #[serde(default)]
    pub agent_profiles: Vec<AgentProfile>,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    /// Legacy boolean retained for backward-compat. Superseded by
    /// [`AppSettings::permissions`]; on first deserialize `true` migrates to
    /// `permissions.mode = Bypass`. Continues to serialize so older Klaudex
    /// builds reading the same on-disk file keep working.
    #[serde(default)]
    pub auto_approve: bool,
    /// Permission policy that gates ACP `request_permission` calls. Defaults
    /// to `{ mode: Ask, allow: [], deny: [] }`. Per-project overrides live on
    /// [`ProjectPrefs::permissions`] and win when the active workspace
    /// matches.
    #[serde(default)]
    pub permissions: Permissions,
    #[serde(default = "default_true")]
    pub respect_gitignore: bool,
    #[serde(default = "default_true")]
    pub co_author: bool,
    #[serde(default)]
    pub co_author_json_report: bool,
    #[serde(default = "default_true")]
    pub notifications: bool,
    #[serde(default = "default_true")]
    pub sound_notifications: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_prefs: Option<std::collections::HashMap<String, ProjectPrefs>>,
    #[serde(default)]
    pub has_onboarded_v2: bool,
    /// Flag for anonymous product analytics. Defaults to true; the user
    /// can turn it off via Settings → Advanced.
    #[serde(default = "default_true")]
    pub analytics_enabled: bool,
    /// Random UUID created on first opt-in and cleared on opt-out. Used as the
    /// PostHog `distinct_id` — never tied to OS identity, email, or machine ID.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub analytics_anon_id: Option<String>,
    /// Theme mode: "dark", "light", or "system". Default: "dark" (Claude orange-on-dark).
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Most-recently-opened project workspaces, newest-first. Capped at
    /// [`MAX_RECENT_PROJECTS`]. Mutated via the `recent_projects_*` commands.
    #[serde(default)]
    pub recent_projects: Vec<RecentProject>,
    /// xterm scrollback ring-buffer size. Default 5000 lines (TASK-011).
    #[serde(default = "default_terminal_scrollback")]
    pub terminal_scrollback: u32,
    /// Minutes of idle time after which a PTY auto-closes. `0` = disabled.
    #[serde(default)]
    pub terminal_idle_close_mins: u32,
}

fn default_claude_bin() -> String {
    "claude".to_string()
}
fn default_font_size() -> u32 {
    13
}
fn default_theme() -> String {
    "dark".to_string()
}
fn default_true() -> bool {
    true
}
fn default_terminal_scrollback() -> u32 {
    5000
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            claude_bin: default_claude_bin(),
            agent_profiles: vec![],
            font_size: default_font_size(),
            default_model: None,
            auto_approve: false,
            permissions: Permissions::default(),
            respect_gitignore: true,
            co_author: true,
            co_author_json_report: true,
            notifications: true,
            sound_notifications: true,
            project_prefs: None,
            has_onboarded_v2: false,
            analytics_enabled: true,
            analytics_anon_id: None,
            theme: default_theme(),
            recent_projects: Vec::new(),
            terminal_scrollback: default_terminal_scrollback(),
            terminal_idle_close_mins: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// AppSettings migration (TASK-101)
//
// Mirrors the ProjectPrefs shadow-struct trick. Rule:
//
//   permissions absent (== default Ask) AND legacy auto_approve == true
//     → permissions.mode = Bypass
//
// We can't distinguish "default Ask" from "user explicitly set Ask" in the
// shadow struct — the field is a non-optional `Permissions` — so we make
// `permissions` an `Option<Permissions>` in the raw struct: `Some` means the
// on-disk file had a `permissions` block, `None` means it did not. That lets
// us run migration only when the new key is missing.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettingsRaw {
    #[serde(default = "default_claude_bin", alias = "kiroBin")]
    claude_bin: String,
    #[serde(default)]
    agent_profiles: Vec<AgentProfile>,
    #[serde(default = "default_font_size")]
    font_size: u32,
    #[serde(default)]
    default_model: Option<String>,
    #[serde(default)]
    auto_approve: bool,
    #[serde(default)]
    permissions: Option<Permissions>,
    #[serde(default = "default_true")]
    respect_gitignore: bool,
    #[serde(default = "default_true")]
    co_author: bool,
    #[serde(default)]
    co_author_json_report: bool,
    #[serde(default = "default_true")]
    notifications: bool,
    #[serde(default = "default_true")]
    sound_notifications: bool,
    #[serde(default)]
    project_prefs: Option<std::collections::HashMap<String, ProjectPrefs>>,
    #[serde(default)]
    has_onboarded_v2: bool,
    #[serde(default = "default_true")]
    analytics_enabled: bool,
    #[serde(default)]
    analytics_anon_id: Option<String>,
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default)]
    recent_projects: Vec<RecentProject>,
    #[serde(default = "default_terminal_scrollback")]
    terminal_scrollback: u32,
    #[serde(default)]
    terminal_idle_close_mins: u32,
}

impl From<AppSettingsRaw> for AppSettings {
    fn from(raw: AppSettingsRaw) -> Self {
        let permissions = match raw.permissions {
            Some(p) => p,
            None if raw.auto_approve => Permissions {
                mode: PermissionMode::Bypass,
                allow: Vec::new(),
                deny: Vec::new(),
            },
            None => Permissions::default(),
        };
        Self {
            claude_bin: raw.claude_bin,
            agent_profiles: raw.agent_profiles,
            font_size: raw.font_size,
            default_model: raw.default_model,
            auto_approve: raw.auto_approve,
            permissions,
            respect_gitignore: raw.respect_gitignore,
            co_author: raw.co_author,
            co_author_json_report: raw.co_author_json_report,
            notifications: raw.notifications,
            sound_notifications: raw.sound_notifications,
            project_prefs: raw.project_prefs,
            has_onboarded_v2: raw.has_onboarded_v2,
            analytics_enabled: raw.analytics_enabled,
            analytics_anon_id: raw.analytics_anon_id,
            theme: raw.theme,
            recent_projects: raw.recent_projects,
            terminal_scrollback: raw.terminal_scrollback,
            terminal_idle_close_mins: raw.terminal_idle_close_mins,
        }
    }
}

impl<'de> Deserialize<'de> for AppSettings {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        AppSettingsRaw::deserialize(deserializer).map(Into::into)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoreData {
    pub settings: AppSettings,
}

pub struct SettingsState(pub Mutex<StoreData>);

const APP_NAME: &str = "klaudex";

impl Default for SettingsState {
    fn default() -> Self {
        let data = confy::load::<StoreData>(APP_NAME, None).unwrap_or_default();
        Self(Mutex::new(data))
    }
}

pub(crate) fn persist_store(data: &StoreData) -> Result<(), AppError> {
    confy::store(APP_NAME, None, data)?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<AppSettings, AppError> {
    let store = state.0.lock();
    Ok(store.settings.clone())
}

#[tauri::command]
pub fn save_settings(
    state: tauri::State<'_, SettingsState>,
    settings: AppSettings,
) -> Result<(), AppError> {
    let mut store = state.0.lock();
    store.settings = settings;
    persist_store(&store)
}

/// Read `~/.claude/settings.json` and return only its `permissions` block —
/// the `allow` and `deny` arrays are extracted into a [`Permissions`] value
/// with a default `mode` of [`PermissionMode::Ask`]. The Claude CLI's own
/// `permissions` shape is a strict subset of ours, so we don't try to
/// interpret its `defaultMode` field; the renderer dedup-merges these
/// patterns into Klaudex's existing allow/deny lists.
///
/// Behavior:
///   - File missing       → `Ok(Permissions::default())` (renderer treats
///                          empty-counts as "nothing to import" and shows a
///                          friendly toast).
///   - File present, no
///     `permissions` key  → `Ok(Permissions::default())`.
///   - File malformed     → `Err(AppError::Other(...))` so the renderer can
///                          surface the parse error verbatim in a toast.
///
/// Lives behind the `read_claude_settings_permissions` Tauri command. See
/// `ipc.readClaudeSettingsPermissions` for the renderer wrapper.
#[tauri::command]
pub fn read_claude_settings_permissions() -> Result<Permissions, AppError> {
    let path = dirs::home_dir()
        .ok_or_else(|| AppError::Other("no home directory found".to_string()))?
        .join(".claude/settings.json");
    if !path.exists() {
        return Ok(Permissions::default());
    }
    let text = std::fs::read_to_string(&path)?;
    let value: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
        AppError::Other(format!(
            "malformed ~/.claude/settings.json: {}",
            e
        ))
    })?;
    let perms = match value.get("permissions") {
        Some(p) if !p.is_null() => p,
        _ => return Ok(Permissions::default()),
    };
    let allow = perms
        .get("allow")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    let deny = perms
        .get("deny")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();
    Ok(Permissions {
        mode: PermissionMode::default(),
        allow,
        deny,
    })
}

// ---------------------------------------------------------------------------
// Recent projects (TASK-008)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn recent_projects_get(
    state: tauri::State<'_, SettingsState>,
) -> Result<Vec<RecentProject>, AppError> {
    let store = state.0.lock();
    Ok(store.settings.recent_projects.clone())
}

#[tauri::command]
pub fn recent_projects_add(
    state: tauri::State<'_, SettingsState>,
    path: String,
    name: Option<String>,
) -> Result<(), AppError> {
    let derived_name = name.unwrap_or_else(|| {
        Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| path.clone())
    });
    let now = chrono_now_ms();

    let mut store = state.0.lock();
    // Dedupe by path: drop any existing entry, then insert at front.
    store.settings.recent_projects.retain(|p| p.path != path);
    store.settings.recent_projects.insert(
        0,
        RecentProject {
            path,
            name: derived_name,
            last_opened: now,
        },
    );
    if store.settings.recent_projects.len() > MAX_RECENT_PROJECTS {
        store.settings.recent_projects.truncate(MAX_RECENT_PROJECTS);
    }
    persist_store(&store)
}

#[tauri::command]
pub fn recent_projects_remove(
    state: tauri::State<'_, SettingsState>,
    path: String,
) -> Result<(), AppError> {
    let mut store = state.0.lock();
    let before = store.settings.recent_projects.len();
    store.settings.recent_projects.retain(|p| p.path != path);
    if store.settings.recent_projects.len() == before {
        return Ok(());
    }
    persist_store(&store)
}

#[tauri::command]
pub fn recent_projects_clear(state: tauri::State<'_, SettingsState>) -> Result<(), AppError> {
    let mut store = state.0.lock();
    if store.settings.recent_projects.is_empty() {
        return Ok(());
    }
    store.settings.recent_projects.clear();
    persist_store(&store)
}

/// Rebuild the macOS native menu so File → Open Recent reflects the current
/// `recent_projects` list. Safe to call from any thread; the underlying
/// `app.set_menu` dispatches to the main thread.
#[tauri::command]
pub fn rebuild_menu(app: tauri::AppHandle) -> Result<(), AppError> {
    let menu = build_app_menu(&app)?;
    app.set_menu(menu)
        .map_err(|e| AppError::Other(format!("set_menu failed: {}", e)))?;
    Ok(())
}

/// Returns the current Unix epoch in milliseconds, matching `Date.now()`.
fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// macOS dock icon visibility (TASK-009)
// ---------------------------------------------------------------------------

/// Toggle the macOS dock icon. On non-macOS platforms this is a no-op.
///
/// Diverges from the original TASK-009 spec (`set_dock_icon(b64)`): the spec
/// asked for a base64 image swap, but the simpler primitive needed here is
/// "show / hide the dock icon entirely" so the UI's About / settings can flip
/// between accessory and regular activation policies. The image-swap variant
/// can be added later without breaking this command's signature.
#[tauri::command]
pub fn set_dock_icon_visible(_app: tauri::AppHandle, visible: bool) -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::id;
        use objc::{class, msg_send, sel, sel_impl};
        // NSApplicationActivationPolicyRegular = 0 (icon shown)
        // NSApplicationActivationPolicyAccessory = 1 (icon hidden, no menu bar app)
        let policy: i64 = if visible { 0 } else { 1 };
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![app, setActivationPolicy: policy];
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = visible;
    Ok(())
}

/// Write a relaunch marker file under the platform app-data dir, then ask the
/// process plugin to restart the binary. The marker lets the next startup know
/// to skip the splash and resume the prior session.
#[tauri::command]
pub fn request_relaunch(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(format!("app_data_dir: {}", e)))?;
    std::fs::create_dir_all(&dir)?;
    let marker = dir.join("relaunch");
    std::fs::write(&marker, b"1")?;
    log::info!("relaunch marker written: {}", marker.display());
    app.restart();
}

// ---------------------------------------------------------------------------
// Native menu (TASK-053)
// ---------------------------------------------------------------------------

/// Construct the application menu including a `File → Open Recent` submenu
/// populated from the persisted `recent_projects` list. Paths whose
/// `Path::exists()` returns false get a `(missing)` suffix so users can see
/// stale entries before clicking.
pub fn build_app_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, AppError> {
    use tauri::Manager;
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

    let menu_err = |e: tauri::Error| AppError::Other(format!("menu build: {}", e));

    let new_window = MenuItemBuilder::new("New Window")
        .id("new_window")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)
        .map_err(menu_err)?;
    let new_thread = MenuItemBuilder::new("New Thread")
        .id("new_thread")
        .accelerator("CmdOrCtrl+N")
        .build(app)
        .map_err(menu_err)?;
    let new_project = MenuItemBuilder::new("New Project…")
        .id("new_project")
        .accelerator("CmdOrCtrl+O")
        .build(app)
        .map_err(menu_err)?;

    // Pull recent_projects out of managed state. If the state isn't managed
    // yet (called before `.manage()`), treat as empty.
    let recent: Vec<RecentProject> = app
        .try_state::<SettingsState>()
        .map(|s| s.0.lock().settings.recent_projects.clone())
        .unwrap_or_default();

    let mut recent_submenu = SubmenuBuilder::new(app, "Open Recent");
    if recent.is_empty() {
        let none_item = MenuItemBuilder::new("No Recent Projects")
            .id("recent_none")
            .enabled(false)
            .build(app)
            .map_err(menu_err)?;
        recent_submenu = recent_submenu.item(&none_item);
    } else {
        for entry in &recent {
            let exists = Path::new(&entry.path).exists();
            let label = if exists {
                entry.name.clone()
            } else {
                format!("{} (missing)", entry.name)
            };
            let item = MenuItemBuilder::new(&label)
                .id(format!("recent:{}", entry.path))
                .build(app)
                .map_err(menu_err)?;
            recent_submenu = recent_submenu.item(&item);
        }
        let sep = PredefinedMenuItem::separator(app).map_err(menu_err)?;
        let clear_recent = MenuItemBuilder::new("Clear Recent Projects")
            .id("clear_recent")
            .build(app)
            .map_err(menu_err)?;
        recent_submenu = recent_submenu.item(&sep).item(&clear_recent);
    }
    let recent_submenu = recent_submenu.build().map_err(menu_err)?;

    let app_submenu = SubmenuBuilder::new(app, "Klaudex")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()
        .map_err(menu_err)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_window)
        .item(&new_thread)
        .item(&new_project)
        .separator()
        .item(&recent_submenu)
        .separator()
        .close_window()
        .build()
        .map_err(menu_err)?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .map_err(menu_err)?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .fullscreen()
        .build()
        .map_err(menu_err)?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()
        .map_err(menu_err)?;

    let help_submenu = SubmenuBuilder::new(app, "Help").build().map_err(menu_err)?;

    MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()
        .map_err(menu_err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_values() {
        let s = AppSettings::default();
        assert_eq!(s.claude_bin, "claude");
        assert_eq!(s.font_size, 13);
        assert!(!s.auto_approve);
        assert!(s.respect_gitignore);
        assert!(s.co_author);
        assert!(!s.has_onboarded_v2);
        assert!(s.agent_profiles.is_empty());
        assert!(s.project_prefs.is_none());
        assert!(s.analytics_enabled);
        assert!(s.analytics_anon_id.is_none());
    }

    #[test]
    fn serde_roundtrip_preserves_all_fields() {
        let mut prefs = std::collections::HashMap::new();
        prefs.insert(
            "proj".to_string(),
            ProjectPrefs {
                model_id: Some("claude-4".to_string()),
                auto_approve: Some(true),
                worktree_enabled: Some(true),
                symlink_directories: Some(vec!["node_modules".to_string(), ".next".to_string()]),
                tight_sandbox: Some(true),
                ..Default::default()
            },
        );
        let settings = AppSettings {
            claude_bin: "/usr/local/bin/claude".to_string(),
            font_size: 16,
            auto_approve: true,
            has_onboarded_v2: true,
            respect_gitignore: false,
            co_author: false,
            project_prefs: Some(prefs),
            ..Default::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let restored: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.claude_bin, "/usr/local/bin/claude");
        assert_eq!(restored.font_size, 16);
        assert!(restored.auto_approve);
        assert!(restored.has_onboarded_v2);
        assert!(!restored.respect_gitignore);
        assert!(!restored.co_author);
        let pp = restored.project_prefs.unwrap();
        assert_eq!(pp["proj"].model_id.as_deref(), Some("claude-4"));
        assert_eq!(pp["proj"].worktree_enabled, Some(true));
        assert_eq!(pp["proj"].symlink_directories.as_deref(), Some(vec!["node_modules".to_string(), ".next".to_string()]).as_deref());
        assert_eq!(pp["proj"].tight_sandbox, Some(true));
    }

    #[test]
    fn backward_compat_kiro_bin_alias() {
        let json = r#"{"kiroBin": "/usr/local/bin/kiro-cli"}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.claude_bin, "/usr/local/bin/kiro-cli");
    }

    #[test]
    fn tight_sandbox_defaults_to_none_when_missing() {
        let json = r#"{}"#;
        let prefs: ProjectPrefs = serde_json::from_str(json).unwrap();
        assert!(prefs.tight_sandbox.is_none());
    }

    #[test]
    fn deserialize_with_missing_fields_uses_defaults() {
        let json = r#"{"claudeBin": "/bin/claude"}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.claude_bin, "/bin/claude");
        assert_eq!(settings.font_size, 13);
        assert!(settings.respect_gitignore);
        assert!(settings.co_author);
        assert!(!settings.has_onboarded_v2);
    }

    #[test]
    fn camel_case_serialization() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("claudeBin"));
        assert!(json.contains("fontSize"));
        assert!(json.contains("autoApprove"));
        assert!(json.contains("hasOnboardedV2"));
        assert!(!json.contains("claude_bin"));
    }

    // -----------------------------------------------------------------------
    // TASK-101: Permissions + AppSettings/ProjectPrefs migration
    // -----------------------------------------------------------------------

    #[test]
    fn permissions_defaults_to_ask() {
        let p = Permissions::default();
        assert_eq!(p.mode, PermissionMode::Ask);
        assert!(p.allow.is_empty());
        assert!(p.deny.is_empty());

        // AppSettings::default() must embed a default Permissions.
        let s = AppSettings::default();
        assert_eq!(s.permissions.mode, PermissionMode::Ask);
        assert!(s.permissions.allow.is_empty());
        assert!(s.permissions.deny.is_empty());
    }

    #[test]
    fn permission_mode_serializes_camel_case() {
        // `allowListed` is the only multi-word variant — make sure serde
        // emits it in camelCase.
        let p = Permissions {
            mode: PermissionMode::AllowListed,
            allow: vec![],
            deny: vec![],
        };
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"allowListed\""));
        assert!(!json.contains("AllowListed"));
        let restored: Permissions = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.mode, PermissionMode::AllowListed);
    }

    #[test]
    fn legacy_auto_approve_true_migrates_to_bypass_mode() {
        // Pre-migration on-disk shape: `auto_approve: true` and no
        // `permissions` block at all. The shadow-struct deserializer should
        // promote this to `permissions.mode == Bypass`.
        let json = r#"{"claudeBin": "/bin/claude", "autoApprove": true}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.permissions.mode, PermissionMode::Bypass);
        assert!(settings.permissions.allow.is_empty());
        assert!(settings.permissions.deny.is_empty());
        // Legacy field is preserved for older readers.
        assert!(settings.auto_approve);
    }

    #[test]
    fn legacy_auto_approve_false_migrates_to_ask_mode() {
        // `auto_approve: false` (or missing) without a `permissions` block
        // should land on the default `Ask` mode.
        let json = r#"{"claudeBin": "/bin/claude", "autoApprove": false}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.permissions.mode, PermissionMode::Ask);

        let json2 = r#"{"claudeBin": "/bin/claude"}"#;
        let settings2: AppSettings = serde_json::from_str(json2).unwrap();
        assert_eq!(settings2.permissions.mode, PermissionMode::Ask);
    }

    #[test]
    fn explicit_permissions_block_wins_over_legacy_auto_approve() {
        // If the on-disk file already has a `permissions` object, we must
        // never overwrite it from the legacy bool — even when they disagree.
        let json = r#"{
            "claudeBin": "/bin/claude",
            "autoApprove": true,
            "permissions": { "mode": "allowListed", "allow": ["Bash(npm test:*)"], "deny": [] }
        }"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.permissions.mode, PermissionMode::AllowListed);
        assert_eq!(settings.permissions.allow, vec!["Bash(npm test:*)"]);
    }

    #[test]
    fn project_prefs_auto_approve_some_true_migrates() {
        let json = r#"{"autoApprove": true}"#;
        let prefs: ProjectPrefs = serde_json::from_str(json).unwrap();
        let p = prefs.permissions.expect("Some(true) must produce Some(_)");
        assert_eq!(p.mode, PermissionMode::Bypass);
    }

    #[test]
    fn project_prefs_auto_approve_some_false_migrates_to_ask() {
        let json = r#"{"autoApprove": false}"#;
        let prefs: ProjectPrefs = serde_json::from_str(json).unwrap();
        let p = prefs.permissions.expect("Some(false) must produce Some(_)");
        assert_eq!(p.mode, PermissionMode::Ask);
    }

    #[test]
    fn project_prefs_auto_approve_none_leaves_permissions_none() {
        // No `autoApprove`, no `permissions` → permissions stays None so the
        // global setting wins.
        let json = r#"{}"#;
        let prefs: ProjectPrefs = serde_json::from_str(json).unwrap();
        assert!(prefs.permissions.is_none());
        assert!(prefs.auto_approve.is_none());
    }

    #[test]
    fn project_prefs_explicit_permissions_block_wins_over_legacy() {
        // If both are present, the explicit `permissions` block takes
        // precedence — same rule as the global level.
        let json = r#"{
            "autoApprove": true,
            "permissions": { "mode": "ask", "allow": [], "deny": ["Bash(rm:*)"] }
        }"#;
        let prefs: ProjectPrefs = serde_json::from_str(json).unwrap();
        let p = prefs.permissions.expect("explicit block must survive");
        assert_eq!(p.mode, PermissionMode::Ask);
        assert_eq!(p.deny, vec!["Bash(rm:*)"]);
    }

    #[test]
    fn permissions_round_trip_preserves_all_fields() {
        let p = Permissions {
            mode: PermissionMode::AllowListed,
            allow: vec!["Bash(npm test:*)".to_string(), "Read(./src/**)".to_string()],
            deny: vec!["Bash(rm:*)".to_string()],
        };
        let json = serde_json::to_string(&p).unwrap();
        let restored: Permissions = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.mode, PermissionMode::AllowListed);
        assert_eq!(restored.allow, p.allow);
        assert_eq!(restored.deny, p.deny);
    }

    #[test]
    fn app_settings_permissions_round_trip() {
        // Full round-trip including the global permissions block AND a
        // per-project override. The serialized output must round-trip back
        // identically without re-running migration.
        let mut prefs = std::collections::HashMap::new();
        prefs.insert(
            "/work/proj".to_string(),
            ProjectPrefs {
                permissions: Some(Permissions {
                    mode: PermissionMode::Bypass,
                    allow: vec!["Bash(*)".to_string()],
                    deny: vec![],
                }),
                ..Default::default()
            },
        );
        let settings = AppSettings {
            permissions: Permissions {
                mode: PermissionMode::AllowListed,
                allow: vec!["Bash(npm test:*)".to_string()],
                deny: vec!["Bash(rm:*)".to_string()],
            },
            project_prefs: Some(prefs),
            ..Default::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let restored: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.permissions.mode, PermissionMode::AllowListed);
        assert_eq!(restored.permissions.allow, settings.permissions.allow);
        assert_eq!(restored.permissions.deny, settings.permissions.deny);
        let pp = restored.project_prefs.unwrap();
        let entry = pp.get("/work/proj").unwrap();
        let entry_perms = entry.permissions.as_ref().unwrap();
        assert_eq!(entry_perms.mode, PermissionMode::Bypass);
        assert_eq!(entry_perms.allow, vec!["Bash(*)".to_string()]);
    }

    // -----------------------------------------------------------------------
    // Wave-1: RecentProject + terminal_scrollback + terminal_idle_close_mins
    // -----------------------------------------------------------------------

    #[test]
    fn recent_project_camel_case_roundtrip() {
        let p = RecentProject {
            path: "/Users/me/proj".into(),
            name: "proj".into(),
            last_opened: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"lastOpened\""));
        assert!(!json.contains("last_opened"));
        let restored: RecentProject = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.path, p.path);
        assert_eq!(restored.name, p.name);
        assert_eq!(restored.last_opened, p.last_opened);
    }

    #[test]
    fn app_settings_default_includes_wave1_fields() {
        let s = AppSettings::default();
        assert!(s.recent_projects.is_empty());
        assert_eq!(s.terminal_scrollback, 5000);
        assert_eq!(s.terminal_idle_close_mins, 0);
    }

    #[test]
    fn terminal_scrollback_default_when_missing() {
        // Older on-disk file without the new keys should populate defaults
        // via `default_terminal_scrollback` and `terminal_idle_close_mins = 0`.
        let json = r#"{"claudeBin": "/bin/claude"}"#;
        let s: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.terminal_scrollback, 5000);
        assert_eq!(s.terminal_idle_close_mins, 0);
        assert!(s.recent_projects.is_empty());
    }

    #[test]
    fn recent_projects_roundtrip_in_app_settings() {
        let s = AppSettings {
            recent_projects: vec![
                RecentProject {
                    path: "/a".into(),
                    name: "a".into(),
                    last_opened: 1,
                },
                RecentProject {
                    path: "/b".into(),
                    name: "b".into(),
                    last_opened: 2,
                },
            ],
            ..Default::default()
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("recentProjects"));
        let restored: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.recent_projects.len(), 2);
        assert_eq!(restored.recent_projects[0].path, "/a");
        assert_eq!(restored.recent_projects[1].name, "b");
    }
}
