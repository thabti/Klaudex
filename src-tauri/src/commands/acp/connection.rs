use std::collections::BTreeSet;
use std::sync::Arc;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot};

use super::claude_types::*;
use super::sandbox::{extract_paths_from_message};
use super::types::{
    AcpCommand, AcpState, AttachmentData, ConnectionHandle, PendingPermission, PermissionOption,
    PermissionReply,
};

/// Strip embedded `<image src="data:..." />` tags and their `[Attached image: ...]` prefixes
/// from the text so the model doesn't receive raw base64 in the text content block.
pub(crate) fn strip_image_tags(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut i = 0;
    let bytes = text.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'[' && text[i..].starts_with("[Attached image: ") {
            if let Some(bracket_end) = text[i..].find("]\n<image src=\"data:") {
                let tag_start = i + bracket_end + 1;
                if text[tag_start..].starts_with("\n<image src=\"data:") {
                    if let Some(tag_end) = text[tag_start..].find(" />") {
                        i = tag_start + tag_end + 3;
                        while i < bytes.len() && bytes[i] == b'\n' {
                            i += 1;
                        }
                        continue;
                    }
                }
            }
        }
        if bytes[i] == b'<' && text[i..].starts_with("<image src=\"data:") {
            if let Some(tag_end) = text[i..].find(" />") {
                i += tag_end + 3;
                while i < bytes.len() && bytes[i] == b'\n' {
                    i += 1;
                }
                continue;
            }
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }
    result.trim().to_string()
}

/// Build content blocks for the Claude CLI input: text (with image tags stripped) + image blocks.
pub(crate) fn build_content_blocks(
    text: String,
    attachments: &[AttachmentData],
) -> Vec<ClaudeInputContent> {
    let clean_text = if attachments.is_empty() {
        text
    } else {
        strip_image_tags(&text)
    };
    let mut blocks: Vec<ClaudeInputContent> = vec![ClaudeInputContent::Text { text: clean_text }];
    for att in attachments {
        blocks.push(ClaudeInputContent::Image {
            source: ImageSource {
                source_type: "base64".to_string(),
                data: att.base64.clone(),
                media_type: att.mime_type.clone(),
            },
        });
    }
    blocks
}

// ── Spawn a Claude CLI connection on a dedicated thread ──────────────

pub(crate) fn spawn_connection(
    task_id: String,
    workspace: String,
    claude_bin: String,
    auto_approve: bool,
    app: tauri::AppHandle,
    initial_mode_id: Option<String>,
    model: Option<String>,
    tight_sandbox: bool,
    resume_session_id: Option<String>,
    // TASK-113: Optional Claude output style name; appended as `--output-style <name>`
    // when spawning the `claude` subprocess. `None` means no flag is appended.
    output_style: Option<String>,
) -> Result<ConnectionHandle, String> {
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<AcpCommand>();
    let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
    let alive_clone = alive.clone();
    let auto_approve_flag = Arc::new(std::sync::atomic::AtomicBool::new(auto_approve));

    let (perm_tx, mut perm_rx) = mpsc::unbounded_channel::<(
        String,
        String,
        String,
        Vec<PermissionOption>,
        oneshot::Sender<PermissionReply>,
    )>();

    // Spawn permission handler on the Tauri async runtime.
    let app2 = app.clone();
    let tid2 = task_id.clone();
    tauri::async_runtime::spawn(async move {
        while let Some((request_id, tool_name, description, options, reply_tx)) =
            perm_rx.recv().await
        {
            use tauri::Manager;
            if let Some(managed_state) = app2.try_state::<AcpState>() {
                {
                    let mut tasks = managed_state.tasks.lock();
                    if let Some(task) = tasks.get_mut(&tid2) {
                        task.status = "pending_permission".to_string();
                        task.pending_permission = Some(PendingPermission {
                            request_id: request_id.clone(),
                            tool_name,
                            description,
                            options,
                        });
                        use tauri::Emitter;
                        let _ = app2.emit("task_update", task.clone());
                    }
                }
                {
                    let mut resolvers = managed_state.permission_resolvers.lock();
                    resolvers.insert(request_id, reply_tx);
                }
            }
        }
    });

    // Spawn the connection on a dedicated OS thread.
    let app3 = app.clone();
    let tid3 = task_id.clone();
    let alive_for_panic = alive.clone();
    let auto_approve_for_thread = auto_approve_flag.clone();
    std::thread::spawn(move || {
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Failed to create tokio runtime");

            let local = tokio::task::LocalSet::new();
            local.block_on(&rt, async move {
                let result = run_claude_connection(
                    tid3.clone(),
                    workspace,
                    claude_bin,
                    auto_approve_for_thread,
                    app3.clone(),
                    perm_tx,
                    &mut cmd_rx,
                    initial_mode_id,
                    model,
                    tight_sandbox,
                    resume_session_id,
                    output_style,
                )
                .await;

                alive_clone.store(false, std::sync::atomic::Ordering::SeqCst);

                if let Err(e) = result {
                    use tauri::Emitter;
                    let _ = app3.emit(
                        "debug_log",
                        serde_json::json!({
                            "direction": "in", "category": "error", "type": "connection-error",
                            "taskId": tid3, "summary": e, "payload": { "error": e }, "isError": true
                        }),
                    );
                }
            });
        }));
        if result.is_err() {
            log::error!("[Claude] Connection thread panicked");
            alive_for_panic.store(false, std::sync::atomic::Ordering::SeqCst);
        }
    });

    Ok(ConnectionHandle {
        cmd_tx,
        alive,
        auto_approve: auto_approve_flag,
    })
}

