export type TaskStatus = 'running' | 'paused' | 'completed' | 'error' | 'cancelled' | 'pending_permission'

// ── Tool calls (matches ACP ToolCall / ToolCallUpdate) ────────────

export type ToolKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'switch_mode' | 'other'
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface ToolCallLocation {
  path: string
  line?: number | null
}

export interface ToolCallContentItem {
  type: 'content' | 'diff' | 'terminal'
  /** For type=content: text block */
  text?: string
  /** For type=diff */
  path?: string
  oldText?: string | null
  newText?: string
  /** For type=terminal */
  terminalId?: string
}

export interface ToolCall {
  toolCallId: string
  title: string
  status: ToolCallStatus
  kind?: ToolKind
  locations?: ToolCallLocation[]
  content?: ToolCallContentItem[]
  rawInput?: unknown
  rawOutput?: unknown
  /** ISO timestamp of when the tool call first appeared.
   *  Used by the inline-tool-calls layout to order tool entries
   *  relative to the surrounding text. Optional for back-compat. */
  createdAt?: string
}

/**
 * Anchor that records where a tool call appeared in the assistant prose
 * stream, so the timeline can interleave tool entries between text segments
 * when "Inline tool calls" is enabled. `at` is a UTF-16 character offset
 * into {@link TaskMessage.content}; `toolCallId` matches an entry in
 * {@link TaskMessage.toolCalls}.
 */
export interface ToolCallSplit {
  at: number
  toolCallId: string
}

// ── Plan (matches ACP Plan / PlanEntry) ───────────────────────────

export type PlanEntryStatus = 'pending' | 'in_progress' | 'completed'
export type PlanEntryPriority = 'high' | 'medium' | 'low'

export interface PlanStep {
  content: string
  status: PlanEntryStatus
  priority: PlanEntryPriority
}

// ── Messages ──────────────────────────────────────────────────────

export interface TaskMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
  thinking?: string
  questionAnswers?: { question: string; answer: string }[]
  /**
   * Anchors recording where each tool call appeared in {@link content}
   * during streaming. Sorted ascending by `at`. Used by the inline-tool-calls
   * layout to interleave tool entries with text segments. Optional — older
   * persisted messages without splits fall back to grouped rendering.
   */
  toolCallSplits?: ToolCallSplit[]
}

// ── Task ──────────────────────────────────────────────────────────

export type CompactionStatus = 'idle' | 'compacting' | 'completed' | 'failed'

export interface AgentTask {
  id: string
  name: string
  workspace: string
  status: TaskStatus
  createdAt: string
  messages: TaskMessage[]
  pendingPermission?: {
    requestId: string
    toolName: string
    description: string
    input?: Record<string, unknown>
    decisionReason?: string
    options: Array<{ optionId: string; name: string; kind: string }>
  }
  /** Live tool calls for the current turn (cleared on turn end) */
  liveToolCalls?: ToolCall[]
  /** Live thinking text for the current turn */
  liveThinking?: string
  /** Current plan */
  plan?: PlanStep[]
  /** Context usage: used / size + optional token breakdown */
  contextUsage?: { used: number; size: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number } | null
  /** Cumulative cost in USD for this task */
  totalCost?: number
  /** Current compaction status */
  compactionStatus?: CompactionStatus
  agentProfileId?: string
  /** True only when the user explicitly hit Pause mid-run (not draft/idle) */
  userPaused?: boolean
  /** Task ID of the parent thread this was forked from */
  parentTaskId?: string
  /** True for threads restored from persisted history (read-only) */
  isArchived?: boolean
  /** Path to the git worktree directory, if this thread uses one */
  worktreePath?: string
  /** Original workspace path before worktree was created */
  originalWorkspace?: string
  /** Canonical project workspace path — threads always group under this */
  projectId?: string
  /** True for restored threads whose backend ACP connection was destroyed */
  needsNewConnection?: boolean
}

// ── Soft-deleted threads ──────────────────────────────────────────

export interface SoftDeletedThread {
  readonly task: AgentTask
  readonly deletedAt: string
}

// ── Profiles ──────────────────────────────────────────────────────

export interface AgentProfile {
  id: string
  name: string
  agentId: string
  tags: string[]
  isDefault: boolean
}

export interface ActivityEntry {
  taskId: string
  taskName: string
  status: TaskStatus
  timestamp: string
}

export interface ProjectPrefs {
  modelId?: string | null
  autoApprove?: boolean
  worktreeEnabled?: boolean
  symlinkDirectories?: string[]
  tightSandbox?: boolean
  iconOverride?: { type: 'framework'; id: string } | { type: 'file'; path: string } | { type: 'emoji'; emoji: string } | null
}

export type SidebarPosition = 'left' | 'right'
export type ThemeMode = 'dark' | 'light' | 'system'

