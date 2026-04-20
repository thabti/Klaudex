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
  createTask: (params: { name: string; workspace: string; prompt: string; autoApprove?: boolean; modeId?: string; attachments?: IpcAttachment[] }): Promise<AgentTask> =>
    tracedInvoke('task_create', { params }),
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
  gitDetect: (path: string): Promise<boolean> =>
    tracedInvoke('git_detect', { path }),
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
    tracedInvoke('task_diff', { taskId }),
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
    tracedInvoke('pty_kill', { id }),
  getClaudeConfig: (projectPath?: string): Promise<ClaudeConfig> =>
    tracedInvoke('get_claude_config', { projectPath }),
  readFile: (filePath: string): Promise<string | null> =>
    tracedInvoke('read_text_file', { path: filePath }),
  readFileBase64: (filePath: string): Promise<string | null> =>
    tracedInvoke('read_file_base64', { path: filePath }),
  listProjectFiles: (root: string, respectGitignore: boolean = true): Promise<ProjectFile[]> =>
    tracedInvoke('list_project_files', { root, respectGitignore }),
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
    tracedInvoke('open_terminal_with_command', { command }),
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
  onSessionInit: (cb: (data: { taskId: string; models: unknown; modes: unknown; configOptions: unknown }) => void): UnsubscribeFn =>
    tauriListen<{ taskId: string; models: unknown; modes: unknown; configOptions: unknown }>('session_init', (data) => { logEvent('session_init', { taskId: data.taskId }, data.taskId); cb(data) }),
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
    tauriListen<string[]>('editors-updated', (bins) => { logEvent('editors-updated', { count: bins.length }); cb(bins) }),
}
