//! Claude Agent SDK wire protocol types.
//!
//! These types represent the ndjson messages that the Claude CLI emits on stdout
//! when invoked with `--output-format stream-json`. Reverse-engineered from the
//! TypeScript `@anthropic-ai/claude-agent-sdk` source and the official streaming
//! output documentation.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ── Top-level message envelope ─────────────────────────────────────────

/// Every ndjson line from the Claude CLI is one of these variants.
/// We use an untagged enum with `type` field matching.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeMessage {
    #[serde(rename = "system")]
    System(SystemMessage),
    #[serde(rename = "result")]
    Result(ResultMessage),
    #[serde(rename = "stream_event")]
    StreamEvent(StreamEventMessage),
    #[serde(rename = "user")]
    User(ConversationMessage),
    #[serde(rename = "assistant")]
    Assistant(AssistantConversationMessage),
    #[serde(rename = "tool_progress")]
    ToolProgress(ToolProgressMessage),
    #[serde(rename = "tool_use_summary")]
    ToolUseSummary(Value),
    #[serde(rename = "auth_status")]
    AuthStatus(Value),
    #[serde(rename = "prompt_suggestion")]
    PromptSuggestion(Value),
    #[serde(rename = "rate_limit_event")]
    RateLimitEvent(Value),
    #[serde(rename = "control_request")]
    ControlRequest(ControlRequestMessage),
}

// ── Control request/response (permission prompt tool protocol) ─────────

#[derive(Debug, Clone, Deserialize)]
pub struct ControlRequestMessage {
    pub request_id: String,
    pub request: ControlRequestBody,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ControlRequestBody {
    pub subtype: String,
    #[serde(default)]
    pub tool_name: Option<String>,
    #[serde(default)]
    pub input: Option<Value>,
    #[serde(default)]
    pub decision_reason: Option<String>,
    #[serde(default)]
    pub tool_use_id: Option<String>,
}

/// JSON written to Claude's stdin to respond to a control_request.
#[derive(Debug, Clone, Serialize)]
pub struct ControlResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub response: ControlResponseBody,
}

#[derive(Debug, Clone, Serialize)]
pub struct ControlResponseBody {
    pub subtype: String,
    pub request_id: String,
    pub response: ControlResponseAction,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum ControlResponseAction {
    Allow {
        behavior: String,
        #[serde(rename = "updatedInput")]
        updated_input: Value,
    },
    Deny {
        behavior: String,
        message: String,
    },
}

// ── System messages ────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct SystemMessage {
    pub subtype: String,
    #[serde(default)]
    pub session_id: Option<String>,
    /// For subtype "init"
    #[serde(default)]
    pub data: Option<Value>,
    /// For subtype "status"
    #[serde(default)]
    pub status: Option<String>,
    /// For subtype "local_command_output"
    #[serde(default)]
    pub content: Option<String>,
    /// Catch-all for other fields
    #[serde(flatten)]
    pub extra: Value,
}

// ── Result messages ────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ResultMessage {
    pub subtype: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub is_error: Option<bool>,
    #[serde(default)]
    pub stop_reason: Option<String>,
    #[serde(default)]
    pub total_cost_usd: Option<f64>,
    #[serde(default)]
    pub usage: Option<UsageInfo>,
    #[serde(default, rename = "modelUsage")]
    pub model_usage: Option<Value>,
    #[serde(default)]
    pub errors: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct UsageInfo {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_read_input_tokens: u64,
    #[serde(default)]
    pub cache_creation_input_tokens: u64,
}

// ── Stream event messages ──────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct StreamEventMessage {
    pub event: StreamEvent,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub parent_tool_use_id: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

