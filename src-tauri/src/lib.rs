#![allow(unexpected_cfgs, unused_imports)]

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

mod commands;

use commands::{acp, analytics, claude_config, claude_watcher, fs_ops, git, pty, settings, statusline};
use tauri::{Emitter, Manager};

/// Install a global panic hook that logs the panic message and backtrace.
/// This catches panics on *any* thread (background ACP, probe, PTY reader)
/// that would otherwise vanish silently.
fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current();
        let name = thread.name().unwrap_or("<unnamed>");
        let location = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".to_string());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "non-string panic payload".to_string()
        };
        // Log via the log crate (goes to tauri_plugin_log → file + console)
        log::error!(
            "PANIC on thread '{}' at {}: {}",
            name, location, payload
        );
        // Also write to stderr in case the log system is down
        eprintln!(
            "[Klaudex PANIC] thread '{}' at {}: {}",
            name, location, payload
        );
        // Call the default hook so the backtrace still prints in dev
        default_hook(info);
    }));
}

/// Gracefully shut down all ACP connections and PTY sessions.
fn shutdown_app(app: &tauri::AppHandle) {
    log::info!("Window close requested — shutting down");
    let start = std::time::Instant::now();

    // Kill all ACP connections
    if let Some(acp_state) = app.try_state::<acp::AcpState>() {
        {
            let mut conns = acp_state.connections.lock();
            let count = conns.len();
            for (task_id, handle) in conns.drain() {
                log::info!("Killing ACP connection: {}", task_id);
                let _ = handle.cmd_tx.send(acp::AcpCommand::Kill);
                // Drop the sender so the receiver side unblocks
                drop(handle);
            }
            log::info!("Sent kill to {} ACP connection(s)", count);
        }

        // Drop all pending permission resolvers so blocked ACP threads unblock
        {
            let mut resolvers = acp_state.permission_resolvers.lock();
            let count = resolvers.len();
            resolvers.clear(); // Dropping oneshot::Sender causes Err on the receiver
            if count > 0 {
                log::info!("Dropped {} pending permission resolver(s)", count);
            }
        }

        // Drop all pending user input resolvers
        {
            let mut resolvers = acp_state.user_input_resolvers.lock();
            let count = resolvers.len();
            resolvers.clear();
            if count > 0 {
                log::info!("Dropped {} pending user input resolver(s)", count);
            }
        }
    }

    // Stop all Claude config watchers BEFORE PTY teardown so the debouncer
    // threads exit cleanly before the rest of Tauri state goes away.
    claude_watcher::stop_all(app);

    // Kill all PTY sessions
    if let Some(pty_state) = app.try_state::<pty::PtyState>() {
        let mut ptys = pty_state.0.lock();
        let count = ptys.len();
        ptys.clear(); // Drop impl kills child processes and waits
        if count > 0 {
            log::info!("Killed {} PTY session(s)", count);
        }
    }

    log::info!("Shutdown completed in {:?}", start.elapsed());
}

/// Re-position the macOS traffic light buttons (close, minimize, zoom) to match
/// the custom `trafficLightPosition` from tauri.conf.json. macOS resets their
/// position when the window gains or loses focus, so this must be called on
/// every focus change to prevent them from being clipped by the content view's
/// corner radius mask.
#[cfg(target_os = "macos")]
fn reposition_traffic_lights(ns_window: cocoa::base::id) {
    use cocoa::appkit::{NSView, NSWindow, NSWindowButton};
    use cocoa::foundation::NSRect;
    const TRAFFIC_LIGHT_X: f64 = 13.0;
    const TRAFFIC_LIGHT_Y: f64 = 13.0;
    unsafe {
        let close = ns_window.standardWindowButton_(NSWindowButton::NSWindowCloseButton);
        let miniaturize = ns_window.standardWindowButton_(NSWindowButton::NSWindowMiniaturizeButton);
        let zoom = ns_window.standardWindowButton_(NSWindowButton::NSWindowZoomButton);
        if close.is_null() {
            return;
        }
        let title_bar_container = close.superview().superview();
        if title_bar_container.is_null() {
            return;
        }
        let title_bar_frame: NSRect = NSView::frame(title_bar_container);
        let close_rect: NSRect = NSView::frame(close);
        let button_height = close_rect.size.height;
        let vertical_offset = TRAFFIC_LIGHT_Y - (title_bar_frame.size.height - button_height) / 2.0;
        let space_between = 20.0_f64;
        for (i, button) in [close, miniaturize, zoom].iter().enumerate() {
            let mut rect: NSRect = NSView::frame(*button);
            rect.origin.x = TRAFFIC_LIGHT_X + (i as f64 * space_between);
            rect.origin.y = (title_bar_frame.size.height - button_height) / 2.0 - vertical_offset;
            button.setFrameOrigin(rect.origin);
        }
    }
}

