use serde_json::Value;
use tokio::sync::oneshot;
use uuid::Uuid;

use super::connection::spawn_connection;
use super::types::*;
use super::now_rfc3339;

// ── Tauri Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn task_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    params: CreateTaskParams,
) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let settings = settings_state.0.lock();
    let auto_approve = params.auto_approve.unwrap_or(settings.settings.auto_approve);
    let claude_bin = settings.settings.claude_bin.clone();
    let co_author = settings.settings.co_author;
    let co_author_json_report = settings.settings.co_author_json_report;
    let project_prefs = settings.settings.project_prefs.as_ref()
        .and_then(|p| p.get(&params.workspace));
    let tight_sandbox = project_prefs
        .and_then(|pp| pp.tight_sandbox)
        .unwrap_or(true);
    let model = project_prefs
        .and_then(|pp| pp.model_id.clone())
        .or_else(|| settings.settings.default_model.clone());
    drop(settings);

    let task = Task {
        id: id.clone(),
        name: params.name,
        workspace: params.workspace.clone(),
        status: "running".to_string(),
        created_at: now.clone(),
        messages: vec![TaskMessage {
            role: "user".to_string(),
            content: params.prompt.clone(),
            timestamp: now,
            tool_calls: None,
            thinking: None,
        }],
        pending_permission: None,
        plan: None,
        context_usage: None,
        auto_approve: Some(auto_approve),
        user_paused: None,
        parent_task_id: None,
        pending_user_input: None,
        model: model.clone(),
        session_id: None,
        total_cost: 0.0,
    };

    state.tasks.lock().insert(id.clone(), task.clone());

    let handle = spawn_connection(
        id.clone(),
        params.workspace,
        claude_bin,
        auto_approve,
        app.clone(),
        params.mode_id,
        model,
        tight_sandbox,
        None,
    )?;

    // Send initial prompt with UI formatting rules prepended (not shown in UI)
    let mut system_prefix = String::from(concat!(
        "## Structured questions\n\n",
        "When you need to ask the user clarifying questions before starting work, ",
        "use this exact format so the UI can render interactive question cards:\n\n",
        "[1]: Question text here?\n",
        "a. **Label** — Description of this option\n",
        "b. **Label** — Description of this option\n",
        "c. **Other** — Describe your preference\n\n",
        "Rules:\n",
        "- Use `[N]:` bracket-number format for each question (not bold, not numbered lists).\n",
        "- Use lowercase `a.` `b.` `c.` for options.\n",
        "- Place each question and its options on consecutive lines with no extra blank lines between them.\n",
        "- You may include a short lead-in sentence before the questions.\n\n",
        "---\n\n",
    ));
    if co_author {
        system_prefix.push_str(concat!(
            "## Commits\n\n",
            "Every git commit must include the co-author trailer:\n\n",
            "```\nCo-authored-by: Klaudex <274876363+klaudex@users.noreply.github.com>\n```\n\n",
            "Use conventional commit format: `type(scope): description`.\n\n",
            "---\n\n",
        ));
    }
    let json_report_suffix = if co_author_json_report {
        concat!(
            "\n\n## Completion report\n\n",
            "When you finish the task, append a JSON block at the very end of your final message.\n",
            "Use this exact format:\n\n",
            "```klaudex-report\n",
            "{\n",
            "  \"status\": \"done\" | \"partial\" | \"blocked\",\n",
            "  \"summary\": \"one-line description of what was done\",\n",
            "  \"filesChanged\": [\"path/to/file.ts\"],\n",
            "  \"linesAdded\": 42,\n",
            "  \"linesRemoved\": 7\n",
            "}\n",
            "```\n\n",
            "Only include the block once, at the end. Do not wrap it in any other code fence.\n",
        )
    } else {
        ""
    };
    let full_prompt = format!("{system_prefix}{}{json_report_suffix}", params.prompt);
    let _ = handle.cmd_tx.send(AcpCommand::Prompt(full_prompt, params.attachments.unwrap_or_default()));

    state.connections.lock().insert(id, handle);

    Ok(task)
}

