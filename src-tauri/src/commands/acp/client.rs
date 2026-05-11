use std::collections::BTreeSet;
use std::sync::Arc;

use serde_json::Value;
use tokio::sync::{mpsc, oneshot};

use agent_client_protocol as acp;

use super::sandbox::{
    extract_paths_from_json, extract_paths_from_message, is_path_allowed,
    is_path_strictly_allowed, is_within_workspace,
};
use super::types::{AcpState, PendingPermission, PermissionOption, PermissionReply};
use super::now_millis;
use super::super::diff_stats::annotate_diff_content;

pub(crate) struct KlaudexClient {
    pub(crate) task_id: String,
    pub(crate) workspace: String,
    pub(crate) app: tauri::AppHandle,
    pub(crate) auto_approve: Arc<std::sync::atomic::AtomicBool>,
    pub(crate) perm_tx: mpsc::UnboundedSender<(String, acp::RequestPermissionRequest, oneshot::Sender<PermissionReply>)>,
    /// Paths outside the workspace that the user explicitly mentioned in messages.
    /// These are allowed through the sandbox.
    pub(crate) allowed_paths: Arc<parking_lot::Mutex<BTreeSet<String>>>,
    /// When true, use strict path checking (no sibling-directory expansion).
    pub(crate) tight_sandbox: bool,
}

