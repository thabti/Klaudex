import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { logIpc, logIpcResult, logIpcError, logEvent } from '@/lib/debug-logger'
import type { AgentTask, AppSettings, ClaudeConfig, ToolCall, PlanStep, DebugLogEntry, ProjectFile, IpcAttachment } from '@/types'

type UnsubscribeFn = () => void

/** Commands excluded from debug log — high-frequency background noise. */
const DEBUG_QUIET_COMMANDS = new Set([
  'git_diff_stats', 'git_list_branches', 'git_status', 'git_log', 'git_blame',
  'git_checkout_branch', 'git_create_branch', 'git_delete_branch', 'git_current_branch',
  'git_worktree_setup', 'git_worktree_remove', 'git_worktree_list',
  'detect_editors', 'detect_editors_background', 'detect_project_icon',
  'analytics_save', 'analytics_load', 'analytics_clear', 'analytics_db_size',
])

/** Instrumented invoke that logs request/response/error to the debug store. */
const tracedInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  const quiet = DEBUG_QUIET_COMMANDS.has(command)
  if (!quiet) logIpc(command, args)
  const start = performance.now()
  try {
    const result = await invoke<T>(command, args)
    if (!quiet) logIpcResult(command, result, Math.round(performance.now() - start))
    return result
  } catch (err) {
    if (!quiet) logIpcError(command, err, Math.round(performance.now() - start))
    throw err
  }
}

/** Payload for `claude-config-changed` events from `commands/claude_watcher.rs`. */
export interface ClaudeConfigChangedPayload {
  scope: 'global' | 'project'
  path: string
}

/**
 * One entry persisted in `analytics.redb` via `analytics_save`. Mirrors the
 * Rust `AnalyticsEvent` (camelCase via serde rename).
 */
export type { AnalyticsEvent } from '@/types/analytics'
import type { AnalyticsEvent } from '@/types/analytics'

/**
 * Progress events emitted by `git_clone` while libgit2 fetches objects.
 * Only the relative completion (received/total + indexedDeltas) is exposed —
 * the raw byte counts vary too widely between repo shapes to be useful.
 */
export interface GitCloneProgress {
  receivedObjects: number
  totalObjects: number
  indexedDeltas: number
}

/**
 * Mirror of the Rust `RecentProject` struct (camelCase via serde rename).
 *
 * `iconPath` is an optional renderer-side annotation — the Rust struct never
 * emits it today, but the sidebar's `RecentProjectsList` consumes it when
 * present so it can show a project icon next to each entry. Marked optional
 * so the Rust→JSON shape (which omits it entirely) still satisfies the type.
 */
export interface RecentProject {
  path: string
  name: string
  lastOpened: number
  iconPath?: string
}

/**
 * rAF-throttle helper: coalesces back-pressured events into one callback per
 * animation frame so a fast progress stream doesn't pin the React event loop.
 * The latest payload always wins.
 */
const throttleRaf = <T>(cb: (payload: T) => void): ((payload: T) => void) => {
  let scheduled = false
  let latest: T | undefined
  return (payload: T) => {
    latest = payload
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      if (latest !== undefined) cb(latest)
    })
  }
}

const tauriListen = <T>(event: string, cb: (payload: T) => void): UnsubscribeFn => {
  let unlisten: (() => void) | null = null
  let cleaned = false

  const ready = listen<T>(event, (e) => { if (!cleaned) cb(e.payload) })
  ready.then((fn) => {
    if (cleaned) {
      // Component already unmounted — schedule unlisten on next tick
      // to avoid synchronous throw from Tauri's internal listener map
      setTimeout(() => { try { fn() } catch { /* stale listener */ } }, 0)
    } else {
      unlisten = fn
    }
  }).catch(() => {})

  return () => {
    if (cleaned) return
    cleaned = true
    if (unlisten) {
      // Defer to avoid "listeners[eventId].handlerId" crash during HMR/StrictMode cleanup
      const fn = unlisten
      unlisten = null
      setTimeout(() => { try { fn() } catch { /* already removed */ } }, 0)
    }
    // If ready hasn't resolved yet, the .then() branch above handles it
  }
}