#[tauri::command]
pub fn task_list(state: tauri::State<'_, AcpState>) -> Result<Vec<Task>, String> {
    let tasks = state.tasks.lock();
    Ok(tasks.values().cloned().collect())
}

#[tauri::command]
pub fn task_send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    task_id: String,
    message: String,
    attachments: Option<Vec<AttachmentData>>,
) -> Result<Task, String> {
    // Push user message
    {
        let mut tasks = state.tasks.lock();
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
        task.messages.push(TaskMessage {
            role: "user".to_string(),
            content: message.clone(),
            timestamp: now_rfc3339(),
            tool_calls: None,
            thinking: None,
        });
        task.status = "running".to_string();
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }

    // Check if connection is alive, reconnect if needed
    let need_reconnect = {
        let conns = state.connections.lock();
        match conns.get(&task_id) {
            Some(h) => !h.alive.load(std::sync::atomic::Ordering::SeqCst),
            None => true,
        }
    };

    if need_reconnect {
        let settings = settings_state.0.lock();
        let claude_bin = settings.settings.claude_bin.clone();
        let global_auto_approve = settings.settings.auto_approve;

        let (workspace, task_auto_approve, resume_sid) = {
            let tasks = state.tasks.lock();
            let t = tasks.get(&task_id).ok_or("Task not found")?;
            (t.workspace.clone(), t.auto_approve.unwrap_or(global_auto_approve), t.session_id.clone())
        };

        let project_prefs = settings.settings.project_prefs.as_ref()
            .and_then(|p| p.get(&workspace));
        let tight_sandbox = project_prefs
            .and_then(|pp| pp.tight_sandbox)
            .unwrap_or(true);
        let model = project_prefs
            .and_then(|pp| pp.model_id.clone())
            .or_else(|| settings.settings.default_model.clone());
        drop(settings);

        // Destroy old connection
        if let Some(old) = state.connections.lock().remove(&task_id) {
            let _ = old.cmd_tx.send(AcpCommand::Kill);
        }

        let handle = spawn_connection(
            task_id.clone(), workspace, claude_bin, task_auto_approve,
            app.clone(), None, model, tight_sandbox, resume_sid,
        )?;
        let _ = handle.cmd_tx.send(AcpCommand::Prompt(message, attachments.unwrap_or_default()));
        state.connections.lock().insert(task_id.clone(), handle);
    } else {
        let conns = state.connections.lock();
        if let Some(h) = conns.get(&task_id) {
            let _ = h.cmd_tx.send(AcpCommand::Prompt(message, attachments.unwrap_or_default()));
        }
    }

    let tasks = state.tasks.lock();
    tasks.get(&task_id).cloned().ok_or_else(|| "Task not found".to_string())
}

#[tauri::command]
pub fn task_pause(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
) -> Result<Task, String> {
    if let Some(h) = state.connections.lock().get(&task_id) {
        let _ = h.cmd_tx.send(AcpCommand::Cancel);
    }
    let mut tasks = state.tasks.lock();
    let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
    task.status = "paused".to_string();
    task.user_paused = Some(true);
    use tauri::Emitter;
    let _ = app.emit("task_update", task.clone());
    Ok(task.clone())
}

