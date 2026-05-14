use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

use super::error::AppError;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAgentHook {
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matcher: Option<String>,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAgentHooks {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub agent_spawn: Vec<ClaudeAgentHook>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub user_prompt_submit: Vec<ClaudeAgentHook>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub pre_tool_use: Vec<ClaudeAgentHook>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub post_tool_use: Vec<ClaudeAgentHook>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub stop: Vec<ClaudeAgentHook>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAgent {
    pub name: String,
    pub description: String,
    pub tools: Vec<String>,
    pub source: String,
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub welcome_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyboard_shortcut: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub resources: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hooks: Option<ClaudeAgentHooks>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudePrompt {
    pub name: String,
    pub content: String,
    pub source: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSkill {
    pub name: String,
    pub source: String,
    pub file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_excerpt: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSteeringRule {
    pub name: String,
    pub always_apply: bool,
    pub source: String,
    pub excerpt: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMcpServer {
    pub name: String,
    pub enabled: bool,
    pub transport: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled_tools: Option<Vec<String>>,
    pub file_path: String,
    /// "global" (~/.claude/mcp.json) or "local" (<project>/.claude/mcp.json).
    /// When the same server name appears in both, the local entry wins.
    pub source: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCommand {
    pub name: String,
    pub source: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeConfig {
    pub agents: Vec<ClaudeAgent>,
    pub commands: Vec<ClaudeCommand>,
    pub skills: Vec<ClaudeSkill>,
    pub steering_rules: Vec<ClaudeSteeringRule>,
    pub memory_files: Vec<ClaudeSteeringRule>,
    pub mcp_servers: Vec<ClaudeMcpServer>,
    pub prompts: Vec<ClaudePrompt>,
}

fn source_str(is_global: bool) -> &'static str {
    if is_global { "global" } else { "local" }
}

fn parse_steering_frontmatter(content: &str) -> (bool, String) {
    let mut always_apply = false;
    let mut body = content;
    if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("\n---") {
            let fm = &content[3..3 + end_idx];
            body = &content[3 + end_idx + 4..];
            for line in fm.lines() {
                let line = line.trim();
                if line.starts_with("alwaysApply") {
                    if let Some(val) = line.split(':').nth(1) {
                        always_apply = val.trim() == "true";
                    }
                }
            }
        }
    }
    let excerpt = body
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .take(1)
        .collect::<Vec<_>>()
        .join("");
    let excerpt = if excerpt.len() > 120 { excerpt[..120].to_string() } else { excerpt };
    (always_apply, excerpt)
}

fn parse_agent_hooks(obj: &serde_json::Map<String, serde_json::Value>) -> Option<ClaudeAgentHooks> {
    let hooks_val = obj.get("hooks")?;
    let hooks_obj = hooks_val.as_object()?;

    fn parse_hook_list(val: &serde_json::Value) -> Vec<ClaudeAgentHook> {
        val.as_array().map(|arr| {
            arr.iter().filter_map(|h| {
                let cmd = h.get("command")?.as_str()?.to_string();
                let matcher = h.get("matcher").and_then(|v| v.as_str()).map(String::from);
                Some(ClaudeAgentHook { command: cmd, matcher })
            }).collect()
        }).unwrap_or_default()
    }

    let hooks = ClaudeAgentHooks {
        agent_spawn: hooks_obj.get("agentSpawn").map(parse_hook_list).unwrap_or_default(),
        user_prompt_submit: hooks_obj.get("userPromptSubmit").map(parse_hook_list).unwrap_or_default(),
        pre_tool_use: hooks_obj.get("preToolUse").map(parse_hook_list).unwrap_or_default(),
        post_tool_use: hooks_obj.get("postToolUse").map(parse_hook_list).unwrap_or_default(),
        stop: hooks_obj.get("stop").map(parse_hook_list).unwrap_or_default(),
    };

    // Only return Some if at least one hook is defined
    let has_hooks = !hooks.agent_spawn.is_empty()
        || !hooks.user_prompt_submit.is_empty()
        || !hooks.pre_tool_use.is_empty()
        || !hooks.post_tool_use.is_empty()
        || !hooks.stop.is_empty();
    if has_hooks { Some(hooks) } else { None }
}

fn scan_agents(base: &Path, is_global: bool) -> Vec<ClaudeAgent> {
    let dir = base.join("agents");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            (name.ends_with(".json") || name.ends_with(".md")) && !name.starts_with('.')
        })
        .filter_map(|e| {
            let fp = e.path();
            let content = fs::read_to_string(&fp).ok()?;
            let file_name = fp.file_stem()?.to_string_lossy().to_string();
            let ext = fp.extension()?.to_string_lossy().to_string();
            if ext == "json" {
                let raw: serde_json::Value = serde_json::from_str(&content).ok()?;
                let obj = raw.as_object()?;
                Some(ClaudeAgent {
                    name: obj.get("name").and_then(|v| v.as_str()).unwrap_or(&file_name).to_string(),
                    description: obj.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    tools: obj.get("tools").and_then(|v| v.as_array()).map(|a| {
                        a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                    }).unwrap_or_default(),
                    source: source.to_string(),
                    file_path: fp.to_string_lossy().to_string(),
                    welcome_message: obj.get("welcomeMessage").and_then(|v| v.as_str()).map(String::from),
                    keyboard_shortcut: obj.get("keyboardShortcut").and_then(|v| v.as_str()).map(String::from),
                    model: obj.get("model").and_then(|v| v.as_str()).map(String::from),
                    resources: obj.get("resources").and_then(|v| v.as_array()).map(|a| {
                        a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                    }).unwrap_or_default(),
                    hooks: parse_agent_hooks(obj),
                })
            } else {
                // .md file with YAML frontmatter
                parse_agent_md(&content, &file_name, &fp, source)
            }
        })
        .collect()
}

/// Parse a `.md` agent file with YAML frontmatter (used by `~/.claude/agents/`).
fn parse_agent_md(content: &str, file_name: &str, fp: &Path, source: &str) -> Option<ClaudeAgent> {
    if !content.starts_with("---") {
        return None;
    }
    let end_idx = content[3..].find("\n---")?;
    let fm = &content[3..3 + end_idx];
    let yaml: serde_yaml::Value = serde_yaml::from_str(fm).ok()?;
    let obj = yaml.as_mapping()?;
    let get_str = |key: &str| -> Option<String> {
        obj.get(&serde_yaml::Value::String(key.to_string()))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
    };
    let get_str_vec = |key: &str| -> Vec<String> {
        obj.get(&serde_yaml::Value::String(key.to_string()))
            .and_then(|v| v.as_sequence())
            .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default()
    };
    Some(ClaudeAgent {
        name: get_str("name").unwrap_or_else(|| file_name.to_string()),
        description: get_str("description").unwrap_or_default(),
        tools: get_str_vec("tools"),
        source: source.to_string(),
        file_path: fp.to_string_lossy().to_string(),
        welcome_message: get_str("welcomeMessage"),
        keyboard_shortcut: get_str("keyboardShortcut"),
        model: get_str("model"),
        resources: get_str_vec("resources"),
        hooks: None,
    })
}

/// Split a SKILL.md file's contents into `(frontmatter_yaml, body)`.
///
/// Returns `(None, full_content)` if the file does not start with a `---` fence
/// or the closing `\n---` is missing. Matches the same `---` framing used by
/// `parse_agent_md` and `parse_steering_frontmatter`, but returns the body so
/// callers can derive an excerpt independently of the frontmatter parsing.
fn split_frontmatter(content: &str) -> (Option<&str>, &str) {
    if !content.starts_with("---") {
        return (None, content);
    }
    let Some(end_idx) = content[3..].find("\n---") else {
        return (None, content);
    };
    let fm = &content[3..3 + end_idx];
    // Skip past `\n---` (4 chars). The body may then begin with a newline; that's fine —
    // the excerpt logic trims/filters lines.
    let body = &content[3 + end_idx + 4..];
    (Some(fm), body)
}

/// Produce a short excerpt of a SKILL.md body, skipping heading lines and
/// truncating to ~200 chars on a UTF-8 char boundary. Matches the spirit of
/// `parse_steering_frontmatter`'s excerpt logic but with a longer cap so the
/// Skills Palette can show a meaningful preview.
fn skill_body_excerpt(body: &str) -> Option<String> {
    let collected: String = body
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .take(5)
        .collect::<Vec<_>>()
        .join(" ");
    if collected.is_empty() {
        return None;
    }
    // Char-boundary safe truncation. `floor_char_boundary` is unstable, so walk
    // backward from the target index until we hit a char boundary.
    const MAX: usize = 200;
    if collected.len() <= MAX {
        Some(collected)
    } else {
        let mut cut = MAX;
        while cut > 0 && !collected.is_char_boundary(cut) {
            cut -= 1;
        }
        Some(collected[..cut].to_string())
    }
}

fn scan_skills(base: &Path, is_global: bool) -> Vec<ClaudeSkill> {
    let dir = base.join("skills");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            !name.to_string_lossy().starts_with('.')
                && (e.file_type().map_or(false, |t| t.is_dir() || t.is_symlink()))
        })
        .map(|e| {
            let skill_md = e.path().join("SKILL.md");
            let skill_md_exists = skill_md.exists();
            let file_path = if skill_md_exists {
                skill_md.to_string_lossy().to_string()
            } else {
                e.path().to_string_lossy().to_string()
            };

            // Best-effort frontmatter parse. Failures (missing file, malformed
            // YAML, non-string description) collapse to `None` — the skill is
            // still returned so the palette can list it.
            let (description, body_excerpt) = if skill_md_exists {
                match fs::read_to_string(&skill_md) {
                    Ok(content) => {
                        let (fm, body) = split_frontmatter(&content);
                        let desc = fm.and_then(|fm_str| {
                            serde_yaml::from_str::<std::collections::HashMap<String, serde_yaml::Value>>(fm_str)
                                .ok()
                                .and_then(|map| {
                                    map.get("description").and_then(|v| match v {
                                        // Only accept YAML string scalars. Arrays, maps, and null
                                        // collapse to None so the frontend never sees junk.
                                        serde_yaml::Value::String(s) => Some(s.trim().to_string()),
                                        _ => None,
                                    })
                                })
                                .filter(|s| !s.is_empty())
                        });
                        let excerpt = skill_body_excerpt(body);
                        (desc, excerpt)
                    }
                    Err(_) => (None, None),
                }
            } else {
                (None, None)
            };

            ClaudeSkill {
                name: e.file_name().to_string_lossy().to_string(),
                source: source.to_string(),
                file_path,
                description,
                body_excerpt,
            }
        })
        .collect()
}

fn scan_steering(base: &Path, is_global: bool) -> Vec<ClaudeSteeringRule> {
    let dir = base.join("steering");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().ends_with(".md"))
        .filter_map(|e| {
            let fp = e.path();
            let content = fs::read_to_string(&fp).ok()?;
            let (always_apply, excerpt) = parse_steering_frontmatter(&content);
            Some(ClaudeSteeringRule {
                name: fp.file_stem()?.to_string_lossy().to_string(),
                always_apply,
                source: source.to_string(),
                excerpt,
                file_path: fp.to_string_lossy().to_string(),
            })
        })
        .collect()
}

fn scan_prompts(base: &Path, is_global: bool) -> Vec<ClaudePrompt> {
    let dir = base.join("prompts");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            (name.ends_with(".md") || name.ends_with(".txt")) && !name.starts_with('.')
        })
        .filter_map(|e| {
            let fp = e.path();
            let content = fs::read_to_string(&fp).ok()?;
            let name = fp.file_stem()?.to_string_lossy().to_string();
            Some(ClaudePrompt {
                name,
                content,
                source: source.to_string(),
                file_path: fp.to_string_lossy().to_string(),
            })
        })
        .collect()
}