/// Process a single Claude ndjson message and emit the appropriate Tauri events.
/// `turn_start_ms` is set when the first `MessageStart` arrives and read on `Result`
/// to compute `turnDurationMs`.
fn handle_claude_message(
    msg: &ClaudeMessage,
    task_id: &str,
    app: &tauri::AppHandle,
    turn_start_ms: &mut Option<u64>,
) {
    use tauri::Emitter;
    match msg {
        ClaudeMessage::System(sys) => match sys.subtype.as_str() {
            "init" => {
                log::info!("[Claude] session init: {:?}", sys.session_id);
                // Store session_id in the Task for resume support
                if let Some(sid) = &sys.session_id {
                    use tauri::Manager;
                    if let Some(state) = app.try_state::<AcpState>() {
                        let mut tasks = state.tasks.lock();
                        if let Some(task) = tasks.get_mut(task_id) {
                            task.session_id = Some(sid.clone());
                        }
                    }
                }
            }
            "status" if sys.status.as_deref() == Some("compacting") => {
                let _ = app.emit(
                    "message_chunk",
                    serde_json::json!({"taskId": task_id, "chunk": "Compacting..."}),
                );
            }
            "compact_boundary" => {
                let _ = app.emit(
                    "usage_update",
                    serde_json::json!({"taskId": task_id, "used": 0, "size": 200000}),
                );
                let _ = app.emit(
                    "message_chunk",
                    serde_json::json!({"taskId": task_id, "chunk": "\n\nCompacting completed."}),
                );
            }
            "local_command_output" => {
                if let Some(content) = &sys.content {
                    let _ = app.emit(
                        "message_chunk",
                        serde_json::json!({"taskId": task_id, "chunk": content}),
                    );
                }
            }
            "session_state_changed" => {}
            _ => {
                log::debug!("[Claude] unhandled system subtype: {}", sys.subtype);
            }
        },

        ClaudeMessage::StreamEvent(se) => match &se.event {
            StreamEvent::ContentBlockStart {
                content_block,
                index: _,
            } => match content_block {
                ContentBlock::Text { .. } => {}
                ContentBlock::Thinking { .. } => {}
                ContentBlock::ToolUse { id, name, input } => {
                    let (title, kind) = tool_title_and_kind(name, input);
                    let _ = app.emit(
                        "tool_call",
                        serde_json::json!({
                            "taskId": task_id,
                            "toolCall": {
                                "sessionUpdate": "tool_call",
                                "toolCallId": id,
                                "title": title,
                                "kind": kind,
                                "status": "pending",
                                "rawInput": input,
                            }
                        }),
                    );
                }
                _ => {}
            },

            StreamEvent::ContentBlockDelta { delta, .. } => match delta {
                ContentDelta::TextDelta { text } => {
                    if !text.is_empty() {
                        let _ = app.emit(
                            "message_chunk",
                            serde_json::json!({"taskId": task_id, "chunk": text}),
                        );
                    }
                }
                ContentDelta::ThinkingDelta { thinking } => {
                    if !thinking.is_empty() {
                        let _ = app.emit(
                            "thinking_chunk",
                            serde_json::json!({"taskId": task_id, "chunk": thinking}),
                        );
                    }
                }
                ContentDelta::InputJsonDelta { .. } => {}
                _ => {}
            },

            StreamEvent::MessageStart { message } => {
                // Record when this turn started so we can compute turnDurationMs on Result
                if turn_start_ms.is_none() {
                    *turn_start_ms = Some(
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0),
                    );
                }
                if let Some(usage) = &message.usage {
                    let input = usage.input_tokens.unwrap_or(0);
                    let output = usage.output_tokens.unwrap_or(0);
                    let cache_read = usage.cache_read_input_tokens.unwrap_or(0);
                    let cache_creation = usage.cache_creation_input_tokens.unwrap_or(0);
                    let total = input + output + cache_read + cache_creation;
                    let _ = app.emit(
                        "usage_update",
                        serde_json::json!({
                            "taskId": task_id, "used": total, "size": 200000,
                            "inputTokens": input,
                            "outputTokens": output,
                            "cacheReadTokens": cache_read,
                            "cacheCreationTokens": cache_creation,
                        }),
                    );
                }
            }

            StreamEvent::MessageDelta { usage, .. } => {
                if let Some(usage) = usage {
                    let total = usage.input_tokens.unwrap_or(0)
                        + usage.output_tokens.unwrap_or(0)
                        + usage.cache_read_input_tokens.unwrap_or(0)
                        + usage.cache_creation_input_tokens.unwrap_or(0);
                    let _ = app.emit(
                        "usage_update",
                        serde_json::json!({"taskId": task_id, "used": total, "size": 200000}),
                    );
                }
            }

            StreamEvent::ContentBlockStop { .. } | StreamEvent::MessageStop {} => {}
        },

        ClaudeMessage::Assistant(asst) => {
            // Complete assistant messages contain text and/or tool_use blocks.
            // Text blocks must be emitted as message_chunk so the frontend can display them;
            // the streaming path (ContentBlockDelta) only fires for incremental responses.
            if let Some(arr) = asst.message.content.as_array() {
                for block in arr {
                    let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    match block_type {
                        "text" => {
                            if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                                if !text.is_empty() {
                                    let _ = app.emit(
                                        "message_chunk",
                                        serde_json::json!({"taskId": task_id, "chunk": text}),
                                    );
                                }
                            }
                        }
                        "tool_use" | "server_tool_use" | "mcp_tool_use" => {
                            let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            let name =
                                block.get("name").and_then(|v| v.as_str()).unwrap_or("");
                            let input =
                                block.get("input").cloned().unwrap_or(Value::Object(Default::default()));
                            let (title, kind) = tool_title_and_kind(name, &input);
                            let _ = app.emit(
                                "tool_call",
                                serde_json::json!({
                                    "taskId": task_id,
                                    "toolCall": {
                                        "sessionUpdate": "tool_call",
                                        "toolCallId": id,
                                        "title": title,
                                        "kind": kind,
                                        "status": "pending",
                                        "rawInput": input,
                                    }
                                }),
                            );
                        }
                        "thinking" => {
                            if let Some(thinking) = block.get("thinking").and_then(|v| v.as_str()) {
                                if !thinking.is_empty() {
                                    let _ = app.emit(
                                        "thinking_chunk",
                                        serde_json::json!({"taskId": task_id, "chunk": thinking}),
                                    );
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        ClaudeMessage::User(user) => {
            // Tool results from user messages
            if let Some(arr) = user.message.content.as_array() {
                for block in arr {
                    let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    if block_type == "tool_result" || block_type == "mcp_tool_result" {
                        let tool_use_id = block
                            .get("tool_use_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let is_error = block
                            .get("is_error")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        let _ = app.emit(
                            "tool_call_update",
                            serde_json::json!({
                                "taskId": task_id,
                                "toolCall": {
                                    "sessionUpdate": "tool_call_update",
                                    "toolCallId": tool_use_id,
                                    "status": if is_error { "failed" } else { "completed" },
                                    "rawOutput": block.get("content"),
                                }
                            }),
                        );
                    }
                }
            }
        }

        ClaudeMessage::Result(res) => {
            let stop_reason = res.stop_reason.as_deref().unwrap_or("end_turn");
            // Accumulate cost
            if let Some(turn_cost) = res.total_cost_usd {
                use tauri::Manager;
                if let Some(state) = app.try_state::<AcpState>() {
                    let mut tasks = state.tasks.lock();
                    if let Some(task) = tasks.get_mut(task_id) {
                        task.total_cost += turn_cost;
                    }
                }
            }
            let cumulative_cost = {
                use tauri::Manager;
                app.try_state::<AcpState>()
                    .and_then(|state| state.tasks.lock().get(task_id).map(|t| t.total_cost))
                    .unwrap_or(0.0)
            };
            if let Some(usage) = &res.usage {
                let input = usage.input_tokens;
                let output = usage.output_tokens;
                let cache_read = usage.cache_read_input_tokens;
                let cache_creation = usage.cache_creation_input_tokens;
                let total = input + output + cache_read + cache_creation;
                let _ = app.emit(
                    "usage_update",
                    serde_json::json!({
                        "taskId": task_id, "used": total, "size": 200000,
                        "cost": res.total_cost_usd,
                        "totalCost": cumulative_cost,
                        "inputTokens": input,
                        "outputTokens": output,
                        "cacheReadTokens": cache_read,
                        "cacheCreationTokens": cache_creation,
                    }),
                );
            }
            // Compute turn duration from the timestamp recorded on MessageStart
            let turn_duration_ms = turn_start_ms.take().map(|start| {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0)
                    .saturating_sub(start)
            });
            let _ = app.emit(
                "turn_end",
                serde_json::json!({
                    "taskId": task_id,
                    "stopReason": stop_reason,
                    "turnDurationMs": turn_duration_ms,
                }),
            );
        }

        ClaudeMessage::ToolProgress(tp) => {
            // Forward tool_progress as a tool_call_update with in_progress status
            // so the frontend can show live output before the tool_result arrives.
            if let Some(tool_use_id) = tp.extra.get("tool_use_id").and_then(|v| v.as_str()) {
                if !tool_use_id.is_empty() {
                    let content = tp.extra.get("content");
                    let _ = app.emit(
                        "tool_call_update",
                        serde_json::json!({
                            "taskId": task_id,
                            "toolCall": {
                                "sessionUpdate": "tool_call_update",
                                "toolCallId": tool_use_id,
                                "status": "in_progress",
                                "rawOutput": content,
                            }
                        }),
                    );
                }
            }
        }
        ClaudeMessage::ToolUseSummary(_)
        | ClaudeMessage::AuthStatus(_)
        | ClaudeMessage::PromptSuggestion(_)
        | ClaudeMessage::RateLimitEvent(_) => {}
        ClaudeMessage::ControlRequest(_) => {
            // Actual handling (auto-approve or user prompt) is done in the read loop
        }
    }

    // Debug log
    let msg_type = match msg {
        ClaudeMessage::System(s) => format!("system.{}", s.subtype),
        ClaudeMessage::Result(r) => format!("result.{}", r.subtype),
        ClaudeMessage::StreamEvent(_) => "stream_event".to_string(),
        ClaudeMessage::User(_) => "user".to_string(),
        ClaudeMessage::Assistant(_) => "assistant".to_string(),
        ClaudeMessage::ToolProgress(_) => "tool_progress".to_string(),
        ClaudeMessage::ToolUseSummary(_) => "tool_use_summary".to_string(),
        ClaudeMessage::AuthStatus(_) => "auth_status".to_string(),
        ClaudeMessage::PromptSuggestion(_) => "prompt_suggestion".to_string(),
        ClaudeMessage::RateLimitEvent(_) => "rate_limit_event".to_string(),
        ClaudeMessage::ControlRequest(cr) => format!("control_request.{}", cr.request_id),
    };
    let _ = app.emit(
        "debug_log",
        serde_json::json!({
            "direction": "in", "category": "notification", "type": msg_type,
            "taskId": task_id, "summary": msg_type, "isError": false
        }),
    );
}

/// Handle a control_request from the Claude CLI permission-prompt-tool protocol.
/// If auto_approve is on, immediately sends an allow response.
/// Otherwise, emits a permission event and waits for the user's decision.
async fn handle_control_request(
    cr: &ControlRequestMessage,
    task_id: &str,
    auto_approve: &std::sync::atomic::AtomicBool,
    stdin_writer: &mut tokio::process::ChildStdin,
    perm_tx: &mpsc::UnboundedSender<(
        String,
        String,
        String,
        Vec<PermissionOption>,
        oneshot::Sender<PermissionReply>,
    )>,
) {
    let input = cr.request.input.clone().unwrap_or(Value::Object(Default::default()));
    if auto_approve.load(std::sync::atomic::Ordering::SeqCst) {
        // Audit log: auto-approve bypasses manual permission check (CWE-862).
        // Log the tool and input so operators can trace what was auto-approved.
        let tool = cr.request.tool_name.clone().unwrap_or_else(|| "unknown".to_string());
        eprintln!(
            "[security:auto-approve] task={} tool={} request_id={}",
            task_id, tool, cr.request_id
        );
        let resp = ControlResponse {
            msg_type: "control_response".to_string(),
            response: ControlResponseBody {
                subtype: "success".to_string(),
                request_id: cr.request_id.clone(),
                response: ControlResponseAction::Allow {
                    behavior: "allow".to_string(),
                    updated_input: input,
                },
            },
        };
        let mut line = serde_json::to_string(&resp).unwrap_or_default();
        line.push('\n');
        let _ = stdin_writer.write_all(line.as_bytes()).await;
        let _ = stdin_writer.flush().await;
        return;
    }
    // Manual mode: emit permission request and wait for user response
    let tool_name = cr.request.tool_name.clone().unwrap_or_default();
    let description = cr.request.decision_reason.clone().unwrap_or_else(|| {
        format!("{} wants to use {}", tool_name, serde_json::to_string(&input).unwrap_or_default())
    });
    let options = vec![
        PermissionOption { option_id: "allow_once".to_string(), name: "Allow once".to_string(), kind: "allow_once".to_string() },
        PermissionOption { option_id: "reject_once".to_string(), name: "Deny".to_string(), kind: "reject_once".to_string() },
    ];
    let (reply_tx, reply_rx) = oneshot::channel();
    let _ = perm_tx.send((cr.request_id.clone(), tool_name, description, options, reply_tx));
    let resp = match reply_rx.await {
        Ok(reply) if reply.option_id.starts_with("allow") => ControlResponse {
            msg_type: "control_response".to_string(),
            response: ControlResponseBody {
                subtype: "success".to_string(),
                request_id: cr.request_id.clone(),
                response: ControlResponseAction::Allow {
                    behavior: "allow".to_string(),
                    updated_input: input,
                },
            },
        },
        _ => ControlResponse {
            msg_type: "control_response".to_string(),
            response: ControlResponseBody {
                subtype: "success".to_string(),
                request_id: cr.request_id.clone(),
                response: ControlResponseAction::Deny {
                    behavior: "deny".to_string(),
                    message: "User denied this action".to_string(),
                },
            },
        },
    };
    let mut line = serde_json::to_string(&resp).unwrap_or_default();
    line.push('\n');
    let _ = stdin_writer.write_all(line.as_bytes()).await;
    let _ = stdin_writer.flush().await;
}

pub(crate) async fn run_claude_connection(
    task_id: String,
    workspace: String,
    claude_bin: String,
    auto_approve: Arc<std::sync::atomic::AtomicBool>,
    app: tauri::AppHandle,
    perm_tx: mpsc::UnboundedSender<(
        String,
        String,
        String,
        Vec<PermissionOption>,
        oneshot::Sender<PermissionReply>,
    )>,
    cmd_rx: &mut mpsc::UnboundedReceiver<AcpCommand>,
    initial_mode_id: Option<String>,
    model: Option<String>,
    _tight_sandbox: bool,
    resume_session_id: Option<String>,
    // TASK-113: Optional output style; appended as `--output-style <name>` when spawning claude.
    output_style: Option<String>,
) -> Result<(), String> {
    let allowed_paths = Arc::new(parking_lot::Mutex::new(BTreeSet::new()));

    // Wait for the first prompt command before spawning claude
    let (first_prompt, first_attachments) = loop {
        match cmd_rx.recv().await {
            Some(AcpCommand::Prompt(text, atts)) => break (text, atts),
            Some(AcpCommand::Kill) | None => return Ok(()),
            _ => continue,
        }
    };

    // Extract paths from user message for sandbox
    let external_paths = extract_paths_from_message(&first_prompt);
    if !external_paths.is_empty() {
        let mut allowed = allowed_paths.lock();
        for p in &external_paths {
            allowed.insert(p.clone());
        }
    }

    // Build the content blocks
    let content = build_content_blocks(first_prompt.clone(), &first_attachments);
    // Build claude CLI args
    // NOTE: Do NOT combine -p with --input-format stream-json.
    // With stream-json input, claude ignores -p and waits for stdin JSON.
    // We send the first prompt via stdin after spawning.
    let mut args: Vec<String> = vec![
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--input-format".into(),
        "stream-json".into(),
    ];

    // Set permission mode: always use permission-prompt-tool for control_request flow
    args.push("--permission-prompt-tool".into());
    args.push("stdio".into());

    // Resume existing session if we have a session_id
    if let Some(ref sid) = resume_session_id {
        args.push("--resume".into());
        args.push(sid.clone());
    }

    // Set model if specified
    if let Some(ref m) = model {
        if !m.is_empty() {
            args.push("--model".into());
            args.push(m.clone());
        }
    }

    // TASK-113: Set output style if specified (e.g. --output-style Explanatory).
    // None / empty string means default — no flag appended. claude rejects unknown
    // names with a stderr error which propagates through the existing debug log.
    if let Some(ref style) = output_style {
        if !style.is_empty() {
            args.push("--output-style".into());
            args.push(style.clone());
        }
    }

    // Set initial mode (plan mode maps to --permission-mode plan,
    // custom agents map to --agent)
    if let Some(ref mode) = initial_mode_id {
        match mode.as_str() {
            "plan" => {
                args.push("--permission-mode".into());
                args.push("plan".into());
            }
            "default" | "" => {}
            agent => {
                args.push("--agent".into());
                args.push(agent.to_string());
            }
        }
    }

    // Klaudex manages its own session state; skip Claude's disk persistence
    args.push("--no-session-persistence".into());

    // Build a sanitized PATH: start with known safe directories, then
    // include only user PATH entries under trusted prefixes to prevent
    // command injection via PATH manipulation (CWE-78).
    let safe_prefixes: &[&str] = if cfg!(target_os = "macos") {
        &["/usr/", "/bin", "/opt/", "/Applications/", "/Library/"]
    } else {
        &["/usr/", "/bin", "/opt/", "/snap/"]
    };
    let base_paths = if cfg!(target_os = "macos") {
        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
    } else {
        "/usr/local/bin:/usr/bin:/bin"
    };
    let filtered_user_paths: String = std::env::var("PATH")
        .unwrap_or_default()
        .split(':')
        .filter(|p| safe_prefixes.iter().any(|prefix| p.starts_with(prefix)))
        .collect::<Vec<_>>()
        .join(":");
    let path_env = if filtered_user_paths.is_empty() {
        base_paths.to_string()
    } else {
        format!("{}:{}", base_paths, filtered_user_paths)
    };

    // Validate claude_bin to prevent arbitrary command execution (CWE-78).
    // The binary must be an absolute path under a trusted directory.
    let claude_path = std::path::Path::new(&claude_bin);
    if !claude_path.is_absolute() {
        return Err("Claude binary path must be absolute".to_string());
    }
    let allowed_bin_prefixes: &[&str] = if cfg!(target_os = "macos") {
        &["/usr/local/bin/", "/opt/homebrew/bin/", "/Applications/"]
    } else {
        &["/usr/local/bin/", "/usr/bin/", "/opt/", "/snap/"]
    };
    let home_bin = dirs::home_dir()
        .map(|h| h.join(".local/bin/").to_string_lossy().to_string());
    let home_claude_bin = dirs::home_dir()
        .map(|h| h.join(".claude/bin/").to_string_lossy().to_string());
    let is_allowed = allowed_bin_prefixes.iter().any(|p| claude_bin.starts_with(p))
        || home_bin.as_ref().map_or(false, |p| claude_bin.starts_with(p.as_str()))
        || home_claude_bin.as_ref().map_or(false, |p| claude_bin.starts_with(p.as_str()));
    if !is_allowed {
        return Err(format!(
            "Claude binary path is not in an approved location: {}",
            claude_bin
        ));
    }

    // Validate workspace directory exists (prevents cryptic spawn errors).
    let workspace_path = std::path::Path::new(&workspace);
    if !workspace_path.exists() {
        return Err(format!("Workspace directory does not exist: {}", workspace));
    }
    if !workspace_path.is_dir() {
        return Err(format!("Workspace path is not a directory: {}", workspace));
    }

    // Spawn claude CLI subprocess (use .current_dir for working directory;
    // claude CLI has no --cwd flag)
    let mut child = tokio::process::Command::new(&claude_bin)
        .args(&args)
        .current_dir(&workspace)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .env("PATH", &path_env)
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    let stdin = child.stdin.take().ok_or("No stdin")?;
    let stdout = child.stdout.take().ok_or("No stdout")?;
    let stderr = child.stderr.take().ok_or("No stderr")?;

    // Send the first prompt via stdin JSON (required with --input-format stream-json)
    let mut stdin_writer = stdin;
    {
        let content_value = serde_json::to_value(&content).unwrap_or_default();
        let first_msg = serde_json::json!({
            "type": "user",
            "message": {
                "role": "user",
                "content": content_value
            }
        });
        let mut line = serde_json::to_string(&first_msg).unwrap_or_default();
        line.push('\n');
        stdin_writer.write_all(line.as_bytes()).await
            .map_err(|e| format!("Failed to write first prompt to stdin: {e}"))?;
        stdin_writer.flush().await
            .map_err(|e| format!("Failed to flush stdin: {e}"))?;
    }

    // Pipe stderr to debug log
    let app_stderr = app.clone();
    let tid_stderr = task_id.clone();
    tokio::task::spawn_local(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let text = line.trim();
                    if !text.is_empty() {
                        use tauri::Emitter;
                        let _ = app_stderr.emit(
                            "debug_log",
                            serde_json::json!({
                                "direction": "in", "category": "stderr", "type": "stderr",
                                "taskId": tid_stderr, "summary": &text[..text.len().min(120)],
                                "payload": text, "isError": false
                            }),
                        );
                    }
                }
            }
        }
    });

    // Read ndjson from stdout and process messages
    let mut stdout_reader = BufReader::new(stdout);
    let mut killed = false;
    let mut line_buf = String::new();
    // Tracks when the current turn started (set on MessageStart, consumed on Result)
    let mut turn_start_ms: Option<u64> = None;

    // Process the initial prompt's response stream
    loop {
        line_buf.clear();
        tokio::select! {
            read_result = stdout_reader.read_line(&mut line_buf) => {
                match read_result {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        let trimmed = line_buf.trim();
                        if trimmed.is_empty() { continue; }
                        match serde_json::from_str::<ClaudeMessage>(trimmed) {
                            Ok(msg) => {
                                let is_result = matches!(&msg, ClaudeMessage::Result(_));
                                let is_idle = matches!(&msg, ClaudeMessage::System(s) if s.subtype == "session_state_changed" && s.extra.get("state").and_then(|v| v.as_str()) == Some("idle"));
                                handle_claude_message(&msg, &task_id, &app, &mut turn_start_ms);
                                if let ClaudeMessage::ControlRequest(ref cr) = msg {
                                    handle_control_request(cr, &task_id, &auto_approve, &mut stdin_writer, &perm_tx).await;
                                }
                                if is_result || is_idle {
                                    break;
                                }
                            }
                            Err(e) => {
                                log::debug!("[Claude] Failed to parse ndjson: {} — line: {}", e, trimmed);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("[Claude] stdout read error: {}", e);
                        break;
                    }
                }
            }
            maybe_cmd = cmd_rx.recv() => {
                match maybe_cmd {
                    Some(AcpCommand::Cancel) => {
                        // Send interrupt - kill the process and break
                        let _ = child.kill().await;
                        use tauri::Emitter;
                        let _ = app.emit("turn_end", serde_json::json!({"taskId": task_id, "stopReason": "cancelled"}));
                        killed = true;
                        break;
                    }
                    Some(AcpCommand::Kill) => {
                        killed = true;
                        break;
                    }
                    Some(AcpCommand::RespondUserInput(_req_id, response)) => {
                        let mut line = serde_json::to_string(&response).unwrap_or_default();
                        line.push('\n');
                        let _ = stdin_writer.write_all(line.as_bytes()).await;
                        let _ = stdin_writer.flush().await;
                    }
                    Some(AcpCommand::SteerInject(text, atts)) => {
                        // Hot-inject: write user message to stdin while agent is mid-turn.
                        let content = build_content_blocks(text, &atts);
                        let input_msg = serde_json::json!({
                            "type": "user",
                            "message": { "role": "user", "content": content }
                        });
                        let mut line = serde_json::to_string(&input_msg).unwrap_or_default();
                        line.push('\n');
                        let _ = stdin_writer.write_all(line.as_bytes()).await;
                        let _ = stdin_writer.flush().await;
                    }
                    Some(_) => {} // ignore other commands during active prompt
                    None => {
                        killed = true;
                        break;
                    }
                }
            }
        }
    }

    if killed {
        let _ = child.kill().await;
        return Ok(());
    }

    // Process follow-up commands (multi-turn)
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            // SteerInject arriving between turns is treated as a normal Prompt:
            // the agent is idle so there is nothing to interrupt mid-generation.
            AcpCommand::Prompt(text, attachments) | AcpCommand::SteerInject(text, attachments) => {
                // Extract paths for sandbox
                let external_paths = extract_paths_from_message(&text);
                if !external_paths.is_empty() {
                    let mut allowed = allowed_paths.lock();
                    for p in &external_paths {
                        allowed.insert(p.clone());
                    }
                }

                let content = build_content_blocks(text, &attachments);

                // Write the user message as ndjson to stdin
                let content_value = serde_json::to_value(&content).unwrap_or_default();
                let input_msg = serde_json::json!({
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": content_value
                    }
                });
                let mut line = serde_json::to_string(&input_msg).unwrap_or_default();
                line.push('\n');
                if let Err(e) = stdin_writer.write_all(line.as_bytes()).await {
                    log::error!("[Claude] Failed to write to stdin: {}", e);
                    use tauri::Emitter;
                    let _ = app.emit(
                        "task_error",
                        serde_json::json!({"taskId": task_id, "message": format!("Failed to send message: {e}")}),
                    );
                    break;
                }
                let _ = stdin_writer.flush().await;

                // Read response stream
                loop {
                    line_buf.clear();
                    tokio::select! {
                        read_result = stdout_reader.read_line(&mut line_buf) => {
                            match read_result {
                                Ok(0) => { killed = true; break; }
                                Ok(_) => {
                                    let trimmed = line_buf.trim();
                                    if trimmed.is_empty() { continue; }
                                    match serde_json::from_str::<ClaudeMessage>(trimmed) {
                                        Ok(msg) => {
                                            let is_result = matches!(&msg, ClaudeMessage::Result(_));
                                            let is_idle = matches!(&msg, ClaudeMessage::System(s) if s.subtype == "session_state_changed" && s.extra.get("state").and_then(|v| v.as_str()) == Some("idle"));
                                            handle_claude_message(&msg, &task_id, &app, &mut turn_start_ms);
                                            if let ClaudeMessage::ControlRequest(ref cr) = msg {
                                                handle_control_request(cr, &task_id, &auto_approve, &mut stdin_writer, &perm_tx).await;
                                            }
                                            if is_result || is_idle {
                                                break;
                                            }
                                        }
                                        Err(e) => {
                                            log::debug!("[Claude] parse error: {} — {}", e, trimmed);
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::error!("[Claude] stdout read error: {}", e);
                                    killed = true;
                                    break;
                                }
                            }
                        }
                        maybe_cmd = cmd_rx.recv() => {
                            match maybe_cmd {
                                Some(AcpCommand::Cancel) => {
                                    let _ = child.kill().await;
                                    use tauri::Emitter;
                                    let _ = app.emit("turn_end", serde_json::json!({"taskId": task_id, "stopReason": "cancelled"}));
                                    killed = true;
                                    break;
                                }
                                Some(AcpCommand::Kill) => {
                                    killed = true;
                                    break;
                                }
                                Some(AcpCommand::RespondUserInput(_req_id, response)) => {
                                    let mut line = serde_json::to_string(&response).unwrap_or_default();
                                    line.push('\n');
                                    let _ = stdin_writer.write_all(line.as_bytes()).await;
                                    let _ = stdin_writer.flush().await;
                                }
                                Some(AcpCommand::SteerInject(text, atts)) => {
                                    let content = build_content_blocks(text, &atts);
                                    let input_msg = serde_json::json!({
                                        "type": "user",
                                        "message": { "role": "user", "content": content }
                                    });
                                    let mut line = serde_json::to_string(&input_msg).unwrap_or_default();
                                    line.push('\n');
                                    let _ = stdin_writer.write_all(line.as_bytes()).await;
                                    let _ = stdin_writer.flush().await;
                                }
                                Some(_) => {}
                                None => { killed = true; break; }
                            }
                        }
                    }
                }
                if killed {
                    break;
                }
            }
            AcpCommand::Cancel => {
                let _ = child.kill().await;
                break;
            }
            AcpCommand::Kill => break,
            AcpCommand::SetMode(_mode_id) => {
                // Mode changes not directly supported in Claude CLI mid-session
                log::debug!("[Claude] SetMode ignored (not supported mid-session)");
            }
            AcpCommand::SetModel(_model_id) => {
                // Model changes mid-session are not supported by the Claude CLI
                // direct-mode subprocess; the renderer's next message will spawn
                // a fresh connection with the new model id baked into argv.
                log::debug!("[Claude] SetModel ignored (not supported mid-session)");
            }
            AcpCommand::ForkSession(reply_tx) => {
                let _ = reply_tx.send(Err("Fork not supported in direct Claude mode".to_string()));
            }
            AcpCommand::RespondUserInput(_request_id, response) => {
                let mut line = serde_json::to_string(&response).unwrap_or_default();
                line.push('\n');
                if let Err(e) = stdin_writer.write_all(line.as_bytes()).await {
                    log::error!("[Claude] Failed to write user input response: {}", e);
                }
                let _ = stdin_writer.flush().await;
            }
        }
    }

    // Check exit status and report errors
    match child.try_wait() {
        Ok(Some(status)) if !status.success() => {
            use tauri::Emitter;
            let _ = app.emit(
                "task_error",
                serde_json::json!({
                    "taskId": task_id,
                    "message": format!("Claude CLI exited with status: {}", status)
                }),
            );
        }
        _ => {
            let _ = child.kill().await;
        }
    }
    Ok(())
}