#[tauri::command]
pub fn task_resume(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    task_id: String,
) -> Result<Task, String> {
    // Check if connection is alive; reconnect if dead (pause kills the process)
    let is_alive = {
        let conns = state.connections.lock();
        conns.get(&task_id)
            .map(|h| h.alive.load(std::sync::atomic::Ordering::SeqCst))
            .unwrap_or(false)
    };
    if is_alive {
        let conns = state.connections.lock();
        if let Some(h) = conns.get(&task_id) {
            let _ = h.cmd_tx.send(AcpCommand::Prompt("continue".to_string(), vec![]));
        }
    } else {
        // Connection is dead (pause killed it), spawn a new one
        let settings = settings_state.0.lock();
        let claude_bin = settings.settings.claude_bin.clone();
        let global_auto_approve = settings.settings.auto_approve;
        let (workspace, task_auto_approve, resume_sid) = {
            let tasks = state.tasks.lock();
            let t = tasks.get(&task_id).ok_or("Task not found")?;
            (t.workspace.clone(), t.auto_approve.unwrap_or(global_auto_approve), t.session_id.clone())
        };
        let project_prefs = settings.settings.project_prefs.as_ref()
            .and_then(|p| p.get(&workspace));
        let tight_sandbox = project_prefs
            .and_then(|pp| pp.tight_sandbox)
            .unwrap_or(true);
        let model = project_prefs
            .and_then(|pp| pp.model_id.clone())
            .or_else(|| settings.settings.default_model.clone());
        drop(settings);
        // Destroy old connection
        if let Some(old) = state.connections.lock().remove(&task_id) {
            let _ = old.cmd_tx.send(AcpCommand::Kill);
        }
        let handle = spawn_connection(
            task_id.clone(), workspace, claude_bin, task_auto_approve,
            app.clone(), None, model, tight_sandbox, resume_sid,
        )?;
        let _ = handle.cmd_tx.send(AcpCommand::Prompt("continue".to_string(), vec![]));
        state.connections.lock().insert(task_id.clone(), handle);
    }
    let mut tasks = state.tasks.lock();
    let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
    task.status = "running".to_string();
    task.user_paused = Some(false);
    use tauri::Emitter;
    let _ = app.emit("task_update", task.clone());
    Ok(task.clone())
}