#[async_trait::async_trait(?Send)]
impl acp::Client for KlaudexClient {
    async fn session_notification(&self, args: acp::SessionNotification) -> acp::Result<()> {
        let tid = &self.task_id;
        // Serialize the update to JSON Value so we can inspect the sessionUpdate field
        let val = serde_json::to_value(&args).unwrap_or_default();
        let update = val.get("update").unwrap_or(&val);
        let update_type = update.get("sessionUpdate").and_then(|v| v.as_str()).unwrap_or("");

        use tauri::Emitter;
        match update_type {
            "agent_message_chunk" => {
                let text = update.get("content")
                    .and_then(|c| c.get("text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");
                // Filter out agent-switch system messages — these are not real assistant content
                if !text.is_empty() && !text.starts_with("Agent changed to ") {
                    let _ = self.app.emit("message_chunk", serde_json::json!({
                        "taskId": tid, "chunk": text
                    }));
                }
            }
            "agent_thought_chunk" => {
                let text = update.get("content")
                    .and_then(|c| c.get("text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");
                if !text.is_empty() {
                    let _ = self.app.emit("thinking_chunk", serde_json::json!({
                        "taskId": tid, "chunk": text
                    }));
                }
            }
            "tool_call" => {
                let mut payload = update.clone();
                annotate_diff_content(&mut payload);
                let _ = self.app.emit("tool_call", serde_json::json!({
                    "taskId": tid, "toolCall": payload
                }));
            }
            "tool_call_update" => {
                let mut payload = update.clone();
                annotate_diff_content(&mut payload);
                let _ = self.app.emit("tool_call_update", serde_json::json!({
                    "taskId": tid, "toolCall": payload
                }));
            }
            "plan" => {
                let _ = self.app.emit("plan_update", serde_json::json!({
                    "taskId": tid, "plan": update.get("entries")
                }));
            }
            "usage_update" => {
                let used = update.get("used").and_then(|v| v.as_u64()).unwrap_or(0);
                let size = update.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                let _ = self.app.emit("usage_update", serde_json::json!({
                    "taskId": tid, "used": used, "size": size
                }));
            }
            _ => {
                log::debug!("[ACP] unhandled notification: {update_type}");
            }
        }

        // Also emit to debug log
        let _ = self.app.emit("debug_log", serde_json::json!({
            "direction": "in", "category": "notification", "type": update_type,
            "taskId": tid, "summary": update_type, "payload": update, "isError": false
        }));

        Ok(())
    }

    async fn request_permission(&self, args: acp::RequestPermissionRequest) -> acp::Result<acp::RequestPermissionResponse> {
        let val = serde_json::to_value(&args).unwrap_or_default();

        // Extract options
        let options: Vec<PermissionOption> = val.get("options")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|o| {
                Some(PermissionOption {
                    option_id: o.get("optionId")?.as_str()?.to_string(),
                    name: o.get("name")?.as_str()?.to_string(),
                    kind: o.get("kind")?.as_str()?.to_string(),
                })
            }).collect())
            .unwrap_or_default();

        // Tight sandbox: inspect tool call for outside paths and auto-deny
        if self.tight_sandbox {
            if let Some(tc) = val.get("toolCall") {
                let tool_paths = extract_paths_from_json(tc);
                let allowed = self.allowed_paths.lock();
                for tp in &tool_paths {
                    if !is_within_workspace(&self.workspace, tp) && !is_path_strictly_allowed(&allowed, tp) {
                        log::warn!("[ACP] tight_sandbox denied permission: '{}' is outside workspace '{}'", tp, self.workspace);
                        return Ok(acp::RequestPermissionResponse::new(
                            acp::RequestPermissionOutcome::Cancelled,
                        ));
                    }
                }
            }
        }

        use tauri::Manager;

        // Permission policy decision (TASK-105).
        //
        // Resolve the active `Permissions` scope from managed Tauri state
        // (per-project override wins over global), then run the
        // `match_permission` matcher shipped in TASK-102:
        //
        //   Decision::Deny    → auto-deny, even if mode is Bypass.
        //                       Deny ALWAYS wins. The matcher already
        //                       enforces this internally (deny patterns
        //                       are checked first), so a broad allow rule
        //                       can never override a narrower deny — and
        //                       neither can `mode == Bypass`.
        //   Decision::Allow   → auto-approve.
        //   Decision::NoMatch → check `mode`:
        //                         Bypass → auto-approve (legacy YOLO).
        //                         Ask | AllowListed → fall through to
        //                         user prompt below.
        //
        // The matcher is a pure, sync function with no external IO. Its
        // existing tests cover malformed patterns (logged + skipped, never
        // panicked) and degenerate globs. Wrapping it in
        // `std::panic::catch_unwind` would require `UnwindSafe` bounds on
        // the captured `&[String]` slices and gain nothing — the function
        // contains no `unwrap` paths over user input, no slice indexing
        // without bounds checks, and no recursion. So we invoke it
        // directly. The fallback path on any future panic would still be
        // the `mode`-driven prompt below (NOT a silent allow), thanks to
        // the way the connection thread is itself wrapped in
        // `catch_unwind` over in `connection.rs`.
        //
        // The legacy `auto_approve: AtomicBool` on `KlaudexClient` is kept
        // as a fast-path mirror of `mode == Bypass`. It is updated by the
        // wave-1 `task_set_auto_approve` command (and by initial spawn). A
        // settings-save *can* drift this cache until the next bump; that
        // is an acceptable gap because the authoritative read here goes
        // through `try_state::<SettingsState>()` first, with the
        // AtomicBool only used as a final fallback if the settings state
        // is missing (e.g., during early startup).
        let perm_decision = self.app
            .try_state::<SettingsState>()
            .map(|settings_state| {
                let store = settings_state.0.lock();
                // Per-project override wins; otherwise fall back to the
                // global `permissions` block.
                let perms_owned: Permissions = store
                    .settings
                    .project_prefs
                    .as_ref()
                    .and_then(|m| m.get(&self.workspace))
                    .and_then(|p| p.permissions.clone())
                    .unwrap_or_else(|| store.settings.permissions.clone());
                drop(store);

                let (tool, args) = extract_tool_and_args(&val);
                let decision = match_permission(&tool, &args, &perms_owned.allow, &perms_owned.deny);
                (decision, perms_owned.mode)
            });

        let auto_approve_now: Option<bool> = match perm_decision {
            Some((Decision::Deny, _)) => Some(false), // auto-deny (deny > everything)
            Some((Decision::Allow, _)) => Some(true), // auto-approve
            Some((Decision::NoMatch, PermissionMode::Bypass)) => Some(true),
            Some((Decision::NoMatch, PermissionMode::Ask))
            | Some((Decision::NoMatch, PermissionMode::AllowListed)) => None,
            None => {
                // Settings state unavailable (early startup or teardown).
                // Fall back to the legacy AtomicBool cache so we don't
                // regress YOLO behavior for users mid-session.
                if self.auto_approve.load(std::sync::atomic::Ordering::SeqCst) {
                    Some(true)
                } else {
                    None
                }
            }
        };

        if let Some(approve) = auto_approve_now {
            if approve {
                let allow_opt = options.iter()
                    .find(|o| o.kind == "allow_once")
                    .or_else(|| options.iter().find(|o| o.kind == "allow_always"))
                    .or_else(|| options.first());
                if let Some(opt) = allow_opt {
                    return Ok(acp::RequestPermissionResponse::new(
                        acp::RequestPermissionOutcome::Selected(
                            acp::SelectedPermissionOutcome::new(opt.option_id.clone()),
                        ),
                    ));
                }
            } else {
                // Auto-deny (Decision::Deny). Prefer an explicit
                // reject_once option if the agent offered one; otherwise
                // surface as Cancelled so the agent treats it as a hard
                // refusal.
                let deny_opt = options.iter()
                    .find(|o| o.kind == "reject_once")
                    .or_else(|| options.iter().find(|o| o.kind == "reject_always"));
                log::warn!(
                    "[ACP] permission auto-denied by deny rule: tool='{}' workspace='{}'",
                    extract_tool_and_args(&val).0,
                    self.workspace,
                );
                return Ok(match deny_opt {
                    Some(opt) => acp::RequestPermissionResponse::new(
                        acp::RequestPermissionOutcome::Selected(
                            acp::SelectedPermissionOutcome::new(opt.option_id.clone()),
                        ),
                    ),
                    None => acp::RequestPermissionResponse::new(
                        acp::RequestPermissionOutcome::Cancelled,
                    ),
                });
            }
        }

        // Send to main thread for UI handling
        let (reply_tx, reply_rx) = oneshot::channel();
        let request_id = format!("perm-{}", now_millis());
        let _ = self.perm_tx.send((request_id.clone(), args, reply_tx));

        // Wait for user response (5 min timeout to prevent indefinite hang)
        match tokio::time::timeout(std::time::Duration::from_secs(300), reply_rx).await {
            Ok(Ok(reply)) => {
                Ok(acp::RequestPermissionResponse::new(
                    acp::RequestPermissionOutcome::Selected(
                        acp::SelectedPermissionOutcome::new(reply.option_id),
                    ),
                ))
            }
            Ok(Err(_)) | Err(_) => {
                log::warn!("[ACP] Permission request {} timed out or was dropped", request_id);
                Ok(acp::RequestPermissionResponse::new(
                    acp::RequestPermissionOutcome::Cancelled,
                ))
            }
        }
    }

