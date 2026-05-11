use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAgent {
    pub name: String,
    pub description: String,
    pub tools: Vec<String>,
    pub source: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCommand {
    pub name: String,
    pub source: String,
    pub file_path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMemoryFile {
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
    pub file_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeOutputStyle {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub body: String,
    pub source: String,
    pub file_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeHook {
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matcher: Option<String>,
    pub command: String,
    pub source: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StatuslineConfig {
    #[serde(rename = "type")]
    pub kind: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<u32>,
    pub source: String,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeConfig {
    pub agents: Vec<ClaudeAgent>,
    pub commands: Vec<ClaudeCommand>,
    pub memory_files: Vec<ClaudeMemoryFile>,
    pub mcp_servers: Vec<ClaudeMcpServer>,
    #[serde(default)]
    pub output_styles: Vec<ClaudeOutputStyle>,
    #[serde(default)]
    pub hooks: Vec<ClaudeHook>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub statusline: Option<StatuslineConfig>,
}

fn source_str(is_global: bool) -> &'static str {
    if is_global { "global" } else { "local" }
}

fn parse_frontmatter(content: &str) -> (bool, String) {
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

fn scan_agents(base: &Path, is_global: bool) -> Vec<ClaudeAgent> {
    let dir = base.join("agents");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = source_str(is_global);
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            name.ends_with(".json") && !name.starts_with('.')
        })
        .filter_map(|e| {
            let fp = e.path();
            let raw: serde_json::Value = serde_json::from_str(&fs::read_to_string(&fp).ok()?).ok()?;
            let obj = raw.as_object()?;
            let file_name = fp.file_stem()?.to_string_lossy().to_string();
            Some(ClaudeAgent {
                name: obj.get("name").and_then(|v| v.as_str()).unwrap_or(&file_name).to_string(),
                description: obj.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                tools: obj.get("tools").and_then(|v| v.as_array()).map(|a| {
                    a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                }).unwrap_or_default(),
                source: source.to_string(),
                file_path: fp.to_string_lossy().to_string(),
            })
        })
        .collect()
}

/// Scan `.claude/commands/` for slash command markdown files.
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
            ClaudeCommand {
                name: fp.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default(),
                source: source.to_string(),
                file_path: fp.to_string_lossy().to_string(),
            }
        })
        .collect()
}

/// Scan for CLAUDE.md memory files in project root and .claude/ directory.
fn scan_memory_files(project_path: Option<&str>, claude_dir: &Path, is_global: bool) -> Vec<ClaudeMemoryFile> {
    let source = source_str(is_global);
    let mut files = Vec::new();

    // Check for CLAUDE.md in the project root (local only)
    if !is_global {
        if let Some(project) = project_path {
            let claude_md = Path::new(project).join("CLAUDE.md");
            if claude_md.exists() {
                if let Ok(content) = fs::read_to_string(&claude_md) {
                    let (always_apply, excerpt) = parse_frontmatter(&content);
                    files.push(ClaudeMemoryFile {
                        name: "CLAUDE.md".to_string(),
                        always_apply: true, // root CLAUDE.md always applies
                        source: source.to_string(),
                        excerpt,
                        file_path: claude_md.to_string_lossy().to_string(),
                    });
                    let _ = always_apply; // root CLAUDE.md is always-apply regardless
                }
            }
        }
    }

    // Check for CLAUDE.md inside .claude/ directory
    let claude_md = claude_dir.join("CLAUDE.md");
    if claude_md.exists() {
        if let Ok(content) = fs::read_to_string(&claude_md) {
            let (always_apply, excerpt) = parse_frontmatter(&content);
            files.push(ClaudeMemoryFile {
                name: ".claude/CLAUDE.md".to_string(),
                always_apply,
                source: source.to_string(),
                excerpt,
                file_path: claude_md.to_string_lossy().to_string(),
            });
        }
    }

    // Also scan .claude/*.md for additional memory files
    if let Ok(entries) = fs::read_dir(claude_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.ends_with(".md") && name_str != "CLAUDE.md" && !name_str.starts_with('.') {
                let fp = entry.path();
                if let Ok(content) = fs::read_to_string(&fp) {
                    let (always_apply, excerpt) = parse_frontmatter(&content);
                    files.push(ClaudeMemoryFile {
                        name: name_str.to_string(),
                        always_apply,
                        source: source.to_string(),
                        excerpt,
                        file_path: fp.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    files
}

/// Allowed MCP server command basenames. Commands not in this list are
/// flagged with an error so the UI can warn the user (CWE-78).
const ALLOWED_MCP_COMMANDS: &[&str] = &[
    "node", "npx", "npm", "bun", "bunx", "deno", "python", "python3",
    "uvx", "uv", "docker", "podman", "cargo", "go",
];

/// Check if an MCP command is a known-safe executable.
fn is_allowed_mcp_command(command: &str) -> bool {
    let basename = std::path::Path::new(command)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(command);
    ALLOWED_MCP_COMMANDS.contains(&basename)
}

fn load_mcp_file(file_path: &Path, enabled: bool, out: &mut Vec<ClaudeMcpServer>) {
    let Ok(content) = fs::read_to_string(file_path) else { return };
    let Ok(raw) = serde_json::from_str::<serde_json::Value>(&content) else { return };
    let Some(servers) = raw.get("mcpServers").and_then(|v| v.as_object()) else { return };
    let fp = file_path.to_string_lossy().to_string();
    for (name, cfg) in servers {
        let has_url = cfg.get("url").and_then(|v| v.as_str()).is_some();
        let command_str = cfg.get("command").and_then(|v| v.as_str());
        let has_command = command_str.is_some();
        let error = if !has_url && !has_command {
            Some("Missing command or url".to_string())
        } else if has_url {
            let url = cfg["url"].as_str().unwrap_or("");
            if !url.starts_with("http") { Some("Invalid url".to_string()) } else { None }
        } else if let Some(cmd) = command_str {
            if !is_allowed_mcp_command(cmd) {
                Some(format!("Untrusted command '{}': not in allowed list", cmd))
            } else {
                // Validate args don't contain shell metacharacters
                let args = cfg.get("args").and_then(|v| v.as_array());
                let has_shell_chars = args.map_or(false, |a| {
                    a.iter().any(|v| {
                        v.as_str().map_or(false, |s| {
                            s.contains('|') || s.contains(';') || s.contains('`')
                                || s.contains("$(") || s.contains("&&") || s.contains(">>")
                        })
                    })
                });
                if has_shell_chars {
                    Some("Args contain suspicious shell metacharacters".to_string())
                } else {
                    None
                }
            }
        } else {
            None
        };
        out.push(ClaudeMcpServer {
            name: name.clone(),
            enabled,
            transport: if has_url { "http".to_string() } else { "stdio".to_string() },
            command: cfg.get("command").and_then(|v| v.as_str()).map(String::from),
            args: cfg.get("args").and_then(|v| v.as_array()).map(|a| {
                a.iter().filter_map(|v| v.as_str().map(String::from)).collect()
            }),
            url: cfg.get("url").and_then(|v| v.as_str()).map(String::from),
            error,
            file_path: fp.clone(),
        });
    }
}

/// Output-style source string ("global" or "project") — distinct from
/// `source_str` which uses "local" for the local scope.
fn output_source_str(is_global: bool) -> &'static str {
    if is_global { "global" } else { "project" }
}

/// Extract `name` and `description` fields from a YAML frontmatter block
/// at the top of `content`. Returns `(name, description, body)` where body
/// has the frontmatter stripped. If no frontmatter exists, returns
/// `(None, None, content)` unchanged.
///
/// We avoid pulling in `serde_yaml` and instead parse the simple
/// `key: value` shape that Claude Code's output-style files use. Lines that
/// don't match `key:value` are ignored. Unknown keys are also ignored.
fn parse_output_style_frontmatter(content: &str) -> (Option<String>, Option<String>, String) {
    if !content.starts_with("---") {
        return (None, None, content.to_string());
    }
    // Find the closing `---` after the opening one.
    let after_open = &content[3..];
    let Some(end_idx) = after_open.find("\n---") else {
        // Malformed: opening `---` but no closing — treat as no frontmatter.
        return (None, None, content.to_string());
    };
    let fm = &after_open[..end_idx];
    // body starts after the closing `---` plus the trailing newline (if any).
    let body_start = 3 + end_idx + 4;
    let body = if body_start <= content.len() {
        let rest = &content[body_start..];
        rest.strip_prefix('\n').unwrap_or(rest).to_string()
    } else {
        String::new()
    };

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    for line in fm.lines() {
        let line = line.trim_end();
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim().trim_matches(|c| c == '"' || c == '\'').to_string();
            match key {
                "name" if !value.is_empty() => name = Some(value),
                "description" if !value.is_empty() => description = Some(value),
                _ => {}
            }
        }
    }
    (name, description, body)
}

/// Read and parse `<base>/output-styles/*.md` markdown-with-frontmatter files
/// into [`ClaudeOutputStyle`] entries. Missing directory returns empty.
/// Files with malformed frontmatter are kept (frontmatter just yields no
/// fields); files that fail to read are logged and skipped.
fn scan_output_styles(base: &Path, is_global: bool) -> Vec<ClaudeOutputStyle> {
    let dir = base.join("output-styles");
    let Ok(entries) = fs::read_dir(&dir) else { return vec![] };
    let source = output_source_str(is_global);
    let mut out = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.ends_with(".md") || name_str.starts_with('.') {
            continue;
        }
        let fp = entry.path();
        let content = match fs::read_to_string(&fp) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("claude_config: failed to read {}: {}", fp.display(), e);
                continue;
            }
        };
        let (fm_name, fm_description, body) = parse_output_style_frontmatter(&content);
        let file_stem = fp
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        out.push(ClaudeOutputStyle {
            name: fm_name.unwrap_or(file_stem),
            description: fm_description.unwrap_or_default(),
            body,
            source: source.to_string(),
            file_path: fp.to_string_lossy().into_owned(),
        });
    }
    out
}

/// Read and parse `<base>/settings.json` once. Returns `None` when the file
/// is missing (no warning) or when JSON is malformed (logs a warning).
fn parse_settings_json(path: &Path) -> Option<serde_json::Value> {
    let text = fs::read_to_string(path).ok()?;
    match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(v) => Some(v),
        Err(e) => {
            log::warn!("claude_config: malformed {}: {}", path.display(), e);
            None
        }
    }
}