pub fn run() {
    install_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin({
            let mut log_builder = tauri_plugin_log::Builder::new()
                .targets({
                    let mut targets = vec![
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    ];
                    #[cfg(debug_assertions)]
                    targets.push(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview));
                    targets
                });
            #[cfg(debug_assertions)]
            { log_builder = log_builder.level(log::LevelFilter::Debug); }
            #[cfg(not(debug_assertions))]
            { log_builder = log_builder.level(log::LevelFilter::Info); }
            log_builder.build()
        })
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .manage(settings::SettingsState::default())
        .manage(analytics::AnalyticsState::default())
        .manage(acp::AcpState::default())
        .manage(pty::PtyState::default())
        .manage(claude_watcher::ClaudeWatcherState::default())
        .setup(|app| {
            let _window = app.get_webview_window("main")
                .ok_or_else(|| "main window not found".to_string())?;

            // Build and install the native menu (File → Open Recent etc.).
            // Must run after `.manage(SettingsState)` so the recent-projects
            // submenu can read the persisted list.
            match settings::build_app_menu(app.handle()) {
                Ok(menu) => {
                    if let Err(e) = app.set_menu(menu) {
                        log::error!("set_menu failed: {e}");
                    }
                }
                Err(e) => log::error!("build_app_menu failed: {e}"),
            }

            // Dispatch native menu clicks back to the renderer.
            app.on_menu_event(|app_handle, event| {
                let id = event.id().0.as_str();
                match id {
                    "clear_recent" => {
                        if let Some(state) = app_handle.try_state::<settings::SettingsState>() {
                            {
                                let mut store = state.0.lock();
                                store.settings.recent_projects.clear();
                                let _ = settings::persist_store(&store);
                            }
                            if let Ok(menu) = settings::build_app_menu(app_handle) {
                                let _ = app_handle.set_menu(menu);
                            }
                        }
                    }
                    _ if id.starts_with("recent:") => {
                        let path = &id["recent:".len()..];
                        if !path.is_empty() {
                            let _ = app_handle.emit("open-recent-project", path.to_string());
                        }
                    }
                    other => {
                        // Generic fallback so the renderer can listen for any
                        // menu item we haven't bound a specific handler for.
                        let _ = app_handle.emit("menu-action", other.to_string());
                    }
                }
            });

            // Start watching the global ~/.claude directory.
            claude_watcher::watch_global_claude(app.handle());

            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(target_os = "macos")]
            #[allow(deprecated)]
            {
                use cocoa::appkit::NSWindow;
                use cocoa::base::id;
                use objc::msg_send;
                use objc::sel;
                use objc::sel_impl;
                let ns_window = _window.ns_window().unwrap() as id;
                unsafe {
                    let content_view: id = ns_window.contentView();
                    let _: () = msg_send![content_view, setWantsLayer: true];
                    let layer: id = msg_send![content_view, layer];
                    let _: () = msg_send![layer, setCornerRadius: 12.0_f64];
                    let _: () = msg_send![layer, setMasksToBounds: true];
                }
                // Initial positioning of traffic lights
                reposition_traffic_lights(ns_window);
            }
            log::info!("Klaudex started (pid={})", std::process::id());
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let app = window.app_handle().clone();
                    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
                    app.dialog()
                        .message("Are you sure you want to quit Klaudex?")
                        .title("Quit Klaudex")
                        .buttons(MessageDialogButtons::OkCancelCustom("Quit".to_string(), "Cancel".to_string()))
                        .show(move |confirmed| {
                            if confirmed {
                                shutdown_app(&app);
                                app.exit(0);
                            }
                        });
                }
                #[cfg(target_os = "macos")]
                tauri::WindowEvent::Focused(_) => {
                    // Re-position traffic lights on every focus/blur event.
                    // macOS resets their position when the window resigns/becomes key,
                    // causing them to be clipped by the content view's corner radius mask.
                    #[allow(deprecated)]
                    if let Ok(ns_window) = window.ns_window() {
                        reposition_traffic_lights(ns_window as cocoa::base::id);
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings::get_settings,
            settings::save_settings,
            settings::recent_projects_get,
            settings::recent_projects_add,
            settings::recent_projects_remove,
            settings::recent_projects_clear,
            settings::rebuild_menu,
            settings::set_dock_icon_visible,
            settings::request_relaunch,
            // File ops
            fs_ops::detect_claude_cli,
            fs_ops::read_text_file,
            fs_ops::read_file_base64,
            fs_ops::pick_folder,
            fs_ops::open_in_editor,
            fs_ops::open_url,
            fs_ops::detect_editors,
            fs_ops::detect_editors_background,
            fs_ops::list_project_files,
            fs_ops::claude_whoami,
            fs_ops::claude_logout,
            fs_ops::claude_login,
            fs_ops::open_terminal_with_command,
            fs_ops::detect_project_icon,
            fs_ops::list_small_images,
            // Git
            git::git_detect,
            git::git_list_branches,
            git::git_checkout,
            git::git_create_branch,
            git::git_delete_branch,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_fetch,
            git::git_stage,
            git::git_revert,
            git::task_diff,
            git::git_diff,
            git::git_diff_file,
            git::git_diff_stats,
            git::git_staged_stats,
            git::git_remote_url,
            git::git_worktree_create,
            git::git_worktree_remove,
            git::git_worktree_has_changes,
            git::git_worktree_setup,
            // ACP
            acp::task_create,
            acp::task_list,
            acp::task_send_message,
            acp::task_pause,
            acp::task_resume,
            acp::task_cancel,
            acp::task_delete,
            acp::task_fork,
            acp::task_allow_permission,
            acp::task_deny_permission,
            acp::task_set_auto_approve,
            acp::task_set_model,
            acp::task_rollback,
            acp::task_respond_user_input,
            acp::set_mode,
            acp::list_models,
            acp::probe_capabilities,
            // PTY
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            // Claude config
            claude_config::get_claude_config,
            // Claude watcher
            claude_watcher::watch_claude_path,
            claude_watcher::unwatch_claude_path,
            // Analytics
            analytics::analytics_save,
            analytics::analytics_load,
            analytics::analytics_clear,
            analytics::analytics_db_size,
            // Statusline (TASK-115)
            statusline::run_statusline_command,
            // Permissions import (TASK-116)
            settings::read_claude_settings_permissions,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Failed to start Klaudex: {e}");
            std::process::exit(1);
        });
}