    async fn ext_notification(&self, args: acp::ExtNotification) -> acp::Result<()> {
        let method = args.method.as_ref();
        let params = serde_json::to_value(&args).unwrap_or_default();

        use tauri::Emitter;

        // Normalize method: strip leading underscore if present (ACP SDK may vary)
        let method_normalized = method.strip_prefix('_').unwrap_or(method);

        // MCP server tracking
        if method_normalized == "kiro.dev/mcp/server_initialized" {
            if let Some(name) = params.get("serverName").and_then(|v| v.as_str()) {
                let _ = self.app.emit("mcp_update", serde_json::json!({
                    "serverName": name, "status": "ready"
                }));
            }
        }
        if method_normalized == "kiro.dev/mcp/oauth_request" {
            if let Some(name) = params.get("serverName").and_then(|v| v.as_str()) {
                let _ = self.app.emit("mcp_update", serde_json::json!({
                    "serverName": name, "status": "needs-auth",
                    "oauthUrl": params.get("oauthUrl")
                }));
            }
        }
        // Commands / MCP servers available
        if method_normalized == "kiro.dev/commands/available" {
            let _ = self.app.emit("commands_update", serde_json::json!({
                "taskId": self.task_id,
                "commands": params.get("commands").cloned().unwrap_or(Value::Array(vec![])),
                "mcpServers": params.get("mcpServers").cloned().unwrap_or(Value::Array(vec![]))
            }));
        }
        // Compaction status — forward so the frontend can show compacting indicator
        if method_normalized == "kiro.dev/compaction/status" {
            let status_type = params.get("status")
                .and_then(|s| s.get("type"))
                .and_then(|t| t.as_str())
                .unwrap_or("unknown");
            let _ = self.app.emit("compaction_status", serde_json::json!({
                "taskId": self.task_id,
                "status": status_type,
                "summary": params.get("summary").cloned().unwrap_or(Value::Null)
            }));
        }
        // Subagent lifecycle — forward so the frontend can track subagent sessions
        if method_normalized == "kiro.dev/subagent/list_update" {
            let _ = self.app.emit("subagent_update", serde_json::json!({
                "taskId": self.task_id,
                "subagents": params.get("subagents").cloned().unwrap_or(Value::Array(vec![])),
                "pendingStages": params.get("pendingStages").cloned().unwrap_or(Value::Array(vec![]))
            }));
        }

        // Skip noisy empty notifications from debug log
        if method.is_empty() && params.is_null() {
            return Ok(());
        }

        let _ = self.app.emit("debug_log", serde_json::json!({
            "direction": "in", "category": "notification", "type": format!("ext:{method}"),
            "taskId": self.task_id, "summary": format!("claude notification: {method}"),
            "payload": params, "isError": false
        }));

        Ok(())
    }