#[derive(Deserialize)]
struct RawHookEntry {
    #[serde(default)]
    matcher: Option<String>,
    command: String,
}

/// Extract the `hooks` block from an already-parsed settings.json `Value`.
/// Returns one [`ClaudeHook`] per (event, entry) pair. Unknown / non-array
/// event values are skipped with a warning.
fn extract_hooks_from_settings(value: &serde_json::Value, is_global: bool) -> Vec<ClaudeHook> {
    let Some(hooks_obj) = value.get("hooks").and_then(|v| v.as_object()) else {
        return vec![];
    };
    let source = output_source_str(is_global);
    let mut out = Vec::new();
    for (event, entries_val) in hooks_obj {
        let Some(entries) = entries_val.as_array() else {
            log::warn!("claude_config: hooks.{} is not an array, skipping", event);
            continue;
        };
        for entry_val in entries {
            match serde_json::from_value::<RawHookEntry>(entry_val.clone()) {
                Ok(raw) => out.push(ClaudeHook {
                    event: event.clone(),
                    matcher: raw.matcher,
                    command: raw.command,
                    source: source.to_string(),
                }),
                Err(e) => {
                    log::warn!(
                        "claude_config: malformed hook entry under {}: {}",
                        event,
                        e
                    );
                }
            }
        }
    }
    out
}

