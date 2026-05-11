//! Smoke test for git_ai. Run with:
//!
//! ```sh
//! cargo run --example git_ai_smoke -- /path/to/repo
//! ```
//!
//! Bypasses the SettingsState wiring by calling the internal helpers directly.

use klaudex_lib::commands::git_ai;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cwd = std::env::args().nth(1).expect("usage: git_ai_smoke <cwd>");
    let claude_bin =
        std::env::var("CLAUDE_BIN").unwrap_or_else(|_| "claude".to_string());

    let result = git_ai::generate_for_smoke(&claude_bin, &cwd).await?;
    println!("subject: {}", result.subject);
    if !result.body.is_empty() {
        println!("\nbody:\n{}", result.body);
    }
    Ok(())
}