fn scan_commands(base: &Path, is_global: bool) -> Vec<ClaudeCommand> {
    let dir = base.join("commands");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            name.ends_with(".md") && !name.starts_with('.')
        })
        .map(|e| {
            let fp = e.path();
            let name = fp.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            ClaudeCommand {
                name,
                source: source.to_string(),
                file_path: fp.to_string_lossy().to_string(),
            }
        })
        .collect()
}

fn scan_root_steering(claude_dir: &Path, is_global: bool, existing: &[ClaudeSteeringRule]) -> Vec<ClaudeSteeringRule> {
    let Ok(entries) = fs::read_dir(claude_dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().ends_with(".md"))
        .filter_map(|e| {
            let fp = e.path();
            let name = fp.file_stem()?.to_string_lossy().to_string();
            if existing.iter().any(|r| r.name == name && r.source == source) {
                return None;
            }
            let content = fs::read_to_string(&fp).ok()?;
            let (always_apply, excerpt) = parse_steering_frontmatter(&content);
            Some(ClaudeSteeringRule {
                name,
                always_apply,
                source: source.to_string(),
                excerpt,
                file_path: fp.to_string_lossy().to_string(),
            })
        })
        .collect()
}

fn load_mcp_file(file_path: &Path, is_global: bool, out: &mut Vec<ClaudeMcpServer>) {
    let Ok(content) = fs::read_to_string(file_path) else { return };
    let Ok(raw) = serde_json::from_str::<serde_json::Value>(&content) else { return };
    let Some(servers) = raw.get("mcpServers").and_then(|v| v.as_object()) else { return };
    let fp = file_path.to_string_lossy().to_string();
    let source = source_str(is_global);
    for (name, cfg) in servers {
        let disabled = cfg.get("disabled").and_then(|v| v.as_bool()).unwrap_or(false);
        let has_url = cfg.get("url").and_then(|v| v.as_str()).is_some();
        let has_command = cfg.get("command").and_then(|v| v.as_str()).is_some();
        let error = if !has_url && !has_command {
            Some("Missing command or url".to_string())
        } else if has_url {
            let url = cfg["url"].as_str().unwrap_or("");
            if !url.starts_with("http") { Some("Invalid url".to_string()) } else { None }
        } else {
            None
        };
        let disabled_tools = cfg.get("disabledTools").and_then(|v| v.as_array()).map(|a| {
            a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
        });
        let entry = ClaudeMcpServer {
            name: name.clone(),
            enabled: !disabled,
            transport: if has_url { "http".to_string() } else { "stdio".to_string() },
            command: cfg.get("command").and_then(|v| v.as_str()).map(String::from),
            args: cfg.get("args").and_then(|v| v.as_array()).map(|a| {
                a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
            }),
            url: cfg.get("url").and_then(|v| v.as_str()).map(String::from),
            error,
            disabled_tools,
            file_path: fp.clone(),
            source: source.to_string(),
        };
        // Local entries override global ones with the same name (mirrors how
        // most editors merge user-level and workspace-level configs).
        if let Some(existing) = out.iter_mut().find(|e| e.name == entry.name) {
            *existing = entry;
        } else {
            out.push(entry);
        }
    }
}

