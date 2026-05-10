//! Permission pattern matcher for Claude Code style permission rules.
//!
//! See `plans/claude-code-features.md` TASK-102. Pure function — no IO, no
//! Tauri state. The frontend / settings layer is responsible for loading the
//! allow / deny lists and routing the decision back into the agent.
//!
//! ## Pattern grammar
//!
//! Each pattern has the shape `Tool(spec)` where `Tool` is the bare tool
//! name (e.g. `Bash`, `Read`, `Edit`) and `spec` describes how the tool's
//! argument string must look.
//!
//! `spec` has two flavours, distinguished by the presence of a `:`
//! separator:
//!
//! 1. **Command-prefix flavour** (`Bash(npm test:*)`):
//!    Split on the first `:`. The portion before is matched as a literal
//!    *command prefix*: `args` must either equal it exactly or start with
//!    it followed by ASCII whitespace. The portion after is a glob applied
//!    to whatever remains of `args` after the prefix is consumed (including
//!    any leading whitespace). This is the syntax Claude Code itself uses
//!    so a user can paste `Bash(npm test:*)` and have it match `npm test`,
//!    `npm test --watch`, etc., but not `npm install` or `npm tests`.
//!
//! 2. **Plain-glob flavour** (`Read(./src/**)`, `Bash(*)`):
//!    No `:` in `spec`. The full `spec` is a glob matched against `args`
//!    verbatim. Useful for path-shaped tools like `Read` / `Edit` where
//!    there's no notion of a command prefix, and for catch-all rules like
//!    `Bash(*)`.
//!
//! ## Glob syntax
//!
//! - `*` matches any sequence of characters, including the empty string.
//! - `**` is currently treated as an alias for `*`. Keeping it distinct in
//!   the grammar lets future versions layer path-segment semantics on top
//!   without a syntax break.
//! - Any other character is matched literally.
//!
//! ## Decision precedence
//!
//! Deny rules win. If any deny pattern matches, the result is `Deny` even
//! when an allow pattern also matches. This mirrors Claude Code semantics
//! so a user can paste a broad `Bash(*)` allow and still safely deny e.g.
//! `Bash(rm:*)` without re-ordering rules.
//!
//! Malformed patterns (missing `(`, unbalanced `)`, empty tool name) are
//! logged via `log::warn!` and skipped — the matcher never panics on user
//! input.

/// Outcome of matching a tool invocation against an allow + deny ruleset.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    /// At least one allow pattern matched, no deny pattern matched.
    Allow,
    /// At least one deny pattern matched. Wins regardless of allows.
    Deny,
    /// Neither list contained a matching pattern. Caller decides what to do
    /// next (usually fall through to the configured permission `mode`).
    NoMatch,
}

/// Match a tool invocation against allow + deny pattern lists.
///
/// `tool` is the bare tool name (e.g. `"Bash"`). `args` is the full
/// arguments string the agent intends to run. `allow` and `deny` are slices
/// of pattern strings in the `Tool(spec)` grammar described in the module
/// docs.
///
/// Returns:
/// - `Decision::Deny`    if any deny pattern matches (wins over allow).
/// - `Decision::Allow`   if any allow pattern matches and no deny pattern
///                       matches.
/// - `Decision::NoMatch` otherwise.
///
/// Malformed patterns are logged via `log::warn!` and skipped.
pub fn match_permission(
    tool: &str,
    args: &str,
    allow: &[String],
    deny: &[String],
) -> Decision {
    // Deny first — short-circuits on the first matching deny rule so a
    // broad allow can never override a narrower deny.
    for raw in deny {
        match parse_pattern(raw) {
            Some((pt, spec)) => {
                if pt == tool && spec_match(spec, args) {
                    return Decision::Deny;
                }
            }
            None => log::warn!("permissions: malformed deny pattern: {raw}"),
        }
    }

    for raw in allow {
        match parse_pattern(raw) {
            Some((pt, spec)) => {
                if pt == tool && spec_match(spec, args) {
                    return Decision::Allow;
                }
            }
            None => log::warn!("permissions: malformed allow pattern: {raw}"),
        }
    }

    Decision::NoMatch
}