/// Read `<base>/settings.json` and return the canonical Claude Code hooks list.
fn scan_hooks(base: &Path, is_global: bool) -> Vec<ClaudeHook> {
    let path = base.join("settings.json");
    let Some(value) = parse_settings_json(&path) else { return vec![] };
    extract_hooks_from_settings(&value, is_global)
}

/// Extract the `statusLine` block from an already-parsed settings.json `Value`.
fn extract_statusline_from_settings(
    value: &serde_json::Value,
    is_global: bool,
) -> Option<StatuslineConfig> {
    let sl = value.get("statusLine")?.as_object()?;
    let kind = sl.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if kind != "command" {
        log::warn!(
            "claude_config: unsupported statusLine.type '{}' (only 'command' supported)",
            kind
        );
        return None;
    }
    let command = sl.get("command").and_then(|v| v.as_str()).map(String::from)?;
    let padding = sl.get("padding").and_then(|v| v.as_u64()).map(|n| n as u32);
    Some(StatuslineConfig {
        kind: kind.to_string(),
        command,
        padding,
        source: output_source_str(is_global).to_string(),
    })
}

/// Read `<base>/settings.json` and return the optional statusline config.
fn read_statusline(base: &Path, is_global: bool) -> Option<StatuslineConfig> {
    let path = base.join("settings.json");
    let value = parse_settings_json(&path)?;
    extract_statusline_from_settings(&value, is_global)
}