/// Raw Claude API streaming event.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart {
        message: MessageStartData,
    },
    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        index: u32,
        content_block: ContentBlock,
    },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta {
        index: u32,
        delta: ContentDelta,
    },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop {
        index: u32,
    },
    #[serde(rename = "message_delta")]
    MessageDelta {
        #[serde(default)]
        usage: Option<MessageDeltaUsage>,
        #[serde(default)]
        delta: Option<Value>,
    },
    #[serde(rename = "message_stop")]
    MessageStop {},
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageStartData {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub usage: Option<MessageStartUsage>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct MessageStartUsage {
    #[serde(default)]
    pub input_tokens: Option<u64>,
    #[serde(default)]
    pub output_tokens: Option<u64>,
    #[serde(default)]
    pub cache_read_input_tokens: Option<u64>,
    #[serde(default)]
    pub cache_creation_input_tokens: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct MessageDeltaUsage {
    #[serde(default)]
    pub input_tokens: Option<u64>,
    #[serde(default)]
    pub output_tokens: Option<u64>,
    #[serde(default)]
    pub cache_read_input_tokens: Option<u64>,
    #[serde(default)]
    pub cache_creation_input_tokens: Option<u64>,
}

// ── Content blocks ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text {
        #[serde(default)]
        text: String,
    },
    #[serde(rename = "thinking")]
    Thinking {
        #[serde(default)]
        thinking: String,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        #[serde(default)]
        input: Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        #[serde(default)]
        content: Value,
        #[serde(default)]
        is_error: Option<bool>,
    },
    #[serde(rename = "server_tool_use")]
    ServerToolUse {
        id: String,
        name: String,
        #[serde(default)]
        input: Value,
    },
    #[serde(rename = "mcp_tool_use")]
    McpToolUse {
        id: String,
        name: String,
        #[serde(default)]
        input: Value,
    },
    #[serde(rename = "mcp_tool_result")]
    McpToolResult {
        tool_use_id: String,
        #[serde(default)]
        content: Value,
        #[serde(default)]
        is_error: Option<bool>,
    },
    #[serde(other)]
    Unknown,
}

// ── Content deltas ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ContentDelta {
    #[serde(rename = "text_delta")]
    TextDelta {
        text: String,
    },
    #[serde(rename = "thinking_delta")]
    ThinkingDelta {
        thinking: String,
    },
    #[serde(rename = "input_json_delta")]
    InputJsonDelta {
        partial_json: String,
    },
    #[serde(rename = "citations_delta")]
    CitationsDelta {
        #[serde(flatten)]
        extra: Value,
    },
    #[serde(rename = "signature_delta")]
    SignatureDelta {
        #[serde(flatten)]
        extra: Value,
    },
    #[serde(other)]
    Unknown,
}

