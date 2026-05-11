use serde_json::Value;
use uuid::Uuid;

use super::connection::spawn_connection;
use super::types::*;
use super::now_rfc3339;

/// Resolve the model id that should be applied to a freshly spawned ACP
/// session. Order: explicit param → project-pref → global `defaultModel`.
/// Returns `None` when no preference is set, in which case the CLI subprocess
/// boots with its own built-in default model.
pub(crate) fn resolve_initial_model(
    explicit: Option<String>,
    workspace: &str,
    settings: &crate::commands::settings::AppSettings,
) -> Option<String> {
    if let Some(m) = explicit.filter(|s| !s.trim().is_empty()) {
        return Some(m);
    }
    if let Some(prefs) = settings.project_prefs.as_ref().and_then(|p| p.get(workspace)) {
        if let Some(m) = prefs.model_id.clone().filter(|s| !s.trim().is_empty()) {
            return Some(m);
        }
    }
    settings.default_model.clone().filter(|s| !s.trim().is_empty())
}

// ── Tauri Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn task_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, AcpState>,
    settings_state: tauri::State<'_, crate::commands::settings::SettingsState>,
    params: CreateTaskParams,
) -> Result<Task, String> {
    // Stateless resumption (Zed-style): when the frontend supplies an
    // `existing_id`, reuse that id and replay the historical messages into the
    // backend's in-memory task map. The fresh claude subprocess provides a
    // brand-new ACP session; the message history travels to the model via the
    // user's next prompt rather than via any session-level resume capability.
    let id = params.existing_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
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
    let initial_model_id = resolve_initial_model(
        params.model_id.clone(),
        &params.workspace,
        &settings.settings,
    );
    drop(settings);

    // Seed the task with prior messages (if resuming).
    let mut messages: Vec<TaskMessage> = params.existing_messages.unwrap_or_default();
    let prompt_is_empty = params.prompt.trim().is_empty();
    if !prompt_is_empty {
        messages.push(TaskMessage {
            role: "user".to_string(),
            content: params.prompt.clone(),
            timestamp: now.clone(),
            tool_calls: None,
            thinking: None,
        });
    }

    // Empty prompt or explicit defer => deferred-spawn. The task is registered
    // but the claude subprocess is not started until the user sends a real
    // message via `task_send_message`. Avoids spawning a process that would
    // immediately receive only the system prefix and confuse the model.
    let defer_spawn = params.defer_spawn || prompt_is_empty;
    let initial_status = if defer_spawn { "paused" } else { "running" };

    let task = Task {
        id: id.clone(),
        name: params.name,
        workspace: params.workspace.clone(),
        status: initial_status.to_string(),
        created_at: now,
        messages,
        pending_permission: None,
        plan: None,
        context_usage: None,
        auto_approve: Some(auto_approve),
        // TASK-113: new tasks default to no output style; user picks from OutputStylePicker.
        output_style: None,
        user_paused: None,
        parent_task_id: None,
        pending_user_input: None,
        model: model.clone(),
        session_id: None,
        total_cost: 0.0,
    };

    // If a stale connection somehow lingers for this id, terminate it before
    // spawning a fresh one so the new subprocess owns the channel cleanly.
    // We drop the sender after Kill so the old thread's recv loop exits, then
    // yield briefly to let the OS reclaim the subprocess resources.
    if let Some(stale) = state.connections.lock().remove(&id) {
        let _ = stale.cmd_tx.send(AcpCommand::Kill);
        drop(stale);
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    state.tasks.lock().insert(id.clone(), task.clone());

    let _is_plan_mode = params.mode_id.as_deref() == Some("kiro_planner");

    // Deferred-spawn: register the task and return without launching claude.
    // The first call to `task_send_message` will detect there is no connection
    // and spawn one on demand via the existing reconnect path.
    if defer_spawn {
        return Ok(task);
    }

    let handle = spawn_connection(
        id.clone(),
        params.workspace,
        claude_bin,
        auto_approve,
        app.clone(),
        params.mode_id,
        initial_model_id,
        tight_sandbox,
        None,
        None, // output_style — fresh task, no style yet
    )?;

    // Send initial prompt with UI formatting rules prepended (not shown in UI)
    let mut system_prefix = String::from(concat!(
        "## Asking the user clarifying questions\n\n",
        "Default to action. Most of the time you should NOT ask. Make a reasonable ",
        "assumption, state it in one line, and proceed. Only escalate to a question ",
        "when you genuinely cannot decide and the choice would materially change the work.\n\n",
        "**Ask ONLY for:**\n",
        "- Architectural decisions with non-trivial tradeoffs (e.g. REST vs. gRPC, monolith vs. service split, sync vs. event-driven).\n",
        "- Tech-stack or framework picks where multiple options are defensible (e.g. Postgres vs. SQLite, Zustand vs. Redux).\n",
        "- External dependencies where alternatives differ meaningfully on license, size, maintenance, or lock-in.\n",
        "- Ambiguous scope where two reasonable interpretations of the request would lead to materially different implementations.\n",
        "- Irreversible or hard-to-reverse changes (data deletion, schema migrations, public API breaks, force-push, prod config).\n\n",
        "**Do NOT ask for:**\n",
        "- Status updates, progress notes, or \"FYI\" — write those as plain prose.\n",
        "- Confirmations of an obvious next step you should just take.\n",
        "- Trivial wording, naming, formatting, or styling choices — pick a sensible default.\n",
        "- Anything answerable by reading the codebase, running a tool, or web search.\n",
        "- Open-ended \"what do you think?\" prompts — those belong in plain prose, not `[N]:`.\n\n",
        "**Format (required for the UI to render an interactive card):**\n\n",
        "[1]: Concise question ending in a question mark?\n",
        "a. **Short label** — One-line description of the tradeoff.\n",
        "b. **Short label** — One-line description of the tradeoff.\n",
        "c. **Other** — Describe your preference.\n\n",
        "**Rules — strict:**\n",
        "- Use the `[N]:` bracket-number format only. Never use bold (`**1.`) or numbered lists for questions.\n",
        "- Every `[N]:` question MUST have 2–4 concrete options as `a.`, `b.`, `c.`, ... (lowercase). A `[N]:` line without options will not render as a card and will confuse the user — write open-ended thoughts as plain prose instead.\n",
        "- Cap each turn at **1–3 questions total**. If more decisions exist, pick the highest-leverage ones and state your default for the rest in plain prose (\"Assuming X unless you say otherwise\").\n",
        "- One question per distinct decision. Do not split a single decision across multiple questions or restate the same choice in different words.\n",
        "- Place each question and its options on consecutive lines.\n",
        "- A short lead-in sentence is optional.\n\n",
        "When in doubt: don't ask. Decide, state the assumption, and proceed.\n\n",
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
    // Resumption preamble: when a thread is being resumed, the fresh claude
    // subprocess has no memory of the prior conversation. Replay the transcript
    // as context so the agent can follow up coherently. Mirrors Zed's
    // `thread.replay(cx)` step — the messages live in the user's first prompt
    // instead of an in-process model session.
    //
    // The transcript is capped to keep the resumption preamble well under any
    // model's input window. Logic lives in `build_resumption_preamble` so
    // `task_fork` can share the same cap/format.
    let prior_messages: &[TaskMessage] = task
        .messages
        .split_last()
        .map(|(_new, prior)| prior)
        .unwrap_or(&[]);
    let resumption_preamble = super::build_resumption_preamble(
        prior_messages,
        "Resumed conversation",
        "You are resuming an earlier conversation in this workspace. \
         The transcript below is for context only — do not repeat prior work \
         or re-execute completed tool calls. The user's new message follows \
         after the transcript.",
    );
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
    let full_prompt = format!("{system_prefix}{resumption_preamble}{}{json_report_suffix}", params.prompt);
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

        let (workspace, task_auto_approve, resume_sid, task_output_style) = {
            let tasks = state.tasks.lock();
            let t = tasks.get(&task_id).ok_or("Task not found")?;
            (t.workspace.clone(), t.auto_approve.unwrap_or(global_auto_approve), t.session_id.clone(), t.output_style.clone())
        };

        let project_prefs = settings.settings.project_prefs.as_ref()
            .and_then(|p| p.get(&workspace));
        let tight_sandbox = project_prefs
            .and_then(|pp| pp.tight_sandbox)
            .unwrap_or(true);
        let initial_model_id = resolve_initial_model(None, &workspace, &settings.settings);
        drop(settings);

        // Destroy old connection
        if let Some(old) = state.connections.lock().remove(&task_id) {
            let _ = old.cmd_tx.send(AcpCommand::Kill);
        }

        let handle = spawn_connection(
            task_id.clone(), workspace, claude_bin, task_auto_approve,
            app.clone(), None, initial_model_id, tight_sandbox,
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
        let (workspace, task_auto_approve, resume_sid, task_output_style) = {
            let tasks = state.tasks.lock();
            let t = tasks.get(&task_id).ok_or("Task not found")?;
            (t.workspace.clone(), t.auto_approve.unwrap_or(global_auto_approve), t.session_id.clone(), t.output_style.clone())
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
            task_output_style,
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
    let mut parent_messages = parent.as_ref().map(|p| p.messages.clone()).unwrap_or_default();
    let parent_auto_approve = parent.as_ref().and_then(|p| p.auto_approve);

    // Normalize tool-call statuses on the cloned messages. The parent may be
    // mid-stream when forked; non-terminal statuses (`pending`, `in_progress`)
    // would render in the fork as if work were ongoing. Fix this on the data
    // before storing it on the new task.
    //
    // Note: there's a benign race here — the parent may complete a tool call
    // between our clone and this sanitize. The fork is a point-in-time snapshot
    // and the user can always see the parent's live state in its own thread.
    super::sanitize_forked_messages(&mut parent_messages);

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
    let initial_model_id = resolve_initial_model(None, &workspace, &settings.settings);
    drop(settings);

    // Build the transcript-replay preamble from the parent's messages. The
    // freshly spawned claude subprocess has no memory of the parent's
    // conversation, so we ship the transcript on the user's *next* prompt.
    // Stored on the connection handle and consumed on the first Prompt — the
    // fork lands in `paused` state with no model traffic until the user sends.
    let pending_preamble = super::build_resumption_preamble(
        &parent_messages,
        "Forked conversation",
        "This thread was forked from an earlier conversation. The transcript \
         below is for context only — do not repeat prior work or re-execute \
         completed tool calls. The user's new message follows after the \
         transcript and may diverge from the original direction.",
    );

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
        output_style: parent.as_ref().and_then(|p| p.output_style.clone()),
    };
    state.tasks.lock().insert(new_id.clone(), fork_task.clone());
    let preamble_opt = if pending_preamble.is_empty() { None } else { Some(pending_preamble) };
    let handle = super::connection::spawn_connection_with_preamble(
        new_id.clone(),
        workspace,
        claude_bin,
        auto_approve,
        app,
        None,
        initial_model_id,
        tight_sandbox,
        preamble_opt,
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

/// Apply a model selection to the live ACP session for `task_id`. The change
/// is delivered as an `AcpCommand::SetModel`, which the connection loop
/// translates into a `session/set_model` request to claude. Returns
/// `Ok(())` even when the task has no live connection (e.g. deferred-spawn
/// thread) — the model preference is still persisted in `projectPrefs`/
/// `defaultModel` by the frontend, and the next spawn will pick it up via
/// `resolve_initial_model`.
#[tauri::command]
pub fn set_model(
    state: tauri::State<'_, AcpState>,
    task_id: String,
    model_id: String,
) -> Result<(), String> {
    let conns = state.connections.lock();
    if let Some(h) = conns.get(&task_id) {
        h.cmd_tx.send(AcpCommand::SetModel(model_id)).map_err(|e| e.to_string())?;
    }
    Ok(())
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
    let (workspace, task_auto_approve, task_output_style) = {
        let mut tasks = state.tasks.lock();
        let task = tasks.get_mut(&task_id).ok_or("Task not found")?;
        task.model = Some(model_id.clone());
        task.status = "paused".to_string();
        use tauri::Emitter;
        let _ = app.emit("task_update", task.clone());
        let aa = task.auto_approve.unwrap_or(false);
        let os = task.output_style.clone();
        (task.workspace.clone(), aa, os)
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
        task_output_style,
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
