import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentTask, AppSettings, KiroConfig, ToolCall, PlanStep, DebugLogEntry, ProjectFile, IpcAttachment } from '@/types'

type UnsubscribeFn = () => void

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
  createTask: (params: { name: string; workspace: string; prompt: string; autoApprove?: boolean; modeId?: string; attachments?: IpcAttachment[]; existingId?: string; existingMessages?: Array<{ role: string; content: string; timestamp: string; thinking?: string; toolCalls?: ToolCall[] }> }): Promise<AgentTask> =>
    invoke('task_create', { params }),
  listTasks: (): Promise<AgentTask[]> =>
    invoke('task_list'),
  sendMessage: (taskId: string, message: string, attachments?: IpcAttachment[]): Promise<void> =>
    invoke('task_send_message', { taskId, message, attachments }),
  pauseTask: (taskId: string): Promise<void> =>
    invoke('task_pause', { taskId }),
  resumeTask: (taskId: string): Promise<void> =>
    invoke('task_resume', { taskId }),
  cancelTask: (taskId: string): Promise<void> =>
    invoke('task_cancel', { taskId }),
  deleteTask: (taskId: string): Promise<void> =>
    invoke('task_delete', { taskId }),
  forkTask: (taskId: string, workspace?: string, parentName?: string): Promise<AgentTask> =>
    invoke('task_fork', { params: { taskId, workspace, parentName } }),
  allowPermission: (taskId: string, requestId: string, optionId?: string): Promise<void> =>
    invoke('task_allow_permission', { taskId, requestId, optionId }),
  denyPermission: (taskId: string, requestId: string, optionId?: string): Promise<void> =>
    invoke('task_deny_permission', { taskId, requestId, optionId }),
  selectPermissionOption: (taskId: string, requestId: string, optionId: string): Promise<void> =>
    invoke('task_allow_permission', { taskId, requestId, optionId }),
  setAutoApprove: (taskId: string, autoApprove: boolean): Promise<void> =>
    invoke('task_set_auto_approve', { taskId, autoApprove }),
  pickFolder: (): Promise<string | null> =>
    invoke('pick_folder'),
  pickImage: (): Promise<string | null> =>
    invoke('pick_image'),
  detectKiroCli: (): Promise<string | null> =>
    invoke('detect_kiro_cli'),
  listModels: (kiroBin?: string): Promise<{ availableModels: Array<{ modelId: string; name: string; description?: string | null }>; currentModelId: string | null }> =>
    invoke('list_models', { kiroBin }),
  probeCapabilities: (): Promise<{ ok: boolean }> =>
    invoke('probe_capabilities'),
  getSettings: (): Promise<AppSettings> =>
    invoke('get_settings'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    invoke('save_settings', { settings }),
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
    invoke('git_list_branches', { cwd }),
  gitCheckout: (cwd: string, branch: string, force?: boolean): Promise<{ branch: string }> =>
    invoke('git_checkout', { cwd, branch, force }),
  gitCreateBranch: (cwd: string, branch: string): Promise<{ branch: string }> =>
    invoke('git_create_branch', { cwd, branch }),
  gitDeleteBranch: (cwd: string, branch: string): Promise<{ branch: string }> =>
    invoke('git_delete_branch', { cwd, branch }),
  getTaskDiff: (taskId: string): Promise<string> =>
    invoke('task_diff', { taskId }),
  getTaskDiffStats: (taskId: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    invoke('task_diff_stats', { taskId }),
  gitDiff: (cwd: string): Promise<string> =>
    invoke('git_diff', { cwd }),
  gitDiffFile: (taskId: string, filePath: string): Promise<string> =>
    invoke('git_diff_file', { taskId, filePath }),
  gitDiffStats: (cwd: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    invoke('git_diff_stats', { cwd }),
  gitStagedStats: (cwd: string): Promise<{ additions: number; deletions: number; fileCount: number }> =>
    invoke('git_staged_stats', { cwd }),
  gitRemoteUrl: (cwd: string): Promise<string> =>
    invoke('git_remote_url', { cwd }),
  gitWorktreeCreate: (cwd: string, slug: string): Promise<{ worktreePath: string; branch: string }> =>
    invoke('git_worktree_create', { cwd, slug }),
  gitWorktreeRemove: (cwd: string, worktreePath: string): Promise<void> =>
    invoke('git_worktree_remove', { cwd, worktreePath }),
  gitWorktreeSetup: (cwd: string, worktreePath: string, symlinkDirs: string[]): Promise<{ symlinkCount: number; copiedFiles: string[] }> =>
    invoke('git_worktree_setup', { cwd, worktreePath, symlinkDirs }),
  gitWorktreeHasChanges: (worktreePath: string): Promise<boolean> =>
    invoke('git_worktree_has_changes', { worktreePath }),
  openInEditor: (path: string, editor: string): Promise<void> =>
    invoke('open_in_editor', { path, editor }),
  detectEditors: (): Promise<string[]> =>
    invoke('detect_editors'),
  detectEditorsBackground: (known: string[]): Promise<void> =>
    invoke('detect_editors_background', { known }),
  gitCommit: (cwd: string, message: string): Promise<void> =>
    invoke('git_commit', { cwd, message }),
  gitPush: (cwd: string): Promise<string> =>
    invoke('git_push', { cwd }),
  gitPull: (cwd: string): Promise<string> =>
    invoke('git_pull', { cwd }),
  gitFetch: (cwd: string): Promise<string> =>
    invoke('git_fetch', { cwd }),
  gitStage: (taskId: string, filePath: string): Promise<void> =>
    invoke('git_stage', { taskId, filePath }),
  gitRevert: (taskId: string, filePath: string): Promise<void> =>
    invoke('git_revert', { taskId, filePath }),
  setMode: (taskId: string, modeId: string): Promise<void> =>
    invoke('set_mode', { taskId, modeId }),
  ptyCreate: (id: string, cwd: string): Promise<void> =>
    invoke('pty_create', { id, cwd }),
  ptyWrite: (id: string, data: string): Promise<void> =>
    invoke('pty_write', { id, data }),
  ptyResize: (id: string, cols: number, rows: number): Promise<void> =>
    invoke('pty_resize', { id, cols, rows }),
  ptyKill: (id: string): Promise<void> =>
    invoke('pty_kill', { id }),
  ptyCount: (): Promise<number> =>
    invoke('pty_count'),
  getKiroConfig: (projectPath?: string): Promise<KiroConfig> =>
    invoke('get_kiro_config', { projectPath }),
  saveMcpServerConfig: (filePath: string, serverName: string, patch: { disabled?: boolean; disabledTools?: string[] }): Promise<void> =>
    invoke('save_mcp_server_config', { filePath, serverName, patch }),
  watchKiroPath: (path: string): Promise<void> =>
    invoke('watch_kiro_path', { path }),
  unwatchKiroPath: (path: string): Promise<void> =>
    invoke('unwatch_kiro_path', { path }),
  readFile: (filePath: string): Promise<string | null> =>
    invoke('read_text_file', { path: filePath }),
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
    invoke('open_url', { url }),
  detectProjectIcon: (cwd: string): Promise<{ iconType: string; value: string } | null> =>
    invoke('detect_project_icon', { cwd }),
  listSmallImages: (cwd: string, maxSize: number): Promise<Array<{ path: string; width: number; height: number }>> =>
    invoke('list_small_images', { cwd, maxSize }),
  // Auth
  kiroWhoami: (kiroBin?: string): Promise<{ email?: string | null; accountType?: string; region?: string; startUrl?: string }> =>
    invoke('kiro_whoami', { kiroBin }),
  kiroLogout: (kiroBin?: string): Promise<void> =>
    invoke('kiro_logout', { kiroBin }),
  openTerminalWithCommand: (command: string): Promise<void> =>
    invoke('open_terminal_with_command', { command }),
  // Relaunch
  setRelaunchFlag: (): Promise<void> =>
    invoke('set_relaunch_flag'),
  // Recent projects
  getRecentProjects: (): Promise<string[]> =>
    invoke('get_recent_projects'),
  addRecentProject: (path: string): Promise<void> =>
    invoke('add_recent_project', { path }),
  clearRecentProjects: (): Promise<void> =>
    invoke('clear_recent_projects'),
  rebuildRecentMenu: (): Promise<void> =>
    invoke('rebuild_recent_menu'),
  // Analytics
  analyticsSave: (events: import('@/types/analytics').AnalyticsEvent[]): Promise<void> =>
    invoke('analytics_save', { events }),
  analyticsLoad: (since?: number): Promise<import('@/types/analytics').AnalyticsEvent[]> =>
    invoke('analytics_load', { since: since ?? null }),
  analyticsClear: (): Promise<void> =>
    invoke('analytics_clear'),
  analyticsDbSize: (): Promise<number> =>
    invoke('analytics_db_size'),
  // Event listeners
  onTaskUpdate: (cb: (task: AgentTask) => void): UnsubscribeFn =>
    tauriListen('task_update', cb),
  onMessageChunk: (cb: (data: { taskId: string; chunk: string }) => void): UnsubscribeFn =>
    tauriListen('message_chunk', cb),
  onPtyData: (cb: (data: { id: string; data: string }) => void): UnsubscribeFn =>
    tauriListen('pty_data', cb),
  onPtyExit: (cb: (data: { id: string }) => void): UnsubscribeFn =>
    tauriListen('pty_exit', cb),
  onToolCall: (cb: (data: { taskId: string; toolCall: ToolCall }) => void): UnsubscribeFn =>
    tauriListen('tool_call', cb),
  onToolCallUpdate: (cb: (data: { taskId: string; toolCall: ToolCall }) => void): UnsubscribeFn =>
    tauriListen('tool_call_update', cb),
  onThinkingChunk: (cb: (data: { taskId: string; chunk: string }) => void): UnsubscribeFn =>
    tauriListen('thinking_chunk', cb),
  onPlanUpdate: (cb: (data: { taskId: string; plan: PlanStep[] }) => void): UnsubscribeFn =>
    tauriListen('plan_update', cb),
  onUsageUpdate: (cb: (data: { taskId: string; used: number; size: number }) => void): UnsubscribeFn =>
    tauriListen('usage_update', cb),
  onTurnEnd: (cb: (data: { taskId: string; stopReason?: string }) => void): UnsubscribeFn =>
    tauriListen('turn_end', cb),
  onDebugLog: (cb: (entry: DebugLogEntry) => void): UnsubscribeFn =>
    tauriListen('debug_log', cb),
  onSessionInit: (cb: (data: { taskId: string; models: unknown; modes: unknown; configOptions: unknown }) => void): UnsubscribeFn =>
    tauriListen('session_init', cb),
  onMcpUpdate: (cb: (data: { serverName: string; status: string; error?: string; oauthUrl?: string }) => void): UnsubscribeFn =>
    tauriListen('mcp_update', cb),
  onMcpConnecting: (cb: () => void): UnsubscribeFn =>
    tauriListen('mcp_connecting', cb),
  onCommandsUpdate: (cb: (data: { taskId: string; commands: Array<{ name: string; description?: string; inputType?: string }>; mcpServers?: Array<{ name: string; status: string; toolCount: number }> | Record<string, Array<{ name: string; status: string; toolCount: number }>> }) => void): UnsubscribeFn =>
    tauriListen('commands_update', cb),
  onTaskError: (cb: (data: { taskId: string; message: string }) => void): UnsubscribeFn =>
    tauriListen('task_error', cb),
  onSubagentUpdate: (cb: (data: { taskId: string; subagents: unknown[]; pendingStages: unknown[] }) => void): UnsubscribeFn =>
    tauriListen('subagent_update', cb),
  onCompactionStatus: (cb: (data: { taskId: string; status: string; summary: unknown }) => void): UnsubscribeFn =>
    tauriListen('compaction_status', cb),
  onEditorsUpdated: (cb: (bins: string[]) => void): UnsubscribeFn =>
    tauriListen('editors-updated', cb),
  onKiroConfigChanged: (cb: (data: { projectPath: string | null }) => void): UnsubscribeFn =>
    tauriListen('kiro-config-changed', cb),

  // ── Streaming Diff (Rust-powered, inspired by Zed) ──────────────────────────
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
}