/// Split `Tool(spec)` into `(tool, spec)`.
///
/// Returns `None` if the pattern is malformed:
/// - missing `(`
/// - missing trailing `)`
/// - empty tool name (`(*)` etc.)
///
/// The `spec` portion is allowed to be empty (`Bash()`) — that pattern
/// matches only the empty args string.
fn parse_pattern(s: &str) -> Option<(&str, &str)> {
    let open = s.find('(')?;
    if !s.ends_with(')') {
        return None;
    }
    let tool = s[..open].trim();
    if tool.is_empty() {
        return None;
    }
    let spec = &s[open + 1..s.len() - 1];
    Some((tool, spec))
}

/// Apply the parenthesized `spec` to `args`.
///
/// If `spec` contains `:`, it is split on the first `:` into
/// `(command_prefix, suffix_glob)`:
///
/// - `command_prefix` must match `args` exactly OR be followed in `args`
///   by ASCII whitespace (so `Bash(npm test:*)` matches `"npm test"` and
///   `"npm test --watch"` but never `"npm tests"`).
/// - `suffix_glob` is then matched against the remainder of `args` (which
///   includes the leading whitespace).
///
/// If `spec` contains no `:`, it is matched against `args` verbatim as a
/// plain glob.
fn spec_match(spec: &str, args: &str) -> bool {
    if let Some(colon) = spec.find(':') {
        let prefix = &spec[..colon];
        let suffix_glob = &spec[colon + 1..];

        if prefix.is_empty() {
            // `Bash(:*)` — no prefix, just a suffix glob over the whole
            // args string. Equivalent to `Bash(*)`.
            return glob_match(suffix_glob, args);
        }

        // Prefix must match exactly OR be followed by whitespace.
        if let Some(rest) = args.strip_prefix(prefix) {
            if rest.is_empty() {
                // Exact match: the suffix glob must accept empty input.
                return glob_match(suffix_glob, "");
            }
            if rest.starts_with(|c: char| c.is_ascii_whitespace()) {
                return glob_match(suffix_glob, rest);
            }
        }
        false
    } else {
        glob_match(spec, args)
    }
}