export const ipc = {
  createTask: (params: { name: string; workspace: string; prompt: string; autoApprove?: boolean; modeId?: string; modelId?: string; attachments?: IpcAttachment[]; existingId?: string; existingMessages?: Array<{ role: string; content: string; timestamp: string; thinking?: string; toolCalls?: ToolCall[] }>; deferSpawn?: boolean }): Promise<AgentTask> =>
    invoke('task_create', { params }),
  listTasks: (): Promise<AgentTask[]> =>
    tracedInvoke('task_list'),
  sendMessage: (taskId: string, message: string, attachments?: IpcAttachment[]): Promise<void> =>
    tracedInvoke('task_send_message', { taskId, message, attachments }),
  pauseTask: (taskId: string): Promise<void> =>
    tracedInvoke('task_pause', { taskId }),
  resumeTask: (taskId: string): Promise<void> =>
    tracedInvoke('task_resume', { taskId }),
  cancelTask: (taskId: string): Promise<void> =>
    tracedInvoke('task_cancel', { taskId }),
  deleteTask: (taskId: string): Promise<void> =>
    tracedInvoke('task_delete', { taskId }),
  forkTask: (taskId: string, workspace?: string, parentName?: string): Promise<AgentTask> =>
    tracedInvoke('task_fork', { params: { taskId, workspace, parentName } }),
  allowPermission: (taskId: string, requestId: string, optionId?: string): Promise<void> =>
    tracedInvoke('task_allow_permission', { taskId, requestId, optionId }),
  denyPermission: (taskId: string, requestId: string, optionId?: string): Promise<void> =>
    tracedInvoke('task_deny_permission', { taskId, requestId, optionId }),
  selectPermissionOption: (taskId: string, requestId: string, optionId: string): Promise<void> =>
    tracedInvoke('task_allow_permission', { taskId, requestId, optionId }),
  setAutoApprove: (taskId: string, autoApprove: boolean): Promise<void> =>
    tracedInvoke('task_set_auto_approve', { taskId, autoApprove }),
  pickFolder: (): Promise<string | null> =>
    tracedInvoke('pick_folder'),
  pickImage: (): Promise<string | null> =>
    invoke('pick_image'),
  detectClaudeCli: (): Promise<string | null> =>
    tracedInvoke('detect_claude_cli'),
  listModels: (claudeBin?: string): Promise<{ availableModels: Array<{ modelId: string; name: string; description?: string | null }>; currentModelId: string | null }> =>
    tracedInvoke('list_models', { claudeBin }),
  probeCapabilities: (): Promise<{ ok: boolean }> =>
    tracedInvoke('probe_capabilities'),
  getSettings: (): Promise<AppSettings> =>
    tracedInvoke('get_settings'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    tracedInvoke('save_settings', { settings }),
  setDockIcon: (iconBase64: string): Promise<void> =>
    invoke('set_dock_icon', { iconBase64 }),
  resetDockIcon: (): Promise<void> =>
    invoke('reset_dock_icon'),
  gitDetect: (path: string): Promise<boolean> =>
    invoke('git_detect', { path }),
  gitInit: (path: string): Promise<void> =>
    invoke('git_init', { path }),
  gitClone: (url: string, targetDir: string): Promise<string> =>
    invoke('git_clone', { url, targetDir }),
  gitListBranches: (cwd: string): Promise<{
    local: Array<{ name: string; current: boolean; worktreeLocked: boolean }>;
    remotes: Record<string, Array<{ name: string; fullRef: string }>>;
    currentBranch: string;
  }> =>
    tracedInvoke('git_list_branches', { cwd }),
  gitCheckout: (cwd: string, branch: string, force?: boolean): Promise<{ branch: string }> =>
    tracedInvoke('git_checkout', { cwd, branch, force }),
  gitCreateBranch: (cwd: string, branch: string): Promise<{ branch: string }> =>
    tracedInvoke('git_create_branch', { cwd, branch }),
  gitDeleteBranch: (cwd: string, branch: string): Promise<{ branch: string }> =>
    tracedInvoke('git_delete_branch', { cwd, branch }),
  getTaskDiff: (taskId: string): Promise<string> =>
    invoke('task_diff', { taskId }),
  getTaskDiffStats: (taskId: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    invoke('task_diff_stats', { taskId }),
  gitDiff: (cwd: string): Promise<string> =>
    tracedInvoke('git_diff', { cwd }),
  gitDiffFile: (taskId: string, filePath: string): Promise<string> =>
    tracedInvoke('git_diff_file', { taskId, filePath }),
  gitDiffStats: (cwd: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    tracedInvoke('git_diff_stats', { cwd }),
  gitStagedStats: (cwd: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    tracedInvoke('git_staged_stats', { cwd }),
  gitRemoteUrl: (cwd: string): Promise<string> =>
    tracedInvoke('git_remote_url', { cwd }),
  gitWorktreeCreate: (cwd: string, slug: string): Promise<{ worktreePath: string; branch: string }> =>
    tracedInvoke('git_worktree_create', { cwd, slug }),
  gitWorktreeRemove: (cwd: string, worktreePath: string): Promise<void> =>
    tracedInvoke('git_worktree_remove', { cwd, worktreePath }),
  gitWorktreeSetup: (cwd: string, worktreePath: string, symlinkDirs: string[]): Promise<{ symlinkCount: number; copiedFiles: string[] }> =>
    tracedInvoke('git_worktree_setup', { cwd, worktreePath, symlinkDirs }),
  gitWorktreeHasChanges: (worktreePath: string): Promise<boolean> =>
    tracedInvoke('git_worktree_has_changes', { worktreePath }),
  openInEditor: (path: string, editor: string): Promise<void> =>
    tracedInvoke('open_in_editor', { path, editor }),
  detectEditors: (): Promise<string[]> =>
    tracedInvoke('detect_editors'),
  detectEditorsBackground: (known: string[]): Promise<void> =>
    tracedInvoke('detect_editors_background', { known }),
  gitCommit: (cwd: string, message: string): Promise<void> =>
    tracedInvoke('git_commit', { cwd, message }),
  gitPush: (cwd: string): Promise<string> =>
    tracedInvoke('git_push', { cwd }),
  gitPull: (cwd: string): Promise<string> =>
    tracedInvoke('git_pull', { cwd }),
  gitFetch: (cwd: string): Promise<string> =>
    tracedInvoke('git_fetch', { cwd }),
  gitStage: (taskId: string, filePath: string): Promise<void> =>
    tracedInvoke('git_stage', { taskId, filePath }),
  gitRevert: (taskId: string, filePath: string): Promise<void> =>
    tracedInvoke('git_revert', { taskId, filePath }),
  setMode: (taskId: string, modeId: string): Promise<void> =>
    tracedInvoke('set_mode', { taskId, modeId }),
  setModel: (taskId: string, modelId: string): Promise<void> =>
    tracedInvoke('task_set_model', { taskId, modelId }),
  rollbackTask: (taskId: string, numTurns: number): Promise<void> =>
    tracedInvoke('task_rollback', { taskId, numTurns }),
  respondUserInput: (taskId: string, requestId: string, answers: Record<string, unknown>): Promise<void> =>
    tracedInvoke('task_respond_user_input', { taskId, requestId, answers }),
  ptyCreate: (id: string, cwd: string): Promise<void> =>
    tracedInvoke('pty_create', { id, cwd }),
  ptyWrite: (id: string, data: string): Promise<void> =>
    tracedInvoke('pty_write', { id, data }),
  ptyResize: (id: string, cols: number, rows: number): Promise<void> =>
    tracedInvoke('pty_resize', { id, cols, rows }),
  ptyKill: (id: string): Promise<void> =>
    invoke('pty_kill', { id }),
  ptyCount: (): Promise<number> =>
    invoke('pty_count'),
  getClaudeConfig: (projectPath?: string): Promise<ClaudeConfig> =>
    invoke('get_claude_config', { projectPath }),
  saveMcpServerConfig: (filePath: string, serverName: string, patch: { disabled?: boolean; disabledTools?: string[] }): Promise<void> =>
    invoke('save_mcp_server_config', { filePath, serverName, patch }),
  /**
   * Run `claude mcp add` as a subprocess.
   *
   * Prefer this over a raw mcp.json edit so the CLI's validation, registry-mode
   * enforcement, and any side effects (caching, telemetry) all run.
   *
   * @param request.scope `"global"`, `"workspace"`, or `"agent:<name>"`
   * @param request.command stdio binary (mutually exclusive with `url`)
   * @param request.url    remote MCP endpoint (mutually exclusive with `command`)
   * @param request.env    `KEY=VALUE` strings; the CLI expands `${VAR}` refs at server-launch time
   */
  mcpAddServer: (request: {
    name: string
    scope: string
    command?: string
    args: string[]
    url?: string
    env: string[]
    force: boolean
  }, workspace?: string, claudeBin?: string): Promise<string> =>
    invoke('mcp_add_server', { request, workspace, claudeBin }),
  /** Run `claude mcp remove` for the given scope. */
  mcpRemoveServer: (request: { name: string; scope: string }, workspace?: string, claudeBin?: string): Promise<string> =>
    invoke('mcp_remove_server', { request, workspace, claudeBin }),
  readFile: (filePath: string): Promise<string | null> =>
    tracedInvoke('read_text_file', { path: filePath }),
  /**
   * Read a UTF-8 text file from disk. Alias for `readFile` whose name mirrors
   * `writeTextFile` for symmetry at call sites. Forwards to the same
   * `read_text_file` Rust command in `commands/fs_ops.rs`.
   */
  readTextFile: (filePath: string): Promise<string | null> =>
    tracedInvoke('read_text_file', { path: filePath }),
  /**
   * Write a UTF-8 text file to disk.
   *
   * NOTE (TASK-112): This wrapper expects a `write_text_file(path, content)`
   * Tauri command in `src-tauri/src/commands/fs_ops.rs` and registered in
   * `lib.rs`'s `invoke_handler`. The plan preferred the `@tauri-apps/plugin-fs`
   * route, but neither the JS plugin (`@tauri-apps/plugin-fs`) nor the Rust
   * crate (`tauri-plugin-fs`) is installed in this repo, so the only viable
   * path is a small custom Rust command that mirrors the existing
   * `read_text_file`. Adding that command is intentionally out of scope of
   * the editor task itself; until it lands, callers will receive a
   * "command not found" error which the editor surfaces inline.
   */
  writeTextFile: (filePath: string, content: string): Promise<void> =>
    tracedInvoke('write_text_file', { path: filePath, content }),
  readFileBase64: (filePath: string): Promise<string | null> =>
    invoke('read_file_base64', { path: filePath }),
  isDirectory: (path: string): Promise<boolean> =>
    invoke('is_directory', { path }),
  listProjectFiles: (root: string, respectGitignore: boolean = true): Promise<ProjectFile[]> =>
    invoke('list_project_files', { root, respectGitignore }),
  // Project tree (new lazy-loading API)
  scanRoot: (workspace: string, respectGitignore: boolean = true): Promise<any[]> =>
    invoke('scan_root', { workspace, respectGitignore }),
  scanDirectory: (workspace: string, relPath: string, respectGitignore: boolean = true): Promise<any[]> =>
    invoke('scan_directory', { workspace, relPath, respectGitignore }),
  watchProjectTree: (workspace: string): Promise<void> =>
    invoke('watch_project_tree', { workspace }),
  unwatchProjectTree: (workspace: string): Promise<void> =>
    invoke('unwatch_project_tree', { workspace }),
  createFile: (workspace: string, relPath: string): Promise<any> =>
    invoke('create_file', { workspace, relPath }),
  createDirectory: (workspace: string, relPath: string): Promise<any> =>
    invoke('create_directory', { workspace, relPath }),
  deleteEntry: (workspace: string, relPath: string, permanent: boolean = false): Promise<void> =>
    invoke('delete_entry', { workspace, relPath, permanent }),
  renameEntry: (workspace: string, oldRelPath: string, newRelPath: string): Promise<any> =>
    invoke('rename_entry', { workspace, oldRelPath, newRelPath }),
  copyEntry: (workspace: string, srcRelPath: string, destRelPath: string): Promise<any> =>
    invoke('copy_entry', { workspace, srcRelPath, destRelPath }),
  duplicateEntry: (workspace: string, relPath: string): Promise<any> =>
    invoke('duplicate_entry', { workspace, relPath }),
  copyEntryPath: (workspace: string, relPath: string, relative: boolean): Promise<string> =>
    invoke('copy_entry_path', { workspace, relPath, relative }),
  revealInFinder: (workspace: string, relPath: string): Promise<void> =>
    invoke('reveal_in_finder', { workspace, relPath }),
  openInDefaultApp: (workspace: string, relPath: string): Promise<void> =>
    invoke('open_in_default_app', { workspace, relPath }),
  openTerminalAt: (workspace: string, relPath: string): Promise<void> =>
    invoke('open_terminal_at', { workspace, relPath }),
  addToGitignore: (workspace: string, relPath: string): Promise<void> =>
    invoke('add_to_gitignore', { workspace, relPath }),
  openUrl: (url: string): Promise<void> =>
    tracedInvoke('open_url', { url }),
  detectProjectIcon: (cwd: string): Promise<{ iconType: string; value: string } | null> =>
    tracedInvoke('detect_project_icon', { cwd }),
  listSmallImages: (cwd: string, maxSize: number): Promise<Array<{ path: string; width: number; height: number }>> =>
    tracedInvoke('list_small_images', { cwd, maxSize }),
  // Auth
  claudeWhoami: (claudeBin?: string): Promise<{ loggedIn?: boolean; authMethod?: string | null; apiProvider?: string | null; email?: string | null; orgName?: string | null; subscriptionType?: string | null }> =>
    tracedInvoke('claude_whoami', { claudeBin }),
  claudeLogout: (claudeBin?: string): Promise<void> =>
    tracedInvoke('claude_logout', { claudeBin }),
  claudeLogin: (claudeBin?: string): Promise<{ loggedIn?: boolean; authMethod?: string | null; email?: string | null; subscriptionType?: string | null }> =>
    tracedInvoke('claude_login', { claudeBin }),
  openTerminalWithCommand: (command: string): Promise<void> =>
    invoke('open_terminal_with_command', { command }),
  // Relaunch
  setRelaunchFlag: (): Promise<void> =>
    invoke('set_relaunch_flag'),
  // Event listeners
  onTaskUpdate: (cb: (task: AgentTask) => void): UnsubscribeFn =>
    tauriListen<AgentTask>('task_update', (task) => { logEvent('task_update', { taskId: task.id, status: task.status }, task.id); cb(task) }),
  onMessageChunk: (cb: (data: { taskId: string; chunk: string }) => void): UnsubscribeFn =>
    tauriListen('message_chunk', cb),
  onPtyData: (cb: (data: { id: string; data: string }) => void): UnsubscribeFn =>
    tauriListen('pty_data', cb),
  onPtyExit: (cb: (data: { id: string }) => void): UnsubscribeFn =>
    tauriListen<{ id: string }>('pty_exit', (data) => { logEvent('pty_exit', data); cb(data) }),
  onToolCall: (cb: (data: { taskId: string; toolCall: ToolCall }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; toolCall: ToolCall }>('tool_call', (data) => { logEvent('tool_call', { taskId: data.taskId, title: data.toolCall.title, kind: data.toolCall.kind }, data.taskId); cb(data) }),
  onToolCallUpdate: (cb: (data: { taskId: string; toolCall: ToolCall }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; toolCall: ToolCall }>('tool_call_update', (data) => { logEvent('tool_call_update', { taskId: data.taskId, title: data.toolCall.title, status: data.toolCall.status }, data.taskId); cb(data) }),
  onThinkingChunk: (cb: (data: { taskId: string; chunk: string }) => void): UnsubscribeFn =>
    tauriListen('thinking_chunk', cb),
  onPlanUpdate: (cb: (data: { taskId: string; plan: PlanStep[] }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; plan: PlanStep[] }>('plan_update', (data) => { logEvent('plan_update', { taskId: data.taskId, stepCount: data.plan.length }, data.taskId); cb(data) }),
  onUsageUpdate: (cb: (data: { taskId: string; used: number; size: number; cost?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; used: number; size: number; cost?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number }>('usage_update', (data) => { logEvent('usage_update', data, data.taskId); cb(data) }),
  onTurnEnd: (cb: (data: { taskId: string; stopReason?: string }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; stopReason?: string }>('turn_end', (data) => { logEvent('turn_end', data, data.taskId); cb(data) }),
  onDebugLog: (cb: (entry: DebugLogEntry) => void): UnsubscribeFn =>
    tauriListen('debug_log', cb),
  onSessionInit: (cb: (data: { taskId: string; sessionId?: string; models: unknown; modes: unknown; configOptions: unknown }) => void): UnsubscribeFn =>
    tauriListen('session_init', cb),
  onMcpUpdate: (cb: (data: { serverName: string; status: string; error?: string; oauthUrl?: string }) => void): UnsubscribeFn =>
    tauriListen<{ serverName: string; status: string; error?: string; oauthUrl?: string }>('mcp_update', (data) => { logEvent('mcp_update', data); cb(data) }),
  onMcpConnecting: (cb: () => void): UnsubscribeFn =>
    tauriListen('mcp_connecting', () => { logEvent('mcp_connecting', {}); cb() }),
  onCommandsUpdate: (cb: (data: { taskId: string; commands: Array<{ name: string; description?: string; inputType?: string }>; mcpServers?: Array<{ name: string; status: string; toolCount: number }> | Record<string, Array<{ name: string; status: string; toolCount: number }>> }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; commands: Array<{ name: string; description?: string; inputType?: string }>; mcpServers?: Array<{ name: string; status: string; toolCount: number }> | Record<string, Array<{ name: string; status: string; toolCount: number }>> }>('commands_update', (data) => { logEvent('commands_update', { taskId: data.taskId, commandCount: data.commands.length }, data.taskId); cb(data) }),
  onTaskError: (cb: (data: { taskId: string; message: string }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; message: string }>('task_error', (data) => { logEvent('task_error', data, data.taskId); cb(data) }),
  onSubagentUpdate: (cb: (data: { taskId: string; subagents: unknown[]; pendingStages: unknown[] }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; subagents: unknown[]; pendingStages: unknown[] }>('subagent_update', (data) => { logEvent('subagent_update', { taskId: data.taskId, count: data.subagents.length }, data.taskId); cb(data) }),
  onCompactionStatus: (cb: (data: { taskId: string; status: string; summary: unknown }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; status: string; summary: unknown }>('compaction_status', (data) => { logEvent('compaction_status', data, data.taskId); cb(data) }),
  onUserInputRequest: (cb: (data: { taskId: string; requestId: string; fields: Array<{ name: string; label: string; type: string; required?: boolean; options?: string[] }> }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; requestId: string; fields: Array<{ name: string; label: string; type: string; required?: boolean; options?: string[] }> }>('user_input_request', (data) => { logEvent('user_input_request', { taskId: data.taskId, requestId: data.requestId }, data.taskId); cb(data) }),
  onEditorsUpdated: (cb: (bins: string[]) => void): UnsubscribeFn =>
    tauriListen('editors-updated', cb),
  /**
   * Subscribe to `.claude/` config changes (agents, skills, steering, MCP).
   * Re-added for TASK-112 (CLAUDE.md memory file editor) so external edits
   * hot-reload the open editor body.
   */
  onClaudeConfigChanged: (cb: (payload: ClaudeConfigChangedPayload) => void): UnsubscribeFn =>
    tauriListen<ClaudeConfigChangedPayload>('claude-config-changed', (payload) => {
      logEvent('claude-config-changed', { scope: payload.scope })
      cb(payload)
    }),

  // ---------------------------------------------------------------------
  // Analytics (legacy CRUD — kept for backward compat)
  // ---------------------------------------------------------------------
  analyticsSave: (events: AnalyticsEvent[]): Promise<void> =>
    tracedInvoke('analytics_save', { events }),
  analyticsLoad: (since?: number): Promise<AnalyticsEvent[]> =>
    tracedInvoke('analytics_load', { since }),
  analyticsClear: (): Promise<void> =>
    tracedInvoke('analytics_clear'),
  analyticsDbSize: (): Promise<number> =>
    tracedInvoke('analytics_db_size'),

  // ---------------------------------------------------------------------
  // Recent projects + macOS chrome
  // ---------------------------------------------------------------------
  getRecentProjects: async (): Promise<RecentProject[]> => {
    try {
      return await tracedInvoke<RecentProject[]>('recent_projects_get')
    } catch {
      return []
    }
  },
  addRecentProject: (path: string, name?: string, _iconPath?: string): Promise<void> =>
    tracedInvoke('recent_projects_add', { path, name }),
  removeRecentProject: (path: string): Promise<void> =>
    tracedInvoke('recent_projects_remove', { path }),
  clearRecentProjects: (): Promise<void> =>
    tracedInvoke('recent_projects_clear'),
  rebuildRecentMenu: (): Promise<void> =>
    tracedInvoke('rebuild_menu'),
  setDockIconVisible: (visible: boolean): Promise<void> =>
    tracedInvoke('set_dock_icon_visible', { visible }),
  requestRelaunch: (): Promise<void> =>
    tracedInvoke('request_relaunch'),

  // ---------------------------------------------------------------------
  // Claude watcher
  // ---------------------------------------------------------------------
  watchClaudePath: (path: string): Promise<void> =>
    tracedInvoke('watch_claude_path', { path }),
  unwatchClaudePath: (path: string): Promise<void> =>
    tracedInvoke('unwatch_claude_path', { path }),

  // ---------------------------------------------------------------------
  // Listeners (additional)
  // ---------------------------------------------------------------------
  onGitCloneProgress: (cb: (payload: GitCloneProgress) => void): UnsubscribeFn => {
    const throttled = throttleRaf<GitCloneProgress>(cb)
    return tauriListen<GitCloneProgress>('git-clone-progress', throttled)
  },

  // --- Statusline shell exec ---
  runStatuslineCommand: (command: string, contextJson: string): Promise<string> =>
    tracedInvoke<string>('run_statusline_command', { command, contextJson }),

  // ── Streaming Diff (Rust-powered) ──────────────────────────────────────────
  computeDiff: (oldText: string, newText: string): Promise<Array<{ type: 'insert'; text: string } | { type: 'delete'; bytes: number } | { type: 'keep'; bytes: number }>> =>
    invoke('compute_diff', { oldText, newText }),
  computeLineDiff: (oldText: string, newText: string): Promise<Array<{ type: 'insert'; lines: number } | { type: 'delete'; lines: number } | { type: 'keep'; lines: number }>> =>
    invoke('compute_line_diff', { oldText, newText }),

  // ── Structured diff parsing (replaces @pierre/diffs parsePatchFiles) ────────
  taskDiffStructured: (taskId: string): Promise<import('@/types/diff').ParsedDiff> =>
    invoke('task_diff_structured', { taskId }),
  gitDiffStructured: (cwd: string): Promise<import('@/types/diff').ParsedDiff> =>
    invoke('git_diff_structured', { cwd }),

  // ── Markdown parsing (replaces react-markdown for assistant messages) ───────
  parseMarkdown: (text: string): Promise<import('@/types/markdown').ParsedMarkdown> =>
    invoke('parse_markdown', { text }),

  // ── Syntax highlighting (replaces Shiki WASM in renderer) ───────────────────
  highlightCode: (text: string, lang: string, theme?: string): Promise<import('@/types/highlight').HighlightResult> =>
    invoke('highlight_code', { text, lang, theme }),
  highlightSupportedLanguages: (): Promise<string[]> =>
    invoke('highlight_supported_languages'),

  // ── Fuzzy match (replaces fuzzy-search.ts) ──────────────────────────────────
  fuzzyMatch: (query: string, candidates: Array<{ id: string; text: string; secondary?: string }>, limit?: number): Promise<Array<{ id: string; score: number; indices: number[]; secondaryMatched: boolean }>> =>
    invoke('fuzzy_match', { query, candidates, limit }),

  // ── Analytics aggregations (server-side rollups) ────────────────────────────
  analyticsCodingHoursByDay: (since?: number): Promise<Array<{ day: string; value: number; value2?: number }>> =>
    invoke('analytics_coding_hours_by_day', { since: since ?? null }),
  analyticsMessagesByDay: (since?: number): Promise<Array<{ day: string; value: number; value2?: number }>> =>
    invoke('analytics_messages_by_day', { since: since ?? null }),
  analyticsTokensByDay: (since?: number): Promise<Array<{ day: string; value: number; value2?: number }>> =>
    invoke('analytics_tokens_by_day', { since: since ?? null }),
  analyticsDiffStatsByDay: (since?: number): Promise<Array<{ day: string; value: number; value2?: number }>> =>
    invoke('analytics_diff_stats_by_day', { since: since ?? null }),
  analyticsModelPopularity: (since?: number): Promise<Array<{ detail: string; count: number }>> =>
    invoke('analytics_model_popularity', { since: since ?? null }),
  analyticsToolCallBreakdown: (since?: number): Promise<Array<{ detail: string; count: number }>> =>
    invoke('analytics_tool_call_breakdown', { since: since ?? null }),
  analyticsModeUsage: (since?: number): Promise<Array<{ detail: string; count: number }>> =>
    invoke('analytics_mode_usage', { since: since ?? null }),
  analyticsProjectStats: (since?: number): Promise<Array<{ project: string; threads: number; messages: number }>> =>
    invoke('analytics_project_stats', { since: since ?? null }),
  analyticsTotals: (since?: number): Promise<{ codingHours: number; messagesSent: number; messagesReceived: number; tokens: number; diffAdditions: number; diffDeletions: number; filesEdited: number; toolCalls: number }> =>
    invoke('analytics_totals', { since: since ?? null }),

  // ── MCP Transport Test ──────────────────────────────────────────────────────
  mcpTransportTest: (config: { type: 'stdio'; command: string; args: string[]; env?: Record<string, string>; workingDirectory?: string } | { type: 'http'; url: string; token?: string; oauthUrl?: string; timeoutSecs?: number }): Promise<string> =>
    invoke('mcp_transport_test', { config }),

  // ── Thread title generation ──────────────────────────────────────────────────
  generateThreadTitle: (message: string, workspace: string): Promise<{ title: string }> =>
    invoke('generate_thread_title', { message, workspace }),
  generateBranchName: (message: string, workspace: string): Promise<{ branch: string }> =>
    invoke('generate_branch_name', { message, workspace }),
  renameWorktreeBranch: (cwd: string, oldBranch: string, newBranch: string): Promise<{ branch: string }> =>
    invoke('rename_worktree_branch', { cwd, oldBranch, newBranch }),
  generatePrContent: (cwd: string, baseBranch: string, workspace?: string): Promise<{ title: string; body: string }> =>
    invoke('generate_pr_content', { cwd, baseBranch, workspace }),

  // ── Thread Database (SQLite persistence) ────────────────────────────────────
  threadDbList: (): Promise<Array<{ id: string; name: string; workspace: string; status: string; createdAt: string; updatedAt: string; parentThreadId?: string; autoApprove: boolean; metadata?: unknown }>> =>
    invoke('thread_db_list'),
  threadDbLoad: (threadId: string): Promise<{ id: string; name: string; workspace: string; status: string; createdAt: string; updatedAt: string; parentThreadId?: string; autoApprove: boolean; metadata?: unknown } | null> =>
    invoke('thread_db_load', { threadId }),
  threadDbSave: (thread: { id: string; name: string; workspace: string; status: string; createdAt: string; updatedAt: string; parentThreadId?: string; autoApprove: boolean; metadata?: unknown }): Promise<void> =>
    invoke('thread_db_save', { thread }),
  threadDbDelete: (threadId: string): Promise<void> =>
    invoke('thread_db_delete', { threadId }),
  threadDbMessages: (threadId: string): Promise<Array<{ id: number; threadId: string; role: string; content: string; timestamp: string; thinking?: string; toolCalls?: unknown }>> =>
    invoke('thread_db_messages', { threadId }),
  threadDbSaveMessage: (message: { id: number; threadId: string; role: string; content: string; timestamp: string; thinking?: string; toolCalls?: unknown }): Promise<number> =>
    invoke('thread_db_save_message', { message }),
  threadDbSearch: (query: string, limit?: number): Promise<Array<{ threadId: string; threadName: string; messageContent: string; messageTimestamp: string; rank: number }>> =>
    invoke('thread_db_search', { query, limit }),
  threadDbStats: (): Promise<{ totalThreads: number; totalMessages: number; threadsByWorkspace: Array<[string, number]> }> =>
    invoke('thread_db_stats'),
  threadDbClearAll: (): Promise<void> =>
    invoke('thread_db_clear_all'),
  threadDbAutoArchive: (days: number): Promise<Array<{ id: string; name: string; workspace: string; createdAt: string; lastActivityAt: string; messageCount: number; parentTaskId?: string }>> =>
    invoke('thread_db_auto_archive', { days }),

  // ── Git: commit dialog & VCS status ────────────────────────────────────
  gitVcsStatus: (cwd: string): Promise<{ branch: string; aheadCount: number; behindCount: number; isDirty: boolean; changedFileCount: number; hasUpstream: boolean }> =>
    invoke('git_vcs_status', { cwd }),
  gitListStack: (cwd: string): Promise<{ baseBranch: string; entries: Array<{ branch: string; isCurrent: boolean; commitsAhead: number; hasRemote: boolean }> }> =>
    invoke('git_list_stack', { cwd }),
  gitStackedPush: (cwd: string): Promise<{ branch: string; remoteUrl: string; pushed: boolean }> =>
    invoke('git_stacked_push', { cwd }),
  listChildProcesses: (): Promise<{ processes: Array<{ pid: number; ppid: number; cpuPercent: number; rssMb: number; elapsed: string; command: string; status: string }>; totalRssMb: number; processCount: number }> =>
    invoke('list_child_processes'),
  signalProcess: (pid: number, signal: string): Promise<void> =>
    invoke('signal_process', { pid, signal }),
  gitChangedFiles: (cwd: string): Promise<Array<{ path: string; insertions: number; deletions: number; status: string }>> =>
    invoke('git_changed_files', { cwd }),
  gitStageFiles: (cwd: string, filePaths: string[]): Promise<void> =>
    invoke('git_stage_files', { cwd, filePaths }),
  gitCommitFiles: (cwd: string, message: string, filePaths: string[]): Promise<string> =>
    invoke('git_commit_files', { cwd, message, filePaths }),
  gitCreateAndCheckoutBranch: (cwd: string, branch: string): Promise<{ branch: string }> =>
    invoke('git_create_and_checkout_branch', { cwd, branch }),
  gitAddRemote: (cwd: string, name: string, url: string): Promise<void> =>
    invoke('git_add_remote', { cwd, name, url }),
  gitGenerateCommitMessage: (cwd: string): Promise<{ subject: string; body: string }> =>
    invoke('git_generate_commit_message', { cwd }),

  // ── PR / MR creation (GitHub + GitLab) ──────────────────────────────────
  gitDetectProvider: (cwd: string): Promise<{ provider: 'github' | 'gitlab' | null; cliAvailable: boolean; remoteUrl: string; authenticated: boolean }> =>
    invoke('git_detect_provider', { cwd }),
  gitCreatePr: (cwd: string, title: string, body: string, base: string, draft?: boolean): Promise<{ provider: string; url: string; number: number; title: string }> =>
    invoke('git_create_pr', { cwd, title, body, base, draft }),
  gitPrStatus: (cwd: string): Promise<{ hasOpenPr: boolean; prUrl?: string; prNumber?: number; prTitle?: string; prState?: string }> =>
    invoke('git_pr_status', { cwd }),
  gitPrOpenInBrowser: (cwd: string): Promise<void> =>
    invoke('git_pr_open_in_browser', { cwd }),

  // ── Pattern extraction (code signatures for agent context) ──────────────
  extractPatterns: (filePath: string): Promise<{ path: string; language: string; symbols: Array<{ name: string; kind: string; signature: string; line: number; isPublic: boolean }>; totalLines: number }> =>
    invoke('extract_patterns', { filePath }),
  extractPatternsBatch: (filePaths: string[]): Promise<Array<{ path: string; language: string; symbols: Array<{ name: string; kind: string; signature: string; line: number; isPublic: boolean }>; totalLines: number }>> =>
    invoke('extract_patterns_batch', { filePaths }),

  // ── Structured tracing (NDJSON debug traces) ────────────────────────────
  traceReadRecent: (limit?: number): Promise<Array<{ name: string; timestamp: string; durationMs: number; attributes: Record<string, unknown>; exit: string }>> =>
    invoke('trace_read_recent', { limit }),
  traceFileLocation: (): Promise<string> =>
    invoke('trace_file_location'),
  traceClear: (): Promise<void> =>
    invoke('trace_clear'),

  // ── Checkpoints (per-turn snapshots) ────────────────────────────────────
  checkpointCreate: (taskId: string, turn: number): Promise<{ turn: number; refName: string; oid: string; message: string; timestamp: number }> =>
    invoke('checkpoint_create', { taskId, turn }),
  checkpointList: (taskId: string): Promise<Array<{ turn: number; refName: string; oid: string; message: string; timestamp: number }>> =>
    invoke('checkpoint_list', { taskId }),
  checkpointDiff: (taskId: string, fromTurn: number, toTurn: number): Promise<{
    fromTurn: number; toTurn: number; additions: number; deletions: number;
    fileCount: number; patch: string;
    files: Array<{ path: string; additions: number; deletions: number; status: string }>;
  }> =>
    invoke('checkpoint_diff', { taskId, fromTurn, toTurn }),
  checkpointRevert: (taskId: string, turn: number): Promise<void> =>
    invoke('checkpoint_revert', { taskId, turn }),
  checkpointCleanup: (taskId: string): Promise<number> =>
    invoke('checkpoint_cleanup', { taskId }),

  // ── Git History (commit log, stash) ─────────────────────────────────────
  gitCommitHistory: (cwd: string, limit?: number, skip?: number, includeStats?: boolean): Promise<Array<{
    shortOid: string; oid: string; subject: string; body: string;
    authorName: string; authorEmail: string; timestamp: number;
    additions: number; deletions: number; fileCount: number;
    parents: string[]; isHead: boolean;
  }>> =>
    invoke('git_commit_history', { cwd, limit, skip, includeStats }),
  gitCommitDiff: (cwd: string, oid: string): Promise<string> =>
    invoke('git_commit_diff', { cwd, oid }),
  gitCommitStats: (cwd: string, oids: string[]): Promise<Array<{ oid: string; additions: number; deletions: number; fileCount: number }>> =>
    invoke('git_commit_stats', { cwd, oids }),
  gitStashList: (cwd: string): Promise<Array<{ index: number; message: string; oid: string; timestamp: number }>> =>
    invoke('git_stash_list', { cwd }),
  gitStashPop: (cwd: string, index?: number): Promise<void> =>
    invoke('git_stash_pop', { cwd, index }),
  gitStashDrop: (cwd: string, index?: number): Promise<void> =>
    invoke('git_stash_drop', { cwd, index }),
  gitStashSave: (cwd: string, message?: string): Promise<string> =>
    invoke('git_stash_save', { cwd, message }),
}