#[tauri::command]
pub fn get_claude_config(project_path: Option<String>) -> ClaudeConfig {
    let mut config = ClaudeConfig::default();

    // Global: ~/.claude/
    if let Some(home) = dirs::home_dir() {
        let global_claude = home.join(".claude");
        config.agents.extend(scan_agents(&global_claude, true));
        config.commands.extend(scan_commands(&global_claude, true));
        config.memory_files.extend(scan_memory_files(None, &global_claude, true));
        load_mcp_file(&global_claude.join("settings").join("mcp.json"), true, &mut config.mcp_servers);
        load_mcp_file(&global_claude.join("settings").join("mcp-disabled.json"), false, &mut config.mcp_servers);

        // TASK-108 / TASK-109 / TASK-110: output styles, hooks, statusline.
        config.output_styles.extend(scan_output_styles(&global_claude, true));
        let global_settings = parse_settings_json(&global_claude.join("settings.json"));
        if let Some(ref settings) = global_settings {
            config.hooks.extend(extract_hooks_from_settings(settings, true));
            // Global statusline only applies if no project statusline is set later.
            config.statusline = extract_statusline_from_settings(settings, true);
        }
    }

    // Local: <project>/.claude/
    if let Some(ref project) = project_path {
        let local_claude = Path::new(project).join(".claude");
        config.agents.extend(scan_agents(&local_claude, false));
        config.commands.extend(scan_commands(&local_claude, false));
        config.memory_files.extend(scan_memory_files(Some(project), &local_claude, false));
        load_mcp_file(&local_claude.join("settings").join("mcp.json"), true, &mut config.mcp_servers);
        load_mcp_file(&local_claude.join("settings").join("mcp-disabled.json"), false, &mut config.mcp_servers);

        // TASK-108 / TASK-109 / TASK-110: output styles, hooks, statusline.
        config.output_styles.extend(scan_output_styles(&local_claude, false));
        let local_settings = parse_settings_json(&local_claude.join("settings.json"));
        if let Some(ref settings) = local_settings {
            config.hooks.extend(extract_hooks_from_settings(settings, false));
            // Project statusline wins over global per TASK-110.
            if let Some(sl) = extract_statusline_from_settings(settings, false) {
                config.statusline = Some(sl);
            }
        }
    }

    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_with_always_apply_true() {
        let input = "---\nalwaysApply: true\n---\n# Title\nSome body text";
        let (always_apply, excerpt) = parse_frontmatter(input);
        assert!(always_apply);
        assert_eq!(excerpt, "Some body text");
    }

    #[test]
    fn parse_frontmatter_with_always_apply_false() {
        let input = "---\nalwaysApply: false\n---\nBody here";
        let (always_apply, excerpt) = parse_frontmatter(input);
        assert!(!always_apply);
        assert_eq!(excerpt, "Body here");
    }

    #[test]
    fn parse_frontmatter_missing_returns_false() {
        let input = "# No frontmatter\nJust content";
        let (always_apply, excerpt) = parse_frontmatter(input);
        assert!(!always_apply);
        assert_eq!(excerpt, "Just content");
    }

    #[test]
    fn parse_frontmatter_skips_headings_in_excerpt() {
        let input = "---\nalwaysApply: true\n---\n# Heading\n## Subheading\nActual content";
        let (_, excerpt) = parse_frontmatter(input);
        assert_eq!(excerpt, "Actual content");
    }

    #[test]
    fn parse_frontmatter_truncates_long_excerpt() {
        let long_line = "a".repeat(200);
        let input = format!("---\nalwaysApply: false\n---\n{}", long_line);
        let (_, excerpt) = parse_frontmatter(&input);
        assert_eq!(excerpt.len(), 120);
    }

    #[test]
    fn parse_frontmatter_empty_body() {
        let input = "---\nalwaysApply: true\n---\n";
        let (always_apply, excerpt) = parse_frontmatter(input);
        assert!(always_apply);
        assert_eq!(excerpt, "");
    }

    #[test]
    fn parse_frontmatter_only_whitespace_body() {
        let input = "---\nalwaysApply: false\n---\n   \n  \n";
        let (_, excerpt) = parse_frontmatter(input);
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
        let tmp = std::env::temp_dir().join("klaudex_test_nonexistent_agents");
        assert!(super::scan_agents(&tmp, true).is_empty());
    }

    #[test]
    fn scan_commands_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("klaudex_test_nonexistent_commands");
        assert!(super::scan_commands(&tmp, false).is_empty());
    }

    #[test]
    fn scan_memory_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("klaudex_test_nonexistent_memory");
        assert!(super::scan_memory_files(None, &tmp, true).is_empty());
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
    fn scan_commands_reads_md_files() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("commands");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("my-command.md"), "# My Command\nDo something").unwrap();
        let result = super::scan_commands(tmp.path(), false);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "my-command");
        assert_eq!(result[0].source, "local");
    }

    #[test]
    fn scan_memory_finds_claude_md() {
        let tmp = tempfile::tempdir().unwrap();
        let claude_dir = tmp.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        // Root CLAUDE.md
        std::fs::write(tmp.path().join("CLAUDE.md"), "# Project\nProject instructions").unwrap();
        // .claude/CLAUDE.md
        std::fs::write(claude_dir.join("CLAUDE.md"), "---\nalwaysApply: true\n---\nInner instructions").unwrap();
        let result = super::scan_memory_files(Some(tmp.path().to_str().unwrap()), &claude_dir, false);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "CLAUDE.md");
        assert!(result[0].always_apply); // root always applies
        assert_eq!(result[1].name, ".claude/CLAUDE.md");
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
        assert!(!servers[0].enabled);
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
    fn claude_config_default_is_empty() {
        let config = super::ClaudeConfig::default();
        assert!(config.agents.is_empty());
        assert!(config.mcp_servers.is_empty());
        assert!(config.commands.is_empty());
        assert!(config.memory_files.is_empty());
        assert!(config.output_styles.is_empty());
        assert!(config.hooks.is_empty());
        assert!(config.statusline.is_none());
    }

    // -------------------------------------------------------------------
    // TASK-108: scan_output_styles
    // -------------------------------------------------------------------

    #[test]
    fn scan_output_styles_nonexistent_dir_returns_empty() {
        let tmp = std::env::temp_dir().join("klaudex_test_nonexistent_output_styles");
        assert!(super::scan_output_styles(&tmp, true).is_empty());
    }

    #[test]
    fn scan_output_styles_parses_frontmatter_name_and_description() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("output-styles");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("concise.md"),
            "---\nname: Concise\ndescription: Short replies\n---\nBody content here\n",
        )
        .unwrap();
        let result = super::scan_output_styles(tmp.path(), true);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Concise");
        assert_eq!(result[0].description, "Short replies");
        assert_eq!(result[0].body, "Body content here\n");
        assert_eq!(result[0].source, "global");
    }

    #[test]
    fn scan_output_styles_falls_back_to_filename_when_name_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("output-styles");
        std::fs::create_dir_all(&dir).unwrap();
        // No frontmatter at all.
        std::fs::write(dir.join("verbose.md"), "Just the body, no frontmatter").unwrap();
        // Frontmatter without `name`.
        std::fs::write(
            dir.join("terse.md"),
            "---\ndescription: Tiny\n---\nbody",
        )
        .unwrap();
        let mut result = super::scan_output_styles(tmp.path(), false);
        result.sort_by(|a, b| a.name.cmp(&b.name));
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "terse");
        assert_eq!(result[0].description, "Tiny");
        assert_eq!(result[1].name, "verbose");
        assert_eq!(result[1].source, "project");
    }

    #[test]
    fn scan_output_styles_skips_malformed_and_continues() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("output-styles");
        std::fs::create_dir_all(&dir).unwrap();
        // Malformed: opening `---` but no closing — parse_output_style_frontmatter
        // returns the original content as the body, with no name/description.
        std::fs::write(dir.join("broken.md"), "---\nname: oops\n(no closing fence)").unwrap();
        // Good file.
        std::fs::write(
            dir.join("good.md"),
            "---\nname: Good\n---\nbody",
        )
        .unwrap();
        // Hidden file is ignored.
        std::fs::write(dir.join(".hidden.md"), "ignored").unwrap();
        // Non-md is ignored.
        std::fs::write(dir.join("notes.txt"), "ignored").unwrap();
        let result = super::scan_output_styles(tmp.path(), true);
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|s| s.name == "Good"));
        // Malformed file falls back to filename for `name`.
        assert!(result.iter().any(|s| s.name == "broken"));
    }

    // -------------------------------------------------------------------
    // TASK-109: scan_hooks
    // -------------------------------------------------------------------

    #[test]
    fn scan_hooks_nonexistent_settings_returns_empty() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(super::scan_hooks(tmp.path(), true).is_empty());
    }

    #[test]
    fn scan_hooks_no_hooks_key_returns_empty() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("settings.json"), r#"{"theme": "dark"}"#).unwrap();
        assert!(super::scan_hooks(tmp.path(), true).is_empty());
    }

    #[test]
    fn scan_hooks_malformed_json_returns_empty() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("settings.json"), "{not valid json").unwrap();
        // Should log a warning and return empty rather than panicking.
        assert!(super::scan_hooks(tmp.path(), false).is_empty());
    }

    #[test]
    fn scan_hooks_parses_all_four_events() {
        let tmp = tempfile::tempdir().unwrap();
        let json = r#"{
            "hooks": {
                "PreToolUse":   [{"matcher": "Bash(*)",  "command": "echo pre"}],
                "PostToolUse":  [{"matcher": "Edit(*)",  "command": "echo post"}],
                "SessionStart": [{"command": "echo start"}],
                "Stop":         [{"command": "echo stop"}]
            }
        }"#;
        std::fs::write(tmp.path().join("settings.json"), json).unwrap();
        let result = super::scan_hooks(tmp.path(), true);
        assert_eq!(result.len(), 4);
        let by_event: std::collections::HashMap<_, _> = result
            .iter()
            .map(|h| (h.event.as_str(), h))
            .collect();
        assert_eq!(by_event["PreToolUse"].matcher.as_deref(), Some("Bash(*)"));
        assert_eq!(by_event["PreToolUse"].command, "echo pre");
        assert_eq!(by_event["PostToolUse"].matcher.as_deref(), Some("Edit(*)"));
        assert_eq!(by_event["SessionStart"].matcher, None);
        assert_eq!(by_event["SessionStart"].command, "echo start");
        assert_eq!(by_event["Stop"].command, "echo stop");
        assert!(result.iter().all(|h| h.source == "global"));
    }

    // -------------------------------------------------------------------
    // TASK-110: read_statusline
    // -------------------------------------------------------------------

    #[test]
    fn read_statusline_nonexistent_settings_returns_none() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(super::read_statusline(tmp.path(), true).is_none());
    }

    #[test]
    fn read_statusline_no_statusline_key_returns_none() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("settings.json"), r#"{"theme": "dark"}"#).unwrap();
        assert!(super::read_statusline(tmp.path(), true).is_none());
    }

    #[test]
    fn read_statusline_happy_path() {
        let tmp = tempfile::tempdir().unwrap();
        let json = r#"{
            "statusLine": {
                "type": "command",
                "command": "echo hi",
                "padding": 2
            }
        }"#;
        std::fs::write(tmp.path().join("settings.json"), json).unwrap();
        let sl = super::read_statusline(tmp.path(), false).expect("statusline should parse");
        assert_eq!(sl.kind, "command");
        assert_eq!(sl.command, "echo hi");
        assert_eq!(sl.padding, Some(2));
        assert_eq!(sl.source, "project");
    }

    #[test]
    fn read_statusline_padding_optional() {
        let tmp = tempfile::tempdir().unwrap();
        let json = r#"{"statusLine": {"type": "command", "command": "x"}}"#;
        std::fs::write(tmp.path().join("settings.json"), json).unwrap();
        let sl = super::read_statusline(tmp.path(), true).expect("statusline should parse");
        assert_eq!(sl.padding, None);
    }

    #[test]
    fn read_statusline_non_command_type_returns_none() {
        let tmp = tempfile::tempdir().unwrap();
        let json = r#"{"statusLine": {"type": "static", "text": "hello"}}"#;
        std::fs::write(tmp.path().join("settings.json"), json).unwrap();
        // Non-"command" kind → log warning + None.
        assert!(super::read_statusline(tmp.path(), true).is_none());
    }

    #[test]
    fn read_statusline_malformed_json_returns_none() {
        // Plan acceptance: malformed settings.json → read_statusline returns
        // None without panicking. Mirror of scan_hooks_malformed_json_returns_empty.
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("settings.json"), "{not valid json").unwrap();
        assert!(super::read_statusline(tmp.path(), true).is_none());
    }
}