#[tauri::command]
pub fn get_claude_config(project_path: Option<String>) -> ClaudeConfig {
    let mut config = ClaudeConfig::default();

    if let Some(home) = dirs::home_dir() {
        let global_claude = home.join(".claude");
        config.agents.extend(scan_agents(&global_claude, true));
        config.commands.extend(scan_commands(&global_claude, true));
        config.skills.extend(scan_skills(&global_claude, true));
        config.steering_rules.extend(scan_steering(&global_claude, true));
        config.prompts.extend(scan_prompts(&global_claude, true));
        // Try ~/.claude/mcp.json (current Claude CLI location) then the legacy
        // ~/.claude/settings/mcp.json path so both layouts are covered.
        let primary = global_claude.join("mcp.json");
        let legacy = global_claude.join("settings").join("mcp.json");
        if primary.exists() {
            load_mcp_file(&primary, true, &mut config.mcp_servers);
        } else {
            load_mcp_file(&legacy, true, &mut config.mcp_servers);
        }
    }

    if let Some(ref project) = project_path {
        let local_claude = Path::new(project).join(".claude");
        config.agents.extend(scan_agents(&local_claude, false));
        config.commands.extend(scan_commands(&local_claude, false));
        config.skills.extend(scan_skills(&local_claude, false));
        config.steering_rules.extend(scan_steering(&local_claude, false));
        let root_rules = scan_root_steering(&local_claude, false, &config.steering_rules);
        config.steering_rules.extend(root_rules);
        // Local prompts override global ones with the same name
        let local_prompts = scan_prompts(&local_claude, false);
        for lp in local_prompts {
            if let Some(existing) = config.prompts.iter_mut().find(|p| p.name == lp.name) {
                *existing = lp;
            } else {
                config.prompts.push(lp);
            }
        }
        let local_primary = local_claude.join("mcp.json");
        let local_legacy = local_claude.join("settings").join("mcp.json");
        if local_primary.exists() {
            load_mcp_file(&local_primary, false, &mut config.mcp_servers);
        } else {
            load_mcp_file(&local_legacy, false, &mut config.mcp_servers);
        }
    }

    // Populate memory_files from steering rules that have alwaysApply: true
    config.memory_files = config.steering_rules.iter()
        .filter(|r| r.always_apply)
        .cloned()
        .collect();

    config
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerPatch {
    pub disabled: Option<bool>,
    pub disabled_tools: Option<Vec<String>>,
}

#[tauri::command]
pub fn save_mcp_server_config(file_path: String, server_name: String, patch: McpServerPatch) -> Result<(), AppError> {
    let path = Path::new(&file_path);

    // Validate that the path is an mcp.json inside a .claude directory.
    // Accepted layouts:
    //   ~/.claude/mcp.json            (current Claude CLI global location)
    //   ~/.claude/settings/mcp.json   (legacy global location)
    //   <project>/.claude/mcp.json    (current project-local location)
    //   <project>/.claude/settings/mcp.json  (legacy project-local location)
    let canonical = path.canonicalize().map_err(|e| AppError::Other(format!("Invalid path '{}': {}", file_path, e)))?;
    let file_name = canonical.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let parent = canonical.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or("");
    let grandparent = canonical.parent().and_then(|p| p.parent()).and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or("");
    let valid = file_name == "mcp.json"
        && (parent == ".claude" || (parent == "settings" && grandparent == ".claude"));
    if !valid {
        return Err(AppError::Other(format!(
            "Refusing to write '{}': path must be a .claude/mcp.json or .claude/settings/mcp.json file", file_path
        )));
    }

    let content = fs::read_to_string(path)?;
    let mut root: serde_json::Value = serde_json::from_str(&content)?;
    let server = root
        .get_mut("mcpServers")
        .and_then(|v| v.as_object_mut())
        .and_then(|m| m.get_mut(&server_name))
        .and_then(|v| v.as_object_mut())
        .ok_or_else(|| AppError::Other(format!("Server '{server_name}' not found in {file_path}")))?;
    if let Some(disabled) = patch.disabled {
        if disabled {
            server.insert("disabled".to_string(), serde_json::Value::Bool(true));
        } else {
            server.remove("disabled");
        }
    }
    if let Some(tools) = patch.disabled_tools {
        if tools.is_empty() {
            server.remove("disabledTools");
        } else {
            server.insert("disabledTools".to_string(), serde_json::json!(tools));
        }
    }
    let out = serde_json::to_string_pretty(&root)?;
    fs::write(path, out)?;
    Ok(())
}

// ── Claude CLI MCP shell-out commands ──────────────────────────────────────────
//
// These wrap `claude-cli mcp add/remove` so the renderer can speak to the CLI's
// own configuration surface instead of just rewriting JSON. Doing it through
// the CLI is important because:
//
// * Registry mode (Pro tier with IAM Identity Center) restricts which servers
//   a user is allowed to add — the CLI enforces that, our JSON writer would
//   silently bypass it.
// * The CLI validates server names, command paths, and env-var references
//   before accepting them. We get that validation for free.
// * Future claude-cli versions may add side effects (caching, telemetry, scope
//   resolution) that a raw mcp.json edit would skip.
//
// We invoke the CLI in a blocking way (`std::process::Command`) because adding
// a server is a quick filesystem operation; OAuth flows happen later when the
// server connects, not during `mcp add`.

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct McpAddRequest {
    /// Server name as referenced in mcp.json's `mcpServers` map.
    pub name: String,
    /// "global" → ~/.claude/mcp.json, "workspace" → <project>/.claude/mcp.json,
    /// or "agent:<name>" to attach to a specific custom agent definition.
    pub scope: String,
    /// stdio command (e.g. "uvx") OR remote URL (https://…). Exactly one of
    /// `command` or `url` must be set; the CLI rejects requests that omit both
    /// or set both.
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    /// `KEY=VALUE` pairs forwarded as `--env` flags. The CLI supports
    /// `${VAR}` references inside the value, which it expands at server-
    /// launch time rather than at add time.
    pub env: Vec<String>,
    /// Force-overwrite if the name already exists in the chosen scope.
    pub force: bool,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct McpRemoveRequest {
    pub name: String,
    /// "global", "workspace", or "agent:<name>".
    pub scope: String,
}

/// Resolve the claude-cli binary path, falling back to PATH lookup if the
/// caller hasn't supplied a full path. Mirrors `claude_whoami`'s strategy.
fn resolve_claude_bin(claude_bin: Option<String>) -> Result<String, AppError> {
    let bin = claude_bin.unwrap_or_else(|| "claude-cli".to_string());
    if Path::new(&bin).is_absolute() && Path::new(&bin).exists() {
        return Ok(bin);
    }
    if which::which(&bin).is_ok() {
        return Ok(bin);
    }
    super::fs_ops::detect_claude_cli()
        .ok_or_else(|| AppError::Other(format!(
            "claude-cli not found (tried '{bin}' and known paths). Set the binary path in Settings."
        )))
}

/// Run `claude-cli` with the given args, optionally inside a workspace.
/// Returns the trimmed stdout on success or a friendly error containing the
/// CLI's stderr on failure.
fn run_claude_cli(bin: &str, workspace: Option<&str>, args: &[&str]) -> Result<String, AppError> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some(ws) = workspace {
        cmd.current_dir(ws);
    }
    // Augment PATH so spawned helpers (uvx, npx, …) resolve like they do in a
    // user shell. Mirrors the same trick the ACP connection spawn uses.
    // The Homebrew prefix is macOS-specific; on Linux the system PATH is sufficient.
    let path = std::env::var("PATH").unwrap_or_default();
    cmd.env(
        "PATH",
        format!("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:{path}"),
    );

    let output = cmd
        .output()
        .map_err(|e| AppError::Other(format!("Failed to spawn claude-cli: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        // Redact --env KEY=VALUE entries so secrets don't appear in error toasts.
        let safe_args: Vec<&str> = {
            let mut out = Vec::with_capacity(args.len());
            let mut skip_next = false;
            for arg in args {
                if skip_next {
                    out.push("***");
                    skip_next = false;
                } else if *arg == "--env" {
                    out.push(arg);
                    skip_next = true;
                } else {
                    out.push(arg);
                }
            }
            out
        };
        return Err(AppError::Other(format!(
            "claude-cli {} exited with status {}: {}",
            safe_args.join(" "),
            output.status,
            detail
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Translate a renderer-supplied scope string into the `--scope` and (for
/// agent scope) `--agent` flags that `claude-cli mcp add/remove` expects.
fn scope_args(scope: &str) -> Result<Vec<String>, AppError> {
    match scope {
        "global" => Ok(vec!["--scope".into(), "global".into()]),
        "workspace" => Ok(vec!["--scope".into(), "workspace".into()]),
        s if s.starts_with("agent:") => {
            let agent = s.trim_start_matches("agent:").trim();
            if agent.is_empty() {
                return Err(AppError::Other(
                    "Agent scope requires an agent name (use 'agent:<name>')".to_string(),
                ));
            }
            Ok(vec!["--agent".into(), agent.to_string()])
        }
        other => Err(AppError::Other(format!(
            "Unknown scope '{other}' (expected 'global', 'workspace', or 'agent:<name>')"
        ))),
    }
}

#[tauri::command]
pub async fn mcp_add_server(
    request: McpAddRequest,
    workspace: Option<String>,
    claude_bin: Option<String>,
) -> Result<String, AppError> {
    // Exactly one of command (stdio) or url (http) must be set.
    if request.command.is_some() == request.url.is_some() {
        return Err(AppError::Other(
            "Provide exactly one of 'command' (stdio) or 'url' (remote)".to_string(),
        ));
    }
    if request.name.trim().is_empty() {
        return Err(AppError::Other("Server name is required".to_string()));
    }

    let bin = resolve_claude_bin(claude_bin)?;
    let mut args: Vec<String> = vec!["mcp".into(), "add".into(), "--name".into(), request.name.clone()];
    args.extend(scope_args(&request.scope)?);

    if let Some(cmd) = request.command.as_deref() {
        args.push("--command".into());
        args.push(cmd.to_string());
        for a in &request.args {
            args.push("--args".into());
            args.push(a.clone());
        }
    }
    if let Some(url) = request.url.as_deref() {
        args.push("--url".into());
        args.push(url.to_string());
    }
    for e in &request.env {
        args.push("--env".into());
        args.push(e.clone());
    }
    if request.force {
        args.push("--force".into());
    }

    // `claude-cli mcp add` may take several seconds (uvx/npx download on first run).
    // Run on a blocking thread so we don't stall the Tauri async executor.
    tokio::task::spawn_blocking(move || {
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_claude_cli(&bin, workspace.as_deref(), &arg_refs)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task join error: {e}")))?
}

#[tauri::command]
pub async fn mcp_remove_server(
    request: McpRemoveRequest,
    workspace: Option<String>,
    claude_bin: Option<String>,
) -> Result<String, AppError> {
    if request.name.trim().is_empty() {
        return Err(AppError::Other("Server name is required".to_string()));
    }
    let bin = resolve_claude_bin(claude_bin)?;
    let mut args: Vec<String> = vec!["mcp".into(), "remove".into(), "--name".into(), request.name.clone()];
    args.extend(scope_args(&request.scope)?);
    // Run on a blocking thread — CLI may do network/filesystem work.
    tokio::task::spawn_blocking(move || {
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_claude_cli(&bin, workspace.as_deref(), &arg_refs)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task join error: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_with_always_apply_true() {
        let input = "---\nalwaysApply: true\n---\n# Title\nSome body text";
        let (always_apply, excerpt) = parse_steering_frontmatter(input);
        assert!(always_apply);
        assert_eq!(excerpt, "Some body text");
    }

    #[test]
    fn parse_frontmatter_with_always_apply_false() {
        let input = "---\nalwaysApply: false\n---\nBody here";
        let (always_apply, excerpt) = parse_steering_frontmatter(input);
        assert!(!always_apply);
        assert_eq!(excerpt, "Body here");
    }

    #[test]
    fn parse_frontmatter_missing_returns_false() {
        let input = "# No frontmatter\nJust content";
        let (always_apply, excerpt) = parse_steering_frontmatter(input);
        assert!(!always_apply);
        assert_eq!(excerpt, "Just content");
    }

    #[test]
    fn parse_frontmatter_skips_headings_in_excerpt() {
        let input = "---\nalwaysApply: true\n---\n# Heading\n## Subheading\nActual content";
        let (_, excerpt) = parse_steering_frontmatter(input);
        assert_eq!(excerpt, "Actual content");
    }

    #[test]
    fn parse_frontmatter_truncates_long_excerpt() {
        let long_line = "a".repeat(200);
        let input = format!("---\nalwaysApply: false\n---\n{}", long_line);
        let (_, excerpt) = parse_steering_frontmatter(&input);
        assert_eq!(excerpt.len(), 120);
    }

    #[test]
    fn parse_frontmatter_empty_body() {
        let input = "---\nalwaysApply: true\n---\n";
        let (always_apply, excerpt) = parse_steering_frontmatter(input);
        assert!(always_apply);
        assert_eq!(excerpt, "");
    }

    #[test]
    fn source_str_global() {
        assert_eq!(super::source_str(true), "global");
    }

    #[test]
    fn source_str_local() {
        assert_eq!(super::source_str(false), "local");
    }

    #[test]
    fn scan_agents_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("claudedex_test_nonexistent_agents");
        assert!(super::scan_agents(&tmp, true).is_empty());
    }

    #[test]
    fn scan_skills_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("claudedex_test_nonexistent_skills");
        assert!(super::scan_skills(&tmp, false).is_empty());
    }

    #[test]
    fn scan_steering_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("claudedex_test_nonexistent_steering");
        assert!(super::scan_steering(&tmp, true).is_empty());
    }

    #[test]
    fn scan_agents_reads_json_files() {
        let tmp = tempfile::tempdir().unwrap();
        let agents_dir = tmp.path().join("agents");
        std::fs::create_dir_all(&agents_dir).unwrap();
        std::fs::write(
            agents_dir.join("test-agent.json"),
            r#"{"name": "Test Agent", "description": "A test", "tools": ["tool1", "tool2"]}"#,
        ).unwrap();
        std::fs::write(agents_dir.join(".hidden.json"), r#"{"name": "Hidden"}"#).unwrap();
        let result = super::scan_agents(tmp.path(), true);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Test Agent");
        assert_eq!(result[0].tools, vec!["tool1", "tool2"]);
        assert_eq!(result[0].source, "global");
    }

    #[test]
    fn scan_steering_reads_md_files() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("steering");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("my-rule.md"), "---\nalwaysApply: true\n---\n# Rule\nDo this thing").unwrap();
        let result = super::scan_steering(tmp.path(), false);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "my-rule");
        assert!(result[0].always_apply);
        assert_eq!(result[0].source, "local");
        assert_eq!(result[0].excerpt, "Do this thing");
    }

    #[test]
    fn load_mcp_file_parses_stdio_server() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp", "args": ["--token", "abc"]}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, true, &mut servers);
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "slack");
        assert!(servers[0].enabled);
        assert_eq!(servers[0].transport, "stdio");
        assert_eq!(servers[0].source, "global");
        assert!(servers[0].error.is_none());
    }

    #[test]
    fn load_mcp_file_parses_http_server() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"gh": {"url": "https://gh.mcp"}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, false, &mut servers);
        assert_eq!(servers[0].transport, "http");
        assert!(servers[0].enabled);
        assert_eq!(servers[0].source, "local");
    }

    #[test]
    fn load_mcp_file_disabled_field() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp", "disabled": true}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, true, &mut servers);
        assert!(!servers[0].enabled);
    }

    #[test]
    fn load_mcp_file_parses_disabled_tools() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp", "disabledTools": ["post_message", "delete_message"]}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, true, &mut servers);
        assert_eq!(servers[0].disabled_tools.as_deref(), Some(&["post_message".to_string(), "delete_message".to_string()][..]));
    }

    #[test]
    fn load_mcp_file_flags_missing_command_and_url() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"broken": {}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, true, &mut servers);
        assert_eq!(servers[0].error.as_deref(), Some("Missing command or url"));
    }

    #[test]
    fn load_mcp_file_flags_invalid_url() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"bad": {"url": "not-a-url"}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&f, true, &mut servers);
        assert_eq!(servers[0].error.as_deref(), Some("Invalid url"));
    }

    #[test]
    fn load_mcp_file_nonexistent_is_noop() {
        let mut servers = Vec::new();
        super::load_mcp_file(std::path::Path::new("/nonexistent/mcp.json"), true, &mut servers);
        assert!(servers.is_empty());
    }

    #[test]
    fn load_mcp_file_local_overrides_global() {
        let tmp = tempfile::tempdir().unwrap();
        let global = tmp.path().join("global.json");
        let local = tmp.path().join("local.json");
        std::fs::write(&global, r#"{"mcpServers": {"chrome-devtools": {"command": "g", "disabled": true}}}"#).unwrap();
        std::fs::write(&local, r#"{"mcpServers": {"chrome-devtools": {"command": "l"}}}"#).unwrap();
        let mut servers = Vec::new();
        super::load_mcp_file(&global, true, &mut servers);
        super::load_mcp_file(&local, false, &mut servers);
        assert_eq!(servers.len(), 1, "local entry should replace global one with same name");
        assert_eq!(servers[0].source, "local");
        assert_eq!(servers[0].command.as_deref(), Some("l"));
        assert!(servers[0].enabled, "local config takes precedence — should be enabled");
    }

    #[test]
    fn scope_args_global() {
        let r = super::scope_args("global").unwrap();
        assert_eq!(r, vec!["--scope".to_string(), "global".to_string()]);
    }

    #[test]
    fn scope_args_workspace() {
        let r = super::scope_args("workspace").unwrap();
        assert_eq!(r, vec!["--scope".to_string(), "workspace".to_string()]);
    }

    #[test]
    fn scope_args_agent() {
        let r = super::scope_args("agent:my-rust-dev").unwrap();
        assert_eq!(r, vec!["--agent".to_string(), "my-rust-dev".to_string()]);
    }

    #[test]
    fn scope_args_agent_empty_name_errors() {
        let err = super::scope_args("agent:").unwrap_err();
        assert!(err.to_string().contains("agent name"));
    }

    #[test]
    fn scope_args_unknown_errors() {
        let err = super::scope_args("user").unwrap_err();
        assert!(err.to_string().contains("Unknown scope"));
    }

    #[test]
    fn claude_config_default_is_empty() {
        let config = super::ClaudeConfig::default();
        assert!(config.agents.is_empty());
        assert!(config.commands.is_empty());
        assert!(config.memory_files.is_empty());
        assert!(config.mcp_servers.is_empty());
    }

    #[test]
    fn parse_frontmatter_only_whitespace_body() {
        let input = "---\nalwaysApply: true\n---\n   \n  \n";
        let (always_apply, excerpt) = super::parse_steering_frontmatter(input);
        assert!(always_apply);
        assert_eq!(excerpt, "");
    }

    #[test]
    fn save_mcp_server_config_sets_disabled() {
        let tmp = tempfile::tempdir().unwrap();
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        let f = settings_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(true), disabled_tools: None };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "slack".to_string(), patch).unwrap();
        let content: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&f).unwrap()).unwrap();
        assert_eq!(content["mcpServers"]["slack"]["disabled"], true);
        assert_eq!(content["mcpServers"]["slack"]["command"], "slack-mcp");
    }

    #[test]
    fn save_mcp_server_config_removes_disabled_on_enable() {
        let tmp = tempfile::tempdir().unwrap();
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        let f = settings_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp", "disabled": true}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(false), disabled_tools: None };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "slack".to_string(), patch).unwrap();
        let content: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&f).unwrap()).unwrap();
        assert!(content["mcpServers"]["slack"].get("disabled").is_none());
    }

    #[test]
    fn save_mcp_server_config_sets_disabled_tools() {
        let tmp = tempfile::tempdir().unwrap();
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        let f = settings_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: None, disabled_tools: Some(vec!["post_message".to_string()]) };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "slack".to_string(), patch).unwrap();
        let content: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&f).unwrap()).unwrap();
        assert_eq!(content["mcpServers"]["slack"]["disabledTools"][0], "post_message");
    }

    #[test]
    fn save_mcp_server_config_removes_disabled_tools_on_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        let f = settings_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp", "disabledTools": ["x"]}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: None, disabled_tools: Some(vec![]) };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "slack".to_string(), patch).unwrap();
        let content: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&f).unwrap()).unwrap();
        assert!(content["mcpServers"]["slack"].get("disabledTools").is_none());
    }

    #[test]
    fn save_mcp_server_config_rejects_non_claude_path() {
        let tmp = tempfile::tempdir().unwrap();
        let f = tmp.path().join("evil.json");
        std::fs::write(&f, r#"{"mcpServers": {"slack": {"command": "slack-mcp"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(true), disabled_tools: None };
        let result = super::save_mcp_server_config(f.to_string_lossy().to_string(), "slack".to_string(), patch);
        assert!(result.is_err());
    }

    // ── New field tests ───────────────────────────────────────────────────────

    #[test]
    fn scan_agents_reads_new_fields() {
        let tmp = tempfile::tempdir().unwrap();
        let agents_dir = tmp.path().join("agents");
        std::fs::create_dir_all(&agents_dir).unwrap();
        std::fs::write(
            agents_dir.join("full-agent.json"),
            r#"{
                "name": "Full Agent",
                "description": "Has all fields",
                "tools": ["read"],
                "welcomeMessage": "Hello!",
                "keyboardShortcut": "ctrl+a",
                "model": "claude-sonnet-4",
                "resources": ["file://README.md", "file://docs/**/*.md"]
            }"#,
        ).unwrap();
        let result = super::scan_agents(tmp.path(), false);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].welcome_message.as_deref(), Some("Hello!"));
        assert_eq!(result[0].keyboard_shortcut.as_deref(), Some("ctrl+a"));
        assert_eq!(result[0].model.as_deref(), Some("claude-sonnet-4"));
        assert_eq!(result[0].resources, vec!["file://README.md", "file://docs/**/*.md"]);
        assert!(result[0].hooks.is_none());
    }

    #[test]
    fn scan_agents_missing_optional_fields_are_none() {
        let tmp = tempfile::tempdir().unwrap();
        let agents_dir = tmp.path().join("agents");
        std::fs::create_dir_all(&agents_dir).unwrap();
        std::fs::write(
            agents_dir.join("minimal.json"),
            r#"{"name": "Minimal", "description": "No extras", "tools": []}"#,
        ).unwrap();
        let result = super::scan_agents(tmp.path(), false);
        assert_eq!(result.len(), 1);
        assert!(result[0].welcome_message.is_none());
        assert!(result[0].keyboard_shortcut.is_none());
        assert!(result[0].model.is_none());
        assert!(result[0].resources.is_empty());
        assert!(result[0].hooks.is_none());
    }

    #[test]
    fn parse_agent_hooks_parses_all_trigger_types() {
        let json: serde_json::Value = serde_json::from_str(r#"{
            "hooks": {
                "agentSpawn": [{"command": "git status"}],
                "userPromptSubmit": [{"command": "ls -la"}],
                "preToolUse": [{"command": "echo pre", "matcher": "fs_write"}],
                "postToolUse": [{"command": "cargo fmt", "matcher": "fs_write"}],
                "stop": [{"command": "npm test"}]
            }
        }"#).unwrap();
        let obj = json.as_object().unwrap();
        let hooks = super::parse_agent_hooks(obj).expect("should parse hooks");
        assert_eq!(hooks.agent_spawn.len(), 1);
        assert_eq!(hooks.agent_spawn[0].command, "git status");
        assert!(hooks.agent_spawn[0].matcher.is_none());
        assert_eq!(hooks.user_prompt_submit.len(), 1);
        assert_eq!(hooks.pre_tool_use.len(), 1);
        assert_eq!(hooks.pre_tool_use[0].matcher.as_deref(), Some("fs_write"));
        assert_eq!(hooks.post_tool_use.len(), 1);
        assert_eq!(hooks.stop.len(), 1);
        assert_eq!(hooks.stop[0].command, "npm test");
    }

    #[test]
    fn parse_agent_hooks_returns_none_when_all_empty() {
        let json: serde_json::Value = serde_json::from_str(r#"{"hooks": {}}"#).unwrap();
        let obj = json.as_object().unwrap();
        assert!(super::parse_agent_hooks(obj).is_none());
    }

    #[test]
    fn parse_agent_hooks_returns_none_when_no_hooks_key() {
        let json: serde_json::Value = serde_json::from_str(r#"{"name": "agent"}"#).unwrap();
        let obj = json.as_object().unwrap();
        assert!(super::parse_agent_hooks(obj).is_none());
    }

    #[test]
    fn scan_prompts_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("claudedex_test_nonexistent_prompts");
        assert!(super::scan_prompts(&tmp, true).is_empty());
    }

    #[test]
    fn scan_prompts_reads_md_and_txt_files() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("prompts");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("code-review.md"), "Please review this code for best practices.").unwrap();
        std::fs::write(dir.join("security-scan.txt"), "Check for security vulnerabilities.").unwrap();
        std::fs::write(dir.join(".hidden.md"), "Should be ignored").unwrap();
        std::fs::write(dir.join("binary.bin"), "not a prompt").unwrap();
        let result = super::scan_prompts(tmp.path(), false);
        assert_eq!(result.len(), 2);
        let names: Vec<&str> = result.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"code-review"));
        assert!(names.contains(&"security-scan"));
        let review = result.iter().find(|p| p.name == "code-review").unwrap();
        assert_eq!(review.source, "local");
        assert_eq!(review.content, "Please review this code for best practices.");
    }

    #[test]
    fn scan_prompts_global_source() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("prompts");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("my-prompt.md"), "content").unwrap();
        let result = super::scan_prompts(tmp.path(), true);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].source, "global");
    }

    // ── MCP path layout tests (primary vs legacy) ─────────────────────────────

    /// save_mcp_server_config must accept the current layout: .claude/mcp.json
    /// (parent == ".claude", no "settings" in between).
    #[test]
    fn save_mcp_accepts_root_claude_mcp_json() {
        let tmp = tempfile::tempdir().unwrap();
        let claude_dir = tmp.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let f = claude_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"ctx": {"command": "npx"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(true), disabled_tools: None };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "ctx".to_string(), patch)
            .expect("root .claude/mcp.json must be accepted");
        let content: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&f).unwrap()).unwrap();
        assert_eq!(content["mcpServers"]["ctx"]["disabled"], true);
    }

    /// save_mcp_server_config must still accept the legacy layout: .claude/settings/mcp.json.
    #[test]
    fn save_mcp_accepts_legacy_settings_mcp_json() {
        let tmp = tempfile::tempdir().unwrap();
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        let f = settings_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"ctx": {"command": "npx"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(false), disabled_tools: None };
        super::save_mcp_server_config(f.to_string_lossy().to_string(), "ctx".to_string(), patch)
            .expect("legacy .claude/settings/mcp.json must be accepted");
    }

    /// Wrong filename (not mcp.json) must be rejected.
    #[test]
    fn save_mcp_rejects_wrong_filename() {
        let tmp = tempfile::tempdir().unwrap();
        let claude_dir = tmp.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let f = claude_dir.join("servers.json");
        std::fs::write(&f, r#"{"mcpServers": {"x": {"command": "c"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(true), disabled_tools: None };
        let err = super::save_mcp_server_config(
            f.to_string_lossy().to_string(),
            "x".to_string(),
            patch,
        )
        .unwrap_err();
        assert!(err.to_string().contains("Refusing to write"));
    }

    /// A file named mcp.json but not inside a .claude directory must be rejected.
    #[test]
    fn save_mcp_rejects_mcp_json_outside_claude_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let other_dir = tmp.path().join("config");
        std::fs::create_dir_all(&other_dir).unwrap();
        let f = other_dir.join("mcp.json");
        std::fs::write(&f, r#"{"mcpServers": {"x": {"command": "c"}}}"#).unwrap();
        let patch = super::McpServerPatch { disabled: Some(true), disabled_tools: None };
        let err = super::save_mcp_server_config(
            f.to_string_lossy().to_string(),
            "x".to_string(),
            patch,
        )
        .unwrap_err();
        assert!(err.to_string().contains("Refusing to write"));
    }

    /// get_claude_config reads the primary path (.claude/mcp.json) when it exists,
    /// ignoring the legacy settings/mcp.json even if that also exists.
    #[test]
    fn get_claude_config_prefers_primary_mcp_path() {
        let tmp = tempfile::tempdir().unwrap();
        let project_dir = tmp.path().to_string_lossy().to_string();

        // Write primary path with server "primary-server"
        let claude_dir = tmp.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(
            claude_dir.join("mcp.json"),
            r#"{"mcpServers": {"primary-server": {"command": "primary-cmd"}}}"#,
        )
        .unwrap();

        // Write legacy path with a different server "legacy-server"
        let settings_dir = claude_dir.join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        std::fs::write(
            settings_dir.join("mcp.json"),
            r#"{"mcpServers": {"legacy-server": {"command": "legacy-cmd"}}}"#,
        )
        .unwrap();

        let config = super::get_claude_config(Some(project_dir));
        let names: Vec<&str> = config.mcp_servers.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"primary-server"), "primary path must be loaded");
        assert!(!names.contains(&"legacy-server"), "legacy path must be skipped when primary exists");
    }

    /// get_claude_config falls back to legacy settings/mcp.json when primary path is absent.
    #[test]
    fn get_claude_config_falls_back_to_legacy_mcp_path() {
        let tmp = tempfile::tempdir().unwrap();
        let project_dir = tmp.path().to_string_lossy().to_string();

        // Only legacy path — no primary .claude/mcp.json
        let settings_dir = tmp.path().join(".claude").join("settings");
        std::fs::create_dir_all(&settings_dir).unwrap();
        std::fs::write(
            settings_dir.join("mcp.json"),
            r#"{"mcpServers": {"legacy-only": {"command": "leg-cmd"}}}"#,
        )
        .unwrap();

        let config = super::get_claude_config(Some(project_dir));
        let names: Vec<&str> = config.mcp_servers.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"legacy-only"), "legacy path must be loaded when primary absent");
    }

    /// get_claude_config with no project-local mcp files returns no local-source servers.
    /// (Global servers from ~/.claude/mcp.json may still appear; we only assert local.)
    #[test]
    fn get_claude_config_no_mcp_file_returns_no_local_servers() {
        let tmp = tempfile::tempdir().unwrap();
        let claude_dir = tmp.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let config = super::get_claude_config(Some(tmp.path().to_string_lossy().to_string()));
        let local: Vec<_> = config.mcp_servers.iter().filter(|s| s.source == "local").collect();
        assert!(local.is_empty(), "no local mcp files should produce no local-source servers");
    }

    // ── Skill description + body_excerpt tests (TASK-014) ────────────────────

    #[test]
    fn scan_skills_extracts_description_from_frontmatter() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\ndescription: Foo bar\n---\n\nBody paragraph one.\n",
        )
        .unwrap();
        let result = super::scan_skills(tmp.path(), true);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].description, Some("Foo bar".to_string()));
    }

    #[test]
    fn scan_skills_returns_none_when_description_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: example\n---\n\nBody.\n",
        )
        .unwrap();
        let result = super::scan_skills(tmp.path(), false);
        assert_eq!(result.len(), 1);
        assert!(result[0].description.is_none());
    }

    #[test]
    fn scan_skills_body_excerpt_truncates_long_body() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        let long_body = "x".repeat(500);
        let content = format!("---\ndescription: Long\n---\n\n{}\n", long_body);
        std::fs::write(skill_dir.join("SKILL.md"), content).unwrap();
        let result = super::scan_skills(tmp.path(), true);
        assert_eq!(result.len(), 1);
        let excerpt = result[0]
            .body_excerpt
            .as_ref()
            .expect("body_excerpt should be Some for non-empty body");
        // skill_body_excerpt caps at MAX = 200 bytes on a UTF-8 char boundary.
        assert!(
            excerpt.len() <= 200,
            "excerpt length {} exceeded 200-byte cap",
            excerpt.len()
        );
    }

    #[test]
    fn scan_skills_body_excerpt_skips_headings() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\ndescription: Test\n---\n\n# Heading 1\n## Heading 2\nReal body line.\nMore body.\n",
        )
        .unwrap();
        let result = super::scan_skills(tmp.path(), true);
        assert_eq!(result.len(), 1);
        let excerpt = result[0]
            .body_excerpt
            .as_ref()
            .expect("body_excerpt should be Some");
        assert!(
            !excerpt.contains("Heading 1"),
            "excerpt should not contain heading line: {excerpt:?}"
        );
        assert!(
            !excerpt.contains("Heading 2"),
            "excerpt should not contain heading line: {excerpt:?}"
        );
        assert!(excerpt.contains("Real body line."));
    }

    #[test]
    fn scan_skills_single_character_description() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\ndescription: x\n---\n\nBody.\n",
        )
        .unwrap();
        let result = super::scan_skills(tmp.path(), true);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].description, Some("x".to_string()));
    }

    #[test]
    fn scan_skills_malformed_yaml_returns_skill_with_none_description() {
        let tmp = tempfile::tempdir().unwrap();
        let skill_dir = tmp.path().join("skills").join("example");
        std::fs::create_dir_all(&skill_dir).unwrap();
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\ndescription: [this: is, malformed: yaml\n---\n\nBody.\n",
        )
        .unwrap();
        let result = super::scan_skills(tmp.path(), true);
        assert_eq!(result.len(), 1, "skill must still be listed even with malformed YAML");
        assert!(
            result[0].description.is_none(),
            "malformed YAML must collapse to None, not panic or be skipped"
        );
    }
}