#[tauri::command]
pub fn task_set_auto_approve(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
    auto_approve: bool,
) -> Result<(), String> {
    if let Some(h) = state.connections.lock().get(&task_id) {
        h.auto_approve.store(auto_approve, std::sync::atomic::Ordering::SeqCst);
    }
    let mut tasks = state.tasks.lock();
    if let Some(task) = tasks.get_mut(&task_id) {
        task.auto_approve = Some(auto_approve);
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn task_cancel(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
) -> Result<(), String> {
    if let Some(h) = state.connections.lock().remove(&task_id) {
        let _ = h.cmd_tx.send(AcpCommand::Kill);
    }
    let mut tasks = state.tasks.lock();
    if let Some(task) = tasks.get_mut(&task_id) {
        task.status = "cancelled".to_string();
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn task_delete(state: tauri::State<'_, AcpState>, task_id: String) -> Result<(), String> {
    if let Some(h) = state.connections.lock().remove(&task_id) {
        let _ = h.cmd_tx.send(AcpCommand::Kill);
    }
    state.tasks.lock().remove(&task_id);
    Ok(())
}

#[tauri::command]
pub async fn task_fork(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    params: ForkTaskParams,
) -> Result<Task, String> {
    let task_id = &params.task_id;
    let parent = {
        let tasks = state.tasks.lock();
        tasks.get(task_id).cloned()
    };
    let workspace = parent.as_ref().map(|p| p.workspace.clone())
        .or(params.workspace)
        .ok_or("No workspace found for task")?;
    let parent_name = parent.as_ref().map(|p| p.name.clone())
        .or(params.parent_name)
        .unwrap_or_else(|| "thread".to_string());
    let parent_messages = parent.as_ref().map(|p| p.messages.clone()).unwrap_or_default();
    let parent_auto_approve = parent.as_ref().and_then(|p| p.auto_approve);
    let has_live_connection = {
        let conns = state.connections.lock();
        conns.get(task_id)
            .map(|h| h.alive.load(std::sync::atomic::Ordering::SeqCst))
            .unwrap_or(false)
    };
    if has_live_connection {
        let (reply_tx, reply_rx) = oneshot::channel();
        {
            let conns = state.connections.lock();
            if let Some(handle) = conns.get(task_id) {
                let _ = handle.cmd_tx.send(AcpCommand::ForkSession(reply_tx));
            }
        }
        let _ = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            reply_rx,
        ).await;
    }
    let new_id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let settings = settings_state.0.lock();
    let auto_approve = parent_auto_approve.unwrap_or(settings.settings.auto_approve);
    let claude_bin = settings.settings.claude_bin.clone();
    let fork_project_prefs = settings.settings.project_prefs.as_ref()
        .and_then(|p| p.get(&workspace));
    let tight_sandbox = fork_project_prefs
        .and_then(|pp| pp.tight_sandbox)
        .unwrap_or(true);
    let model = fork_project_prefs
        .and_then(|pp| pp.model_id.clone())
        .or_else(|| settings.settings.default_model.clone());
    drop(settings);
    let fork_task = Task {
        id: new_id.clone(),
        name: format!("fork: {}", parent_name),
        workspace: workspace.clone(),
        status: "paused".to_string(),
        created_at: now.clone(),
        messages: {
            let mut msgs = parent_messages;
            msgs.push(TaskMessage {
                role: "system".to_string(),
                content: format!("Forked from: {}", parent_name),
                timestamp: now,
                tool_calls: None,
                thinking: None,
            });
            msgs
        },
        pending_permission: None,
        plan: None,
        context_usage: None,
        auto_approve: Some(auto_approve),
        user_paused: None,
        parent_task_id: Some(task_id.clone()),
        pending_user_input: None,
        model: model.clone(),
        session_id: None,
        total_cost: 0.0,
    };
    state.tasks.lock().insert(new_id.clone(), fork_task.clone());
    let handle = spawn_connection(
        new_id.clone(),
        workspace,
        claude_bin,
        auto_approve,
        app,
        None,
        model,
        tight_sandbox,
        None,
    )?;
    state.connections.lock().insert(new_id, handle);
    Ok(fork_task)
}

#[tauri::command]
pub fn task_allow_permission(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
    request_id: String,
    option_id: Option<String>,
) -> Result<(), String> {
    let resolved_id = if let Some(id) = option_id {
        id
    } else {
        let tasks = state.tasks.lock();
        tasks.get(&task_id)
            .and_then(|t| t.pending_permission.as_ref())
            .and_then(|pp| {
                pp.options.iter().find(|o| o.kind == "allow_once")
                    .or_else(|| pp.options.iter().find(|o| o.kind == "allow_always"))
                    .or_else(|| pp.options.first())
            })
            .map(|o| o.option_id.clone())
            .unwrap_or_else(|| "allow".to_string())
    };

    if let Some(tx) = state.permission_resolvers.lock().remove(&request_id) {
        let _ = tx.send(PermissionReply { option_id: resolved_id });
    }

    let mut tasks = state.tasks.lock();
    if let Some(task) = tasks.get_mut(&task_id) {
        task.status = "running".to_string();
        task.pending_permission = None;
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn task_deny_permission(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
    request_id: String,
    option_id: Option<String>,
) -> Result<(), String> {
    let resolved_id = if let Some(id) = option_id {
        id
    } else {
        let tasks = state.tasks.lock();
        tasks.get(&task_id)
            .and_then(|t| t.pending_permission.as_ref())
            .and_then(|pp| {
                pp.options.iter().find(|o| o.kind == "reject_once")
                    .or_else(|| pp.options.iter().find(|o| o.kind == "reject_always"))
                    .or_else(|| pp.options.first())
            })
            .map(|o| o.option_id.clone())
            .unwrap_or_else(|| "reject".to_string())
    };

    if let Some(tx) = state.permission_resolvers.lock().remove(&request_id) {
        let _ = tx.send(PermissionReply { option_id: resolved_id });
    }

    let mut tasks = state.tasks.lock();
    if let Some(task) = tasks.get_mut(&task_id) {
        task.status = "running".to_string();
        task.pending_permission = None;
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }
    Ok(())
}

#[tauri::command]
pub fn set_mode(
    state: tauri::State<'_, AcpState>,
    task_id: String,
    mode_id: String,
) -> Result<(), String> {
    let conns = state.connections.lock();
    let h = conns.get(&task_id).ok_or("No connection for task")?;
    h.cmd_tx.send(AcpCommand::SetMode(mode_id)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn task_set_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    task_id: String,
    model_id: String,
) -> Result<Task, String> {
    // Kill existing connection
    if let Some(old) = state.connections.lock().remove(&task_id) {
        let _ = old.cmd_tx.send(AcpCommand::Kill);
    }
    // Update the stored model on the task
    let (workspace, task_auto_approve) = {
        let mut tasks = state.tasks.lock();
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
        task.model = Some(model_id.clone());
        task.status = "paused".to_string();
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
        let aa = task.auto_approve.unwrap_or(false);
        (task.workspace.clone(), aa)
    };
    // Spawn a new connection with the new model (will be used on next message)
    let settings = settings_state.0.lock();
    let claude_bin = settings.settings.claude_bin.clone();
    let project_prefs = settings.settings.project_prefs.as_ref()
        .and_then(|p| p.get(&workspace));
    let tight_sandbox = project_prefs
        .and_then(|pp| pp.tight_sandbox)
        .unwrap_or(true);
    drop(settings);
    let handle = spawn_connection(
        task_id.clone(),
        workspace,
        claude_bin,
        task_auto_approve,
        app,
        None,
        Some(model_id),
        tight_sandbox,
        None,
    )?;
    state.connections.lock().insert(task_id.clone(), handle);
    let tasks = state.tasks.lock();
    tasks.get(&task_id).cloned().ok_or_else(|| "Task not found".to_string())
}

#[tauri::command]
pub fn task_rollback(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
    num_turns: usize,
) -> Result<Task, String> {
    // Kill the current connection since we're modifying conversation history
    if let Some(old) = state.connections.lock().remove(&task_id) {
        let _ = old.cmd_tx.send(AcpCommand::Kill);
    }
    let mut tasks = state.tasks.lock();
    let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
    // Remove last N*2 messages (N user + N assistant per turn)
    let remove_count = num_turns * 2;
    let new_len = task.messages.len().saturating_sub(remove_count);
    task.messages.truncate(new_len);
    task.status = "paused".to_string();
    task.pending_permission = None;
    task.pending_user_input = None;
    use tauri::Emitter;
    let _ = app.emit("task_update", task.clone());
    Ok(task.clone())
}

#[tauri::command]
pub fn task_respond_user_input(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    task_id: String,
    request_id: String,
    answers: Value,
) -> Result<(), String> {
    let response = serde_json::json!({
        "type": "control_response",
        "response": {
            "subtype": "success",
            "request_id": request_id,
            "response": { "answers": answers }
        }
    });
    // Send the response via the connection's command channel
    let conns = state.connections.lock();
    if let Some(h) = conns.get(&task_id) {
        let _ = h.cmd_tx.send(AcpCommand::RespondUserInput(request_id.clone(), response));
    }
    drop(conns);
    // Clear pending user input from task
    let mut tasks = state.tasks.lock();
    if let Some(task) = tasks.get_mut(&task_id) {
        task.status = "running".to_string();
        task.pending_user_input = None;
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
    }
    // Remove the resolver
    state.user_input_resolvers.lock().remove(&request_id);
    Ok(())
}

#[tauri::command]
pub fn list_models(
    app: tauri::AppHandle,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    claude_bin: Option<String>,
) -> Result<Value, String> {
    let bin = match claude_bin {
        Some(b) => b,
        None => settings_state.0.lock().settings.claude_bin.clone(),
    };

    // Use `claude models list --output-format json` to get available models.
    // Falls back to a hardcoded default list if the command fails.
    let output = std::process::Command::new(&bin)
        .args(["models", "list", "--output-format", "json"])
        .env(
            "PATH",
            format!(
                "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:{}",
                std::env::var("PATH").unwrap_or_default()
            ),
        )
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Ok(models_val) = serde_json::from_str::<Value>(stdout.trim()) {
                return Ok(serde_json::json!({
                    "availableModels": models_val,
                    "currentModelId": models_val.as_array().and_then(|a| a.first()).and_then(|m| m.get("modelId")).cloned()
                }));
            }
        }
        _ => {}
    }

    // Fallback: return a default model list
    Ok(serde_json::json!({
        "availableModels": [
            {"modelId": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "description": "Best combination of speed and intelligence"},
            {"modelId": "claude-opus-4-7", "name": "Claude Opus 4.7", "description": "Most capable for complex reasoning and agentic coding"},
            {"modelId": "claude-haiku-4-5", "name": "Claude Haiku 4.5", "description": "Fastest with near-frontier intelligence"},
        ],
        "currentModelId": "claude-sonnet-4-6"
    }))
}

#[tauri::command]
pub fn probe_capabilities(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
) -> Result<Value, String> {
    if state
        .probe_running
        .swap(true, std::sync::atomic::Ordering::SeqCst)
    {
        log::info!("[Claude] probe_capabilities skipped (already running)");
        return Ok(serde_json::json!({ "ok": true, "skipped": true }));
    }

    let bin = settings_state.0.lock().settings.claude_bin.clone();
    log::info!("[Claude] probe_capabilities starting with bin={}", bin);

    let app_for_flag = app.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        // Try to get models via CLI
        let models_result = std::process::Command::new(&bin)
            .args(["models", "list", "--output-format", "json"])
            .env(
                "PATH",
                format!(
                    "{}:{}",
                    if cfg!(target_os = "macos") { "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" }
                    else { "/usr/local/bin:/usr/bin:/bin" },
                    std::env::var("PATH").unwrap_or_default()
                ),
            )
            .output();

        let models = match models_result {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                serde_json::from_str::<Value>(stdout.trim()).ok()
            }
            _ => None,
        };

        let available_models = models.unwrap_or_else(|| {
            serde_json::json!([
                {"modelId": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "description": "Best combination of speed and intelligence"},
                {"modelId": "claude-opus-4-7", "name": "Claude Opus 4.7", "description": "Most capable for complex reasoning and agentic coding"},
                {"modelId": "claude-haiku-4-5", "name": "Claude Haiku 4.5", "description": "Fastest with near-frontier intelligence"},
            ])
        });

        let current_model = available_models
            .as_array()
            .and_then(|a| a.first())
            .and_then(|m| m.get("modelId"))
            .and_then(|v| v.as_str())
            .unwrap_or("claude-sonnet-4-6");

        use tauri::Emitter;
        let _ = app_clone.emit(
            "session_init",
            serde_json::json!({
                "taskId": "__probe__",
                "models": {
                    "availableModels": available_models,
                    "currentModelId": current_model,
                },
                "modes": {
                    "currentModeId": "default",
                    "availableModes": [
                        {"id": "default", "name": "Default", "description": "Standard behavior"},
                        {"id": "plan", "name": "Plan Mode", "description": "Planning mode"},
                    ]
                },
            }),
        );

        // Reset the probe guard
        use tauri::Manager;
        if let Some(acp_state) = app_for_flag.try_state::<AcpState>() {
            acp_state
                .probe_running
                .store(false, std::sync::atomic::Ordering::SeqCst);
        }

        log::info!("[Claude] probe_capabilities completed");
    });

    Ok(serde_json::json!({ "ok": true, "async": true }))
}