export interface AppSettings {
  claudeBin: string
  agentProfiles: AgentProfile[]
  /** Global UI font size in px (sidebar, file tree, header, dialogs, etc.). */
  fontSize: number
  /**
   * Chat content font size in px (markdown body, assistant text, user message bubble,
   * and the chat textarea / "Type a message" affordance). Falls back to {@link fontSize}.
   */
  chatFontSize?: number
  defaultModel?: string | null
  autoApprove?: boolean
  respectGitignore?: boolean
  coAuthor?: boolean
  coAuthorJsonReport?: boolean
  notifications?: boolean
  soundNotifications?: boolean
  projectPrefs?: Record<string, ProjectPrefs>
  hasOnboardedV2?: boolean
  sidebarPosition?: SidebarPosition
  /** Theme mode: dark, light, or system (follows OS preference). Default: dark. */
  theme?: ThemeMode
  /** Opt-in flag for anonymous product analytics. Default: true. */
  analyticsEnabled?: boolean
  /** Random UUID generated on first opt-in, cleared on opt-out. */
  analyticsAnonId?: string | null
  /** Max character limit for /btw side questions. Default: 1220. */
  btwMaxChars?: number
  /** Base64 data URL for a user-supplied app icon (About dialog + dock). */
  customAppIcon?: string | null
  /** Last app version whose changelog the user has seen. Used to show the "What's New" dialog once per upgrade. */
  lastSeenChangelogVersion?: string | null
  /** Terminal scrollback line cap. Lower = less memory per open terminal. Default: 2000. */
  terminalScrollback?: number
  /** Auto-close background terminal tabs after this many minutes of no PTY activity. null = disabled. Default: null. */
  terminalAutoCloseIdleMins?: number | null
  /**
   * When true, tool calls render inline within the assistant's prose at the
   * exact point where the agent invoked them — similar to Cursor / Kiro IDE.
   * When false (default), tool calls are grouped into a single card after
   * the assistant text. Only affects rendering; persisted data is the same.
   */
  inlineToolCalls?: boolean
}

export interface ProjectFile {
  path: string
  name: string
  dir: string
  isDir: boolean
  ext: string
  /** Git status: "M" modified, "A" added/new, "D" deleted, "R" renamed, "" clean */
  gitStatus?: string
  /** Lines added in working copy (0 if unchanged) */
  linesAdded?: number
  /** Lines deleted in working copy (0 if unchanged) */
  linesDeleted?: number
  /** File modification time as Unix epoch seconds */
  modifiedAt: number
}

// ── Claude Configuration Types ──────────────────────────────────────

export interface ClaudeAgent {
  name: string
  description: string
  tools: string[]
  source: 'global' | 'local'
  filePath: string
}

export interface ClaudeCommand {
  name: string
  source: 'global' | 'local'
  filePath: string
}

export interface ClaudeMemoryFile {
  name: string
  alwaysApply: boolean
  source: 'global' | 'local'
  excerpt: string
  filePath: string
}

export interface ClaudeMcpServer {
  name: string
  enabled: boolean
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  error?: string
  disabledTools?: string[]
  filePath: string
  status?: 'connecting' | 'ready' | 'needs-auth' | 'error'
  oauthUrl?: string
}

export interface ClaudeOutputStyle {
  name: string
  description?: string
  body: string
  source: 'global' | 'project'
  filePath: string
}

export interface ClaudeHook {
  event: string
  matcher?: string
  command: string
  source: 'global' | 'project'
}

export interface StatuslineConfig {
  kind: string
  command: string
  padding?: number
  source: 'global' | 'project'
}

export interface ClaudeConfig {
  agents: ClaudeAgent[]
  commands: ClaudeCommand[]
  memoryFiles: ClaudeMemoryFile[]
  mcpServers?: ClaudeMcpServer[]
  outputStyles?: ClaudeOutputStyle[]
  hooks?: ClaudeHook[]
  statusline?: StatuslineConfig | null
}


// ── Subagents (ACP extension: kiro.dev/subagent/list_update) ──────

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SubagentInfo {
  readonly name: string
  readonly subName?: string
  readonly status: SubagentStatus
  readonly role?: string
  readonly description?: string
  readonly dependsOn?: readonly string[]
  readonly currentToolCall?: string
  readonly isThinking?: boolean
  readonly raw: unknown
}

// ── Attachments ───────────────────────────────────────────────────

export type AttachmentType = 'image' | 'text' | 'binary'

export interface Attachment {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly type: AttachmentType
  readonly size: number
  readonly mimeType: string
  /** Base64 data URL for image previews */
  preview?: string
  /** Text content for text files */
  textContent?: string
  /** Base64 content for binary embedding */
  base64Content?: string
}

/** Structured image attachment data sent to the Rust backend via IPC (fix #14). */
export interface IpcAttachment {
  readonly base64: string
  readonly mimeType: string
  readonly name: string
}

// ── Debug Panel Types ─────────────────────────────────────────────

export type DebugCategory = 'notification' | 'request' | 'response' | 'error' | 'stderr' | 'lifecycle' | 'ipc' | 'store' | 'git' | 'pty' | 'event'

export interface DebugLogEntry {
  id: number
  timestamp: string
  direction: 'in' | 'out'
  category: DebugCategory
  type: string
  taskId: string | null
  summary: string
  payload: unknown
  isError: boolean
  mcpServerName?: string
}

// ── JS Debug Panel Types ──────────────────────────────────────────

export type JsDebugCategory = 'log' | 'warn' | 'error' | 'exception' | 'network' | 'rust'

export interface JsDebugEntry {
  readonly id: number
  readonly timestamp: string
  readonly category: JsDebugCategory
  readonly message: string
  readonly detail: string
  readonly isError: boolean
  /** Active task ID at capture time */
  readonly taskId?: string | null
  /** Active thread name at capture time */
  readonly threadName?: string | null
  /** Active project (workspace basename) at capture time */
  readonly projectName?: string | null
  /** Network request fields */
  readonly url?: string
  readonly method?: string
  readonly status?: number
  readonly duration?: number
}
