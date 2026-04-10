# Architecture

## System overview

```mermaid
graph TD
  subgraph Frontend["Frontend — React 19 + TypeScript"]
    Zustand["Zustand stores"]
    Components["React components"]
    Components --> Zustand
  end

  subgraph Backend["Backend — Rust (Tauri v2)"]
    ACP["acp.rs\n(kiro-cli subprocess)"]
    PTY["pty.rs\n(portable-pty)"]
    Git["git.rs\n(git2 / libgit2)"]
    Settings["settings.rs\n(confy)"]
    FsOps["fs_ops.rs\n(file ops, which)"]
    KiroConfig["kiro_config.rs\n(serde_yaml)"]
    Error["error.rs\n(thiserror)"]
  end

  Zustand -- "invoke() / listen()" --> ACP
  Zustand -- "invoke() / listen()" --> PTY
  Zustand -- "invoke()" --> Git
  Zustand -- "invoke()" --> Settings
  Zustand -- "invoke()" --> FsOps
  Zustand -- "invoke()" --> KiroConfig

  ACP -- "stdin/stdout" --> KiroCLI["kiro-cli acp"]
  PTY -- "PTY I/O" --> Shell["User shell"]
  Git -- "libgit2 FFI" --> Repo["Git repository"]
```

## Data flow

```mermaid
sequenceDiagram
  participant UI as React UI
  participant Store as Zustand store
  participant IPC as Tauri IPC
  participant ACP as acp.rs
  participant CLI as kiro-cli

  UI->>Store: user sends message
  Store->>IPC: invoke("send_message")
  IPC->>ACP: route to ACP command
  ACP->>CLI: write to stdin (JSON-RPC)
  CLI-->>ACP: stream response chunks (stdout)
  ACP-->>IPC: emit events
  IPC-->>Store: listen() callback
  Store-->>UI: re-render with new messages
```

## Backend modules

| Module | Purpose |
|--------|---------|
| `acp.rs` | Spawns `kiro-cli acp` as a subprocess, implements the ACP `Client` trait. Runs on a dedicated OS thread with a single-threaded tokio runtime (`!Send` futures). Communicates with Tauri via `mpsc` channels. |
| `git.rs` | Git operations via `git2` (libgit2). Branch, stage, commit, push, revert, diff. |
| `settings.rs` | Config persistence via `confy`. Handles XDG/macOS paths. |
| `fs_ops.rs` | File operations, kiro-cli detection via `which`, project file listing via git2 index. |
| `kiro_config.rs` | `.kiro/` config discovery. Parses agents, skills, steering rules, MCP servers. Frontmatter via `serde_yaml`. |
| `pty.rs` | Terminal emulation via `portable-pty`. |
| `error.rs` | Shared `AppError` type via `thiserror` with `From` impls for git2, IO, JSON, confy errors. |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 |
| Backend | Rust 2021, git2, thiserror, confy, serde_yaml, which |
| Frontend | React 19, TypeScript 5, Vite 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| UI | Radix UI, Lucide icons |
| Code | Shiki (syntax highlighting) |
| Terminal | xterm.js + portable-pty |
| Diff | @pierre/diffs |
| Markdown | react-markdown + remark-gfm |

See [CONTRIBUTING.md](../CONTRIBUTING.md) for code style, project layout, and additional details.