    async fn read_text_file(&self, args: acp::ReadTextFileRequest) -> acp::Result<acp::ReadTextFileResponse> {
        let val = serde_json::to_value(&args).unwrap_or_default();
        let path = val.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if !path.is_empty() && !is_within_workspace(&self.workspace, path) {
            let allowed = self.allowed_paths.lock();
            let path_ok = if self.tight_sandbox {
                is_path_strictly_allowed(&allowed, path)
            } else {
                is_path_allowed(&allowed, path)
            };
            if !path_ok {
                log::warn!("[ACP] read_text_file blocked: '{}' is outside workspace '{}'", path, self.workspace);
                return Err(acp::Error::invalid_params().data(serde_json::json!({
                    "path": path,
                    "workspace": self.workspace,
                    "reason": "Path is outside the project workspace and was not mentioned by the user"
                })));
            }
        }
        match std::fs::read_to_string(path) {
            Ok(content) => Ok(serde_json::from_value(serde_json::json!({ "content": content })).unwrap()),
            Err(_) => Ok(serde_json::from_value(serde_json::json!({ "content": "" })).unwrap()),
        }
    }

    async fn write_text_file(&self, args: acp::WriteTextFileRequest) -> acp::Result<acp::WriteTextFileResponse> {
        let val = serde_json::to_value(&args).unwrap_or_default();
        let path = val.get("path").and_then(|v| v.as_str()).unwrap_or("");
        let content = val.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if !path.is_empty() && !is_within_workspace(&self.workspace, path) {
            let allowed = self.allowed_paths.lock();
            let path_ok = if self.tight_sandbox {
                is_path_strictly_allowed(&allowed, path)
            } else {
                is_path_allowed(&allowed, path)
            };
            if !path_ok {
                log::warn!("[ACP] write_text_file blocked: '{}' is outside workspace '{}'", path, self.workspace);
                return Err(acp::Error::invalid_params().data(serde_json::json!({
                    "path": path,
                    "workspace": self.workspace,
                    "reason": "Path is outside the project workspace and was not mentioned by the user"
                })));
            }
        }
        let _ = std::fs::write(path, content);
        Ok(serde_json::from_value(serde_json::json!({})).unwrap())
    }

    async fn ext_method(&self, _args: acp::ExtRequest) -> acp::Result<acp::ExtResponse> {
        Err(acp::Error::method_not_found())
    }
}