// ── Conversation messages (user/assistant) ─────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ConversationMessage {
    pub message: ConversationMessageInner,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub parent_tool_use_id: Option<String>,
    #[serde(default)]
    pub uuid: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantConversationMessage {
    pub message: AssistantMessageInner,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub parent_tool_use_id: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConversationMessageInner {
    pub role: String,
    pub content: Value,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantMessageInner {
    pub role: String,
    pub content: Value,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub usage: Option<MessageStartUsage>,
    #[serde(flatten)]
    pub extra: Value,
}

// ── Tool progress ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ToolProgressMessage {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

// ── Input message (what we write to Claude's stdin) ────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeUserInput {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub message: ClaudeUserInputMessage,
    pub session_id: String,
    pub parent_tool_use_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeUserInputMessage {
    pub role: String,
    pub content: Vec<ClaudeInputContent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ClaudeInputContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { source: ImageSource },
}

#[derive(Debug, Clone, Serialize)]
pub struct ImageSource {
    #[serde(rename = "type")]
    pub source_type: String,
    pub data: String,
    pub media_type: String,
}

// ── Tool info helpers (matching TS toolInfoFromToolUse) ─────────────────

/// Derive a human-readable title and kind from a tool_use content block.
pub fn tool_title_and_kind(name: &str, input: &Value) -> (String, String) {
    match name {
        "Agent" | "Task" => {
            let desc = input.get("description").and_then(|v| v.as_str()).unwrap_or("Task");
            (desc.to_string(), "think".to_string())
        }
        "Bash" => {
            let cmd = input.get("command").and_then(|v| v.as_str()).unwrap_or("Terminal");
            (cmd.to_string(), "execute".to_string())
        }
        "Read" => {
            let path = input.get("file_path").and_then(|v| v.as_str()).unwrap_or("File");
            (format!("Read {path}"), "read".to_string())
        }
        "Write" => {
            let path = input.get("file_path").and_then(|v| v.as_str()).unwrap_or("File");
            (format!("Write {path}"), "edit".to_string())
        }
        "Edit" => {
            let path = input.get("file_path").and_then(|v| v.as_str()).unwrap_or("File");
            (format!("Edit {path}"), "edit".to_string())
        }
        "Glob" => {
            let pattern = input.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
            let path = input.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let mut label = "Find".to_string();
            if !path.is_empty() { label.push_str(&format!(" `{path}`")); }
            if !pattern.is_empty() { label.push_str(&format!(" `{pattern}`")); }
            (label, "search".to_string())
        }
        "Grep" => {
            let pattern = input.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
            (format!("grep \"{pattern}\""), "search".to_string())
        }
        "WebFetch" => {
            let url = input.get("url").and_then(|v| v.as_str()).unwrap_or("URL");
            (format!("Fetch {url}"), "fetch".to_string())
        }
        "WebSearch" => {
            let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("Web search");
            (format!("\"{query}\""), "fetch".to_string())
        }
        "TodoWrite" => ("Update TODOs".to_string(), "think".to_string()),
        "ExitPlanMode" => ("Ready to code?".to_string(), "switch_mode".to_string()),
        _ => (name.to_string(), "other".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_system_init() {
        let json = r#"{"type":"system","subtype":"init","session_id":"abc","data":{"session_id":"abc"}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::System(s) => {
                assert_eq!(s.subtype, "init");
                assert_eq!(s.session_id.as_deref(), Some("abc"));
            }
            _ => panic!("expected System"),
        }
    }

    #[test]
    fn parse_system_status_compacting() {
        let json = r#"{"type":"system","subtype":"status","session_id":"s1","status":"compacting"}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::System(s) => {
                assert_eq!(s.subtype, "status");
                assert_eq!(s.status.as_deref(), Some("compacting"));
            }
            _ => panic!("expected System"),
        }
    }

    #[test]
    fn parse_result_success() {
        let json = r#"{"type":"result","subtype":"success","session_id":"s1","result":"done","is_error":false,"stop_reason":"end_turn","total_cost_usd":0.01,"usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::Result(r) => {
                assert_eq!(r.subtype, "success");
                assert_eq!(r.stop_reason.as_deref(), Some("end_turn"));
                assert_eq!(r.usage.as_ref().unwrap().input_tokens, 100);
            }
            _ => panic!("expected Result"),
        }
    }

    #[test]
    fn parse_stream_event_text_delta() {
        let json = r#"{"type":"stream_event","session_id":"s1","parent_tool_use_id":null,"event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::StreamEvent(se) => {
                match se.event {
                    StreamEvent::ContentBlockDelta { delta, .. } => {
                        match delta {
                            ContentDelta::TextDelta { text } => assert_eq!(text, "Hello"),
                            _ => panic!("expected TextDelta"),
                        }
                    }
                    _ => panic!("expected ContentBlockDelta"),
                }
            }
            _ => panic!("expected StreamEvent"),
        }
    }

    #[test]
    fn parse_stream_event_tool_use_start() {
        let json = r#"{"type":"stream_event","session_id":"s1","parent_tool_use_id":null,"event":{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"Read","input":{}}}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::StreamEvent(se) => {
                match se.event {
                    StreamEvent::ContentBlockStart { content_block, .. } => {
                        match content_block {
                            ContentBlock::ToolUse { id, name, .. } => {
                                assert_eq!(id, "tu_1");
                                assert_eq!(name, "Read");
                            }
                            _ => panic!("expected ToolUse"),
                        }
                    }
                    _ => panic!("expected ContentBlockStart"),
                }
            }
            _ => panic!("expected StreamEvent"),
        }
    }

    #[test]
    fn parse_stream_event_thinking_delta() {
        let json = r#"{"type":"stream_event","session_id":"s1","parent_tool_use_id":null,"event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think..."}}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::StreamEvent(se) => {
                match se.event {
                    StreamEvent::ContentBlockDelta { delta, .. } => {
                        match delta {
                            ContentDelta::ThinkingDelta { thinking } => assert_eq!(thinking, "Let me think..."),
                            _ => panic!("expected ThinkingDelta"),
                        }
                    }
                    _ => panic!("expected ContentBlockDelta"),
                }
            }
            _ => panic!("expected StreamEvent"),
        }
    }

    #[test]
    fn parse_stream_event_message_start() {
        let json = r#"{"type":"stream_event","session_id":"s1","parent_tool_use_id":null,"event":{"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-4-20250514","usage":{"input_tokens":500,"output_tokens":0}}}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::StreamEvent(se) => {
                match se.event {
                    StreamEvent::MessageStart { message } => {
                        assert_eq!(message.model.as_deref(), Some("claude-sonnet-4-20250514"));
                        assert_eq!(message.usage.as_ref().unwrap().input_tokens, Some(500));
                    }
                    _ => panic!("expected MessageStart"),
                }
            }
            _ => panic!("expected StreamEvent"),
        }
    }

    #[test]
    fn parse_assistant_message() {
        let json = r#"{"type":"assistant","session_id":"s1","parent_tool_use_id":null,"message":{"role":"assistant","model":"claude-sonnet-4-20250514","content":[{"type":"text","text":"Hello!"}],"usage":{"input_tokens":10,"output_tokens":5}}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::Assistant(a) => {
                assert_eq!(a.message.role, "assistant");
                assert_eq!(a.message.model.as_deref(), Some("claude-sonnet-4-20250514"));
            }
            _ => panic!("expected Assistant"),
        }
    }

    #[test]
    fn parse_user_message() {
        let json = r#"{"type":"user","session_id":"s1","parent_tool_use_id":null,"uuid":"u1","message":{"role":"user","content":[{"type":"text","text":"Hi"}]}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::User(u) => {
                assert_eq!(u.message.role, "user");
                assert_eq!(u.uuid.as_deref(), Some("u1"));
            }
            _ => panic!("expected User"),
        }
    }

    #[test]
    fn parse_result_error() {
        let json = r#"{"type":"result","subtype":"error_during_execution","session_id":"s1","is_error":true,"errors":["something failed"],"stop_reason":"end_turn","usage":{"input_tokens":0,"output_tokens":0,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClaudeMessage::Result(r) => {
                assert_eq!(r.subtype, "error_during_execution");
                assert!(r.is_error.unwrap_or(false));
                assert_eq!(r.errors.as_ref().unwrap()[0], "something failed");
            }
            _ => panic!("expected Result"),
        }
    }

    #[test]
    fn parse_tool_progress() {
        let json = r#"{"type":"tool_progress","session_id":"s1"}"#;
        let msg: ClaudeMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClaudeMessage::ToolProgress(_)));
    }

    #[test]
    fn tool_title_read() {
        let input = serde_json::json!({"file_path": "/src/main.rs"});
        let (title, kind) = tool_title_and_kind("Read", &input);
        assert_eq!(title, "Read /src/main.rs");
        assert_eq!(kind, "read");
    }

    #[test]
    fn tool_title_bash() {
        let input = serde_json::json!({"command": "ls -la"});
        let (title, kind) = tool_title_and_kind("Bash", &input);
        assert_eq!(title, "ls -la");
        assert_eq!(kind, "execute");
    }

    #[test]
    fn tool_title_edit() {
        let input = serde_json::json!({"file_path": "/src/lib.rs"});
        let (title, kind) = tool_title_and_kind("Edit", &input);
        assert_eq!(title, "Edit /src/lib.rs");
        assert_eq!(kind, "edit");
    }

    #[test]
    fn tool_title_unknown() {
        let input = serde_json::json!({});
        let (title, kind) = tool_title_and_kind("CustomTool", &input);
        assert_eq!(title, "CustomTool");
        assert_eq!(kind, "other");
    }

    #[test]
    fn serialize_user_input() {
        let input = ClaudeUserInput {
            msg_type: "user".to_string(),
            message: ClaudeUserInputMessage {
                role: "user".to_string(),
                content: vec![ClaudeInputContent::Text { text: "Hello".to_string() }],
            },
            session_id: "s1".to_string(),
            parent_tool_use_id: None,
            uuid: Some("u1".to_string()),
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("\"type\":\"user\""));
        assert!(json.contains("\"text\":\"Hello\""));
        assert!(json.contains("\"uuid\":\"u1\""));
    }
}