/// Match `args` against a glob string.
///
/// Algorithm:
/// 1. Normalise repeated `*` (so `**`, `***` etc. all collapse to `*`).
/// 2. Split the glob on `*` into literal segments. The wildcard is then
///    represented by the *boundaries* between segments.
/// 3. The first segment must appear at the start of `args` unless the glob
///    starts with `*`. Each subsequent segment must appear at or after the
///    cursor (i.e. somewhere in the remaining tail). The last segment must
///    end at `args.len()` unless the glob ends with `*`.
///
/// Edge cases:
/// - Empty glob matches only empty args.
/// - Glob of `*` (or `**`, or `***`) matches any args.
fn glob_match(glob: &str, args: &str) -> bool {
    // Treat repeated stars the same as a single `*`. Done in a loop so
    // `***` etc. collapse too.
    let mut normalised = glob.to_owned();
    while normalised.contains("**") {
        normalised = normalised.replace("**", "*");
    }
    let glob = normalised.as_str();

    if glob.is_empty() {
        return args.is_empty();
    }

    let starts_with_star = glob.starts_with('*');
    let ends_with_star = glob.ends_with('*');

    // Split on `*`. `"*foo*"` → `["", "foo", ""]`, `"*"` → `["", ""]`.
    let parts: Vec<&str> = glob.split('*').collect();

    // Pure-wildcard glob: every segment empty → match anything.
    if parts.iter().all(|p| p.is_empty()) {
        return true;
    }

    // Walk through the non-empty literal segments in order, tracking a
    // cursor over `args`.
    let literals: Vec<(usize, &str)> = parts
        .iter()
        .enumerate()
        .filter(|(_, p)| !p.is_empty())
        .map(|(i, p)| (i, *p))
        .collect();

    let mut cursor = 0usize;
    let first_literal_idx = literals.first().map(|(i, _)| *i);

    for (idx_in_parts, lit) in &literals {
        let is_first_literal = Some(*idx_in_parts) == first_literal_idx;

        if is_first_literal && !starts_with_star {
            // Anchored to the start of `args`.
            if !args[cursor..].starts_with(lit) {
                return false;
            }
            cursor += lit.len();
        } else {
            // Free to appear anywhere at or after the cursor.
            match args[cursor..].find(lit) {
                Some(pos) => cursor += pos + lit.len(),
                None => return false,
            }
        }
    }

    // Trailing anchor: the final literal must consume the rest of `args`
    // unless the glob ends with `*`.
    if !ends_with_star && cursor != args.len() {
        return false;
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| (*x).to_string()).collect()
    }

    // ---------------------------------------------------------------------
    // High-level decision tests (acceptance criteria)
    // ---------------------------------------------------------------------

    #[test]
    fn allows_when_pattern_matches() {
        let allow = s(&["Bash(npm test:*)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Bash", "npm test --watch", &allow, &deny),
            Decision::Allow,
        );
    }

    #[test]
    fn denies_when_deny_pattern_matches() {
        let allow: Vec<String> = vec![];
        let deny = s(&["Bash(rm:*)"]);
        assert_eq!(
            match_permission("Bash", "rm -rf /", &allow, &deny),
            Decision::Deny,
        );
    }

    #[test]
    fn deny_overrides_allow_when_both_match() {
        // Broad allow, narrow deny: the deny must win.
        let allow = s(&["Bash(*)"]);
        let deny = s(&["Bash(rm:*)"]);
        assert_eq!(
            match_permission("Bash", "rm -rf node_modules", &allow, &deny),
            Decision::Deny,
        );
        // Sanity: another Bash command still matches the broad allow.
        assert_eq!(
            match_permission("Bash", "npm install", &allow, &deny),
            Decision::Allow,
        );
    }

    #[test]
    fn no_match_returns_no_match() {
        let allow = s(&["Read(./src/**)"]);
        let deny = s(&["Bash(rm:*)"]);
        // Tool matches an allow rule's tool but the args don't match the spec.
        assert_eq!(
            match_permission("Read", "./node_modules/foo.ts", &allow, &deny),
            Decision::NoMatch,
        );
        // Tool not represented in either list at all.
        assert_eq!(
            match_permission("Edit", "file.ts", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn empty_lists_return_no_match() {
        let allow: Vec<String> = vec![];
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Bash", "npm test", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn malformed_pattern_skipped_not_panicked() {
        // Each of these is malformed in a different way.
        let allow = s(&[
            "Bash(",      // missing close paren
            "(npm test)", // empty tool
            "no parens",  // no parens at all
        ]);
        let deny = s(&["Read(./src/**)"]);
        // Allow list is entirely malformed → no allow match. Deny list has a
        // valid pattern that shouldn't apply → NoMatch (not panic).
        assert_eq!(
            match_permission("Bash", "npm test", &allow, &deny),
            Decision::NoMatch,
        );
        // And a malformed pattern definitely does not produce an Allow on
        // any input.
        assert_eq!(
            match_permission("Bash", "rm -rf /", &allow, &deny),
            Decision::NoMatch,
        );
    }

    // ---------------------------------------------------------------------
    // Glob-level tests
    // ---------------------------------------------------------------------

    #[test]
    fn glob_star_matches_anything() {
        assert!(glob_match("*", ""));
        assert!(glob_match("*", "anything goes"));
        assert!(glob_match("**", "still anything"));
        assert!(glob_match("***", "ignored extra stars"));
    }

    #[test]
    fn prefix_match_via_trailing_star() {
        // The TASK-102 acceptance criterion: `Bash(npm test:*)` matches
        // both `args="npm test"` (with empty suffix) and `args="npm test
        // --watch"` (with trailing args).
        let allow = s(&["Bash(npm test:*)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Bash", "npm test", &allow, &deny),
            Decision::Allow,
        );
        assert_eq!(
            match_permission("Bash", "npm test --watch", &allow, &deny),
            Decision::Allow,
        );
        // Args that don't share the prefix should not match.
        assert_eq!(
            match_permission("Bash", "npm install", &allow, &deny),
            Decision::NoMatch,
        );
        // Word-boundary: `npm tests` is NOT `npm test`.
        assert_eq!(
            match_permission("Bash", "npm tests", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn read_with_path_glob() {
        // `Read(./src/**)` matches anything under `./src/`.
        let allow = s(&["Read(./src/**)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Read", "./src/foo.ts", &allow, &deny),
            Decision::Allow,
        );
        assert_eq!(
            match_permission("Read", "./src/nested/dir/bar.tsx", &allow, &deny),
            Decision::Allow,
        );
    }

    #[test]
    fn read_does_not_match_outside_glob() {
        // Failure case from acceptance criteria: `Read(./src/**)` must NOT
        // match a path outside `./src/`.
        let allow = s(&["Read(./src/**)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Read", "./node_modules/foo.ts", &allow, &deny),
            Decision::NoMatch,
        );
        assert_eq!(
            match_permission("Read", "/etc/passwd", &allow, &deny),
            Decision::NoMatch,
        );
    }

    // ---------------------------------------------------------------------
    // Extra coverage for parser + spec/glob edge cases
    // ---------------------------------------------------------------------

    #[test]
    fn exact_match_with_no_wildcard() {
        // Glob with no `*` at all is an exact-string match against args.
        let allow = s(&["Read(./src/foo.ts)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Read", "./src/foo.ts", &allow, &deny),
            Decision::Allow,
        );
        assert_eq!(
            match_permission("Read", "./src/foo.tsx", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn tool_name_is_case_sensitive() {
        // We don't lowercase tool names — Claude Code uses PascalCase
        // canonically (`Bash`, `Read`) and a stray `bash(...)` should not
        // silently match.
        let allow = s(&["Bash(*)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("bash", "ls", &allow, &deny),
            Decision::NoMatch,
        );
        assert_eq!(
            match_permission("Bash", "ls", &allow, &deny),
            Decision::Allow,
        );
    }

    #[test]
    fn middle_wildcard_matches_inner_segment() {
        // Plain-glob spec with a `*` in the middle.
        let allow = s(&["Read(./src/*/index.ts)"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Read", "./src/foo/index.ts", &allow, &deny),
            Decision::Allow,
        );
        assert_eq!(
            match_permission("Read", "./src/foo/index.tsx", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn parse_pattern_rejects_malformed_inputs() {
        assert!(parse_pattern("Bash(").is_none());
        assert!(parse_pattern("Bash)").is_none());
        assert!(parse_pattern("nothing").is_none());
        assert!(parse_pattern("(empty)").is_none());
        // Valid: empty spec is allowed (matches only empty args).
        assert_eq!(parse_pattern("Bash()"), Some(("Bash", "")));
        // Valid: nested parens close at the trailing `)`.
        assert_eq!(parse_pattern("Bash(echo (hi))"), Some(("Bash", "echo (hi)")));
    }

    #[test]
    fn empty_spec_only_matches_empty_args() {
        // `Bash()` — only the empty-args invocation matches.
        let allow = s(&["Bash()"]);
        let deny: Vec<String> = vec![];
        assert_eq!(
            match_permission("Bash", "", &allow, &deny),
            Decision::Allow,
        );
        assert_eq!(
            match_permission("Bash", "ls", &allow, &deny),
            Decision::NoMatch,
        );
    }

    #[test]
    fn command_prefix_word_boundary() {
        // Direct unit test of the spec layer: `npm test:*` must NOT match
        // `"npm tests"` even though the literal `npm test` is a string
        // prefix — there's no whitespace between the prefix and the next
        // character, so it's a different command.
        assert!(spec_match("npm test:*", "npm test"));
        assert!(spec_match("npm test:*", "npm test --watch"));
        assert!(!spec_match("npm test:*", "npm tests"));
        assert!(!spec_match("npm test:*", "npm install"));
    }
}