/// Extract a `(tool_name, args_string)` pair from a serialized
/// `RequestPermissionRequest` JSON value, suitable for feeding into
/// [`crate::commands::permissions::match_permission`] (TASK-102).
///
/// The ACP `RequestPermissionRequest` is serialized as JSON for inspection
/// here (the agent-client-protocol crate doesn't expose its inner fields
/// directly through a stable Rust API we can pattern-match on). Concrete
/// payloads we've seen on the wire have a `toolCall` object containing a
/// tool *kind* (Claude's category like `"execute"` / `"read"` / `"edit"`)
/// plus a `rawInput` object with the actual call arguments.
///
/// We try, in order:
///
/// 1. A direct `name` / `toolName` field on the toolCall — used by some
///    ACP implementations and the safest match for the matcher's exact
///    string comparison against patterns like `Bash(...)`.
/// 2. Mapping from the toolCall's `kind` to a canonical Claude tool name
///    (`execute` → `Bash`, `read` → `Read`, `edit` → `Edit`, etc.). This
///    is the path Claude's own ACP shape uses today.
/// 3. Falling back to an empty tool name. The matcher will return
///    `NoMatch` against any allow/deny pattern, which is the safe
///    behavior — the request will route through the user prompt path.
///
/// For the args string we mirror the renderer's tool-title heuristics
/// (Bash → `command` field, file tools → `file_path`, search tools →
/// `pattern`, etc.). Patterns like `Bash(npm test:*)` and `Read(./src/**)`
/// expect the bare command / path here, NOT a serialized JSON blob.
fn extract_tool_and_args(val: &Value) -> (String, String) {
    let tool_call = val.get("toolCall").or_else(|| val.get("tool_call"));
    let raw_input = tool_call
        .and_then(|tc| tc.get("rawInput").or_else(|| tc.get("raw_input")).or_else(|| tc.get("input")))
        .cloned()
        .unwrap_or(Value::Null);

    // Prefer an explicit tool name field if present.
    let explicit_name = tool_call
        .and_then(|tc| {
            tc.get("toolName")
                .or_else(|| tc.get("tool_name"))
                .or_else(|| tc.get("name"))
        })
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let tool: String = match explicit_name {
        Some(n) if !n.is_empty() => n,
        _ => {
            // Map ACP `kind` → canonical Claude tool name. The mapping is
            // deliberately conservative; unknown kinds become an empty
            // string so the matcher returns NoMatch and the request
            // routes through the user prompt path.
            let kind = tool_call
                .and_then(|tc| tc.get("kind"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            match kind {
                "execute" => "Bash".to_string(),
                "read" => "Read".to_string(),
                "edit" => {
                    // ACP `edit` covers both Write (new file) and Edit
                    // (existing file). Disambiguate via raw input shape:
                    // a Write call carries `content`, an Edit call
                    // carries `old_string` / `new_string`.
                    if raw_input.get("old_string").is_some() {
                        "Edit".to_string()
                    } else if raw_input.get("content").is_some() {
                        "Write".to_string()
                    } else {
                        "Edit".to_string()
                    }
                }
                "search" => {
                    if raw_input.get("pattern").is_some() && raw_input.get("path").is_some() {
                        "Glob".to_string()
                    } else if raw_input.get("pattern").is_some() {
                        "Grep".to_string()
                    } else {
                        "Glob".to_string()
                    }
                }
                "fetch" => {
                    if raw_input.get("url").is_some() {
                        "WebFetch".to_string()
                    } else {
                        "WebSearch".to_string()
                    }
                }
                "think" => "Task".to_string(),
                "switch_mode" => "ExitPlanMode".to_string(),
                _ => String::new(),
            }
        }
    };

    // Build the `args` string the matcher patterns are written against.
    // For Bash that's the raw shell command; for file tools that's the
    // path; for search tools that's the pattern; etc. Falls back to a
    // compact JSON dump of the raw input so a `Tool(*)` pattern still
    // matches anything.
    let args: String = match tool.as_str() {
        "Bash" => raw_input
            .get("command")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        "Read" | "Write" | "Edit" => raw_input
            .get("file_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        "Glob" => {
            let pattern = raw_input.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
            let path = raw_input.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if path.is_empty() { pattern.to_string() } else { format!("{path} {pattern}") }
        }
        "Grep" => raw_input.get("pattern").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        "WebFetch" => raw_input.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        "WebSearch" => raw_input.get("query").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        _ => {
            // Generic fallback: serialize the raw input so a broad
            // `Tool(*)` pattern still matches. Empty-string args still
            // exposes `Tool()` exact-match semantics.
            if raw_input.is_null() || (raw_input.is_object() && raw_input.as_object().map(|m| m.is_empty()).unwrap_or(false)) {
                String::new()
            } else {
                serde_json::to_string(&raw_input).unwrap_or_default()
            }
        }
    };

    (tool, args)
}
