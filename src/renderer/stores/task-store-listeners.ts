import type { AgentTask, SubagentInfo, SubagentStatus } from '@/types'
import { ipc } from '@/lib/ipc'
import { joinChunk } from '@/lib/utils'
import { sendTaskNotification } from '@/lib/notifications'
import { useDebugStore } from '@/stores/debugStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import { useDiffStore } from '@/stores/diffStore'
import { useTaskStore } from './taskStore'
import type { TaskStore } from './task-store-types'
import { record } from '@/lib/analytics-collector'
import { getReceiptBus, createTurnQuiescedReceipt, createDiffReadyReceipt } from '@/lib/typed-receipts'
import * as threadDb from '@/lib/thread-db'

/** Get the project basename from a workspace path (privacy: no full paths). */
const projectName = (workspace: string): string => {
  const parts = workspace.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || workspace
}

// ── Throttled mid-turn persist ───────────────────────────────────
// Persist history periodically while a turn is in progress so that
// a dev hot-reload or crash doesn't lose all streamed content.
// Throttled to once per 10 s to avoid hammering the disk on every chunk.

const MID_TURN_PERSIST_MS = 10_000
let lastMidTurnPersistMs = 0

const throttledMidTurnPersist = (): void => {
  const now = Date.now()
  if (now - lastMidTurnPersistMs < MID_TURN_PERSIST_MS) return
  lastMidTurnPersistMs = now
  useTaskStore.getState().persistHistory()
}

/**
 * Pure state reducer for turn_end — exported for testing.
 */
export const applyTurnEnd = (
  s: Pick<TaskStore, 'tasks' | 'streamingChunks' | 'thinkingChunks' | 'liveToolCalls' | 'liveToolSplits'>,
  taskId: string,
  stopReason?: string,
  refusalRetry?: boolean,
  turnDurationMs?: number,
): Partial<TaskStore> => {
  const chunk = s.streamingChunks[taskId] ?? ''
  const thinking = s.thinkingChunks[taskId] ?? ''
  const liveTools = s.liveToolCalls[taskId] ?? []
  const liveSplits = s.liveToolSplits[taskId] ?? []
  const task = s.tasks[taskId]
  if (!task) return {}
  // When the user explicitly paused via Escape/steering, needsNewConnection is
  // set synchronously before turn_end arrives. Don't clobber that with 'cancelled'.
  const userPaused = stopReason === 'cancelled' && !!task.needsNewConnection
  const fallbackStatus = stopReason === 'refusal' ? 'error' as const
    : userPaused ? 'paused' as const
    : stopReason === 'cancelled' ? 'cancelled' as const
    : 'completed' as const
  const toolFallbackStatus = stopReason === 'refusal' ? 'failed' as const
    : stopReason === 'cancelled' ? 'cancelled' as const
    : 'completed' as const
  const finalizedTools = liveTools.map((tc) =>
    tc.status === 'completed' || tc.status === 'failed' || tc.status === 'cancelled' ? tc : { ...tc, status: toolFallbackStatus },
  )
  // Filter splits to those that reference one of the finalized tool calls
  // and sort by offset, breaking ties by the tool call's `createdAt` so the
  // persisted order matches the order the agent emitted batched tools in.
  // `.filter` returns a fresh array, so we can sort in place.
  const toolIds = new Set(finalizedTools.map((tc) => tc.toolCallId))
  const toolCreatedAt = new Map(finalizedTools.map((tc) => [tc.toolCallId, tc.createdAt ?? '']))
  const finalizedSplits = liveSplits
    .filter((split) => toolIds.has(split.toolCallId))
    .sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at
      const aAt = toolCreatedAt.get(a.toolCallId) ?? ''
      const bAt = toolCreatedAt.get(b.toolCallId) ?? ''
      return aAt.localeCompare(bAt)
    })
  const newMessages = [...task.messages]
  if (chunk || finalizedTools.length > 0) {
    newMessages.push({
      role: 'assistant' as const,
      content: chunk,
      timestamp: new Date().toISOString(),
      ...(thinking ? { thinking } : {}),
      ...(finalizedTools.length > 0 ? { toolCalls: finalizedTools } : {}),
      ...(finalizedSplits.length > 0 ? { toolCallSplits: finalizedSplits } : {}),
    })
  }
  if (stopReason === 'refusal') {
    const msg = refusalRetry
      ? '\u26a0\ufe0f The agent refused to continue. Retrying automatically\u2026'
      : '\u26a0\ufe0f The agent refused to continue. You can try rephrasing your request or sending a new message.'
    newMessages.push({
      role: 'system' as const,
      content: msg,
      timestamp: new Date().toISOString(),
    })
  }
  if (stopReason === 'connection_lost') {
    newMessages.push({
      role: 'system' as const,
      content: '\u26a0\ufe0f Connection to the agent was lost. You can send a new message to continue.',
      timestamp: new Date().toISOString(),
    })
  }
  const updatedTask: AgentTask = {
    ...task,
    status: fallbackStatus,
    messages: newMessages,
    pendingPermission: undefined,
    ...(turnDurationMs !== undefined ? { lastTurnDurationMs: turnDurationMs } : {}),
  }
  return {
    tasks: { ...s.tasks, [taskId]: updatedTask },
    streamingChunks: { ...s.streamingChunks, [taskId]: '' },
    thinkingChunks: { ...s.thinkingChunks, [taskId]: '' },
    liveToolCalls: { ...s.liveToolCalls, [taskId]: [] },
    liveToolSplits: { ...s.liveToolSplits, [taskId]: [] },
  }
}

const VALID_STATUSES = new Set<SubagentStatus>(['pending', 'running', 'completed', 'failed'])

/** Parse raw ACP subagent payload into typed SubagentInfo[]. Exported for testing. */
export const parseSubagents = (raw: unknown[]): SubagentInfo[] =>
  raw.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').map((item) => {
    const status = typeof item.status === 'string' && VALID_STATUSES.has(item.status as SubagentStatus)
      ? item.status as SubagentStatus : 'pending'
    const subName = typeof item.subName === 'string' ? item.subName
      : typeof item.sub_name === 'string' ? item.sub_name : undefined
    return {
      name: typeof item.name === 'string' ? item.name : '',
      subName,
      status,
      role: typeof item.role === 'string' ? item.role : undefined,
      description: typeof item.prompt_template === 'string' ? item.prompt_template
        : typeof item.description === 'string' ? item.description : undefined,
      dependsOn: Array.isArray(item.depends_on) ? item.depends_on.filter((d): d is string => typeof d === 'string') : undefined,
      currentToolCall: typeof item.currentToolCall === 'string' ? item.currentToolCall : undefined,
      isThinking: typeof item.isThinking === 'boolean' ? item.isThinking : undefined,
      parent: typeof item.parent === 'string' ? item.parent : undefined,
      raw: item,
    }
  })

export function initTaskListeners(): () => void {
  useTaskStore.getState().setConnected(true)

  // ── Activity watchdog ────────────────────────────────────────────────────────
  // If a task stays in `running` with no streaming chunk, tool-call update, or
  // plan update for WATCHDOG_WARN_MS, we surface a warning in the debug panel.
  // After WATCHDOG_KILL_MS we auto-clear the spinner via a synthetic turn_end.
  // This catches the common dev-reload case where the Tauri webview restarts
  // mid-turn and the backend never fires `turn_end`.
  const WATCHDOG_WARN_MS = 60_000   // 60 s — surface warning
  const WATCHDOG_KILL_MS = 300_000  // 5 min — auto-clear spinner

  // Per-task timestamp of the last observed activity (chunk / tool / plan)
  const lastActivityMs: Record<string, number> = {}

  const touchActivity = (taskId: string) => {
    lastActivityMs[taskId] = Date.now()
  }

  const watchdogInterval = setInterval(() => {
    const now = Date.now()
    const state = useTaskStore.getState()
    for (const [taskId, task] of Object.entries(state.tasks)) {
      if (task.status !== 'running') {
        delete lastActivityMs[taskId]
        continue
      }
      const last = lastActivityMs[taskId] ?? now
      const idle = now - last
      if (idle >= WATCHDOG_KILL_MS) {
        // Auto-clear: treat as a lost connection so the spinner disappears
        // and the user can send a new message.
        useTaskStore.setState((s) => applyTurnEnd(s, taskId, 'connection_lost'))
        useTaskStore.getState().persistHistory()
        delete lastActivityMs[taskId]
        useDebugStore.getState().addEntry({
          id: 0,
          direction: 'in',
          category: 'error',
          type: 'watchdog',
          taskId,
          summary: `Task stuck for ${Math.round(idle / 1000)}s with no activity — auto-cleared spinner`,
          payload: { idleMs: idle },
          isError: true,
          timestamp: new Date().toISOString(),
        })
      } else if (idle >= WATCHDOG_WARN_MS) {
        useDebugStore.getState().addEntry({
          id: 0,
          direction: 'in',
          category: 'error',
          type: 'watchdog',
          taskId,
          summary: `Task has been running with no activity for ${Math.round(idle / 1000)}s — may be stuck`,
          payload: { idleMs: idle },
          isError: false,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }, 10_000) // check every 10 s

  // Batch task_update events with rAF — multiple threads can fire status changes rapidly
  let taskUpdateBuf: Record<string, AgentTask> = {}
  let taskUpdateRaf: number | null = null
  const flushTaskUpdates = () => {
    const buf = taskUpdateBuf; taskUpdateBuf = {}; taskUpdateRaf = null
    const store = useTaskStore.getState()
    for (const task of Object.values(buf)) {
      store.upsertTask({ ...task, messages: [] })
    }
  }
  const unsub1 = ipc.onTaskUpdate((task) => {
    // Keep only the latest update per task, strip messages
    taskUpdateBuf[task.id] = task
    if (!taskUpdateRaf) taskUpdateRaf = requestAnimationFrame(flushTaskUpdates)
  })

  // Batch streaming chunks with rAF to reduce state updates
  let chunkBuf: Record<string, string> = {}
  let chunkRaf: number | null = null
  const flushChunks = () => {
    const buf = chunkBuf; chunkBuf = {}; chunkRaf = null
    useTaskStore.setState((s) => {
      const next = { ...s.streamingChunks }
      for (const [id, text] of Object.entries(buf)) {
        next[id] = joinChunk(next[id] ?? '', text)
      }
      return { streamingChunks: next }
    })
  }
  const unsub2 = ipc.onMessageChunk(({ taskId, chunk }) => {
    if (useTaskStore.getState().tasks[taskId]?.status !== 'running') return
    touchActivity(taskId)
    chunkBuf[taskId] = (chunkBuf[taskId] ?? '') + chunk
    if (!chunkRaf) chunkRaf = requestAnimationFrame(flushChunks)
    throttledMidTurnPersist()
  })

  let thinkBuf: Record<string, string> = {}
  let thinkRaf: number | null = null
  const flushThinking = () => {
    const buf = thinkBuf; thinkBuf = {}; thinkRaf = null
    useTaskStore.setState((s) => {
      const next = { ...s.thinkingChunks }
      for (const [id, text] of Object.entries(buf)) {
        next[id] = joinChunk(next[id] ?? '', text)
      }
      return { thinkingChunks: next }
    })
  }
  const unsub3 = ipc.onThinkingChunk(({ taskId, chunk }) => {
    if (useTaskStore.getState().tasks[taskId]?.status !== 'running') return
    touchActivity(taskId)
    thinkBuf[taskId] = (thinkBuf[taskId] ?? '') + chunk
    if (!thinkRaf) thinkRaf = requestAnimationFrame(flushThinking)
  })

  /**
   * Synchronously commit any pending streaming text so callers that read
   * `streamingChunks[taskId].length` immediately afterwards see the
   * up-to-date value. Used by `onToolCall` so the offset recorded for
   * inline tool-call rendering matches the text the agent had already
   * emitted at that point.
   *
   * The flush is global (commits every buffered task) because the
   * underlying `flushChunks` is — committing extra clean text is harmless
   * and avoids keeping two near-identical flush paths in sync. We do *not*
   * early-return when `chunkBuf[taskId]` is empty: if another task has
   * pending chunks, skipping the flush would leave stale data in the
   * buffer until the next rAF tick.
   */
  const flushPendingChunks = (): void => {
    if (chunkRaf === null) return
    cancelAnimationFrame(chunkRaf)
    chunkRaf = null
    flushChunks()
  }

  const unsub4 = ipc.onToolCall(({ taskId, toolCall }) => {
    flushPendingChunks()
    touchActivity(taskId)
    useTaskStore.getState().upsertToolCall(taskId, toolCall)
  })

  const unsub5 = ipc.onToolCallUpdate(({ taskId, toolCall }) => {
    // Only the first sighting of a tool call records a split offset. For
    // updates to a known tool, the existing split is preserved verbatim
    // and skipping the synchronous flush avoids a setState per token-tick.
    const liveTools = useTaskStore.getState().liveToolCalls[taskId]
    const isKnown = liveTools?.some((tc) => tc.toolCallId === toolCall.toolCallId) === true
    if (!isKnown) flushPendingChunks()
    touchActivity(taskId)
    useTaskStore.getState().upsertToolCall(taskId, toolCall)
    if (
      toolCall.status === 'completed' &&
      (toolCall.kind === 'edit' || toolCall.kind === 'delete' || toolCall.kind === 'move')
    ) {
      useDiffStore.getState().fetchDiff(taskId)
    }
    // Analytics: record completed tool calls
    if (toolCall.status === 'completed') {
      const task = useTaskStore.getState().tasks[taskId]
      const proj = task ? projectName(task.originalWorkspace ?? task.workspace) : undefined
      record('tool_call', { project: proj, thread: taskId, detail: toolCall.kind ?? 'other' })
      if (toolCall.kind === 'edit' || toolCall.kind === 'delete' || toolCall.kind === 'move') {
        const filePath = toolCall.locations?.[0]?.path
        const fileName = filePath ? filePath.split('/').pop() ?? filePath : undefined
        record('file_edited', { project: proj, thread: taskId, detail: fileName })
      }
    }
  })

  const unsub6 = ipc.onPlanUpdate(({ taskId, plan }) => {
    touchActivity(taskId)
    useTaskStore.getState().updatePlan(taskId, plan)
  })

  const unsub7 = ipc.onUsageUpdate(({ taskId, used, size }) => {
    useTaskStore.getState().updateUsage(taskId, used, size)
    const task = useTaskStore.getState().tasks[taskId]
    record('token_usage', {
      project: task ? projectName(task.originalWorkspace ?? task.workspace) : undefined,
      thread: taskId,
      value: used,
      value2: size,
    })
  })

  // Track refusal retries per task — allows one automatic retry before giving up
  const refusalRetried: Record<string, boolean> = {}

  // Guard against duplicate title generation requests for the same task
  const titleGenerationInFlight = new Set<string>()

  const unsub8 = ipc.onTurnEnd(({ taskId, stopReason, turnDurationMs }) => {
    // Flush any pending rAF-buffered task updates so the task exists in the store
    if (taskUpdateBuf[taskId] || Object.keys(taskUpdateBuf).length > 0) {
      if (taskUpdateRaf) { cancelAnimationFrame(taskUpdateRaf); taskUpdateRaf = null }
      flushTaskUpdates()
    }
    // Flush any pending rAF-buffered chunks synchronously so turn_end sees them
    if (chunkBuf[taskId] || Object.keys(chunkBuf).length > 0) {
      if (chunkRaf) { cancelAnimationFrame(chunkRaf); chunkRaf = null }
      flushChunks()
    }
    if (thinkBuf[taskId] || Object.keys(thinkBuf).length > 0) {
      if (thinkRaf) { cancelAnimationFrame(thinkRaf); thinkRaf = null }
      flushThinking()
    }

    // On refusal: auto-retry once, then give up and let the user send a new message
    if (stopReason === 'refusal') {
      const alreadyRetried = !!refusalRetried[taskId]

      // Apply turn end with retry flag so the system message is appropriate
      useTaskStore.setState((s) => applyTurnEnd(s, taskId, stopReason, !alreadyRetried, turnDurationMs))
      useTaskStore.getState().persistHistory()

      if (!alreadyRetried) {
        // First refusal: mark as retried and auto-retry the last user message
        refusalRetried[taskId] = true
        const task = useTaskStore.getState().tasks[taskId]
        if (task) {
          // Find the last user message to retry
          const lastUserMsg = [...task.messages].reverse().find((m) => m.role === 'user')
          if (lastUserMsg) {
            useTaskStore.getState().upsertTask({ ...task, status: 'running' })
            useTaskStore.getState().clearTurn(taskId)
            ipc.sendMessage(taskId, lastUserMsg.content)
            return // skip notification and queue processing — we're retrying
          }
        }
      } else {
        // Second refusal: reset the retry tracker and let the user recover
        delete refusalRetried[taskId]
      }

      // Notify on refusal (only if we didn't auto-retry)
      const settings = useSettingsStore.getState().settings
      const task = useTaskStore.getState().tasks[taskId]
      if (task) {
        sendTaskNotification({
          task,
          status: 'error',
          isNotificationsEnabled: settings.notifications ?? true,
          isSoundEnabled: settings.soundNotifications ?? true,
          onNotified: (tid) => {
            useTaskStore.setState((s) => ({
              notifiedTaskIds: s.notifiedTaskIds.includes(tid) ? s.notifiedTaskIds : [...s.notifiedTaskIds, tid],
            }))
          },
        })
      }
      return // don't process queue on refusal
    }

    // Non-refusal turn end: clear any refusal tracker for this task
    delete refusalRetried[taskId]

    // Use a single setState to avoid stale reads between getState() calls
    useTaskStore.setState((s) => applyTurnEnd(s, taskId, stopReason, undefined, turnDurationMs))

    // Clear dispatch snapshot — turn is complete
    useTaskStore.getState().setDispatchSnapshot(taskId, null)

    // Generate an AI title after the first turn if the thread still has the
    // default "Thread HH:MM" name. Fire-and-forget — a failure just keeps
    // the default name. Guard: skip if a title generation is already in-flight.
    {
      const t = useTaskStore.getState().tasks[taskId]
      if (t && !titleGenerationInFlight.has(taskId)) {
        const isDefaultName = /^Thread \d{1,2}:\d{2}/.test(t.name)
        const userMessages = t.messages.filter((m) => m.role === 'user')
        if (isDefaultName && userMessages.length === 1) {
          const rawMsg = userMessages[0].content
          const firstMsg = rawMsg
            .replace(/\[Image [^\]]+\]/g, '')
            .replace(/!\[.*?\]\(data:[^)]+\)/g, '')
            .replace(/<image[^>]+src="data:[^"]*"[^>]*\/?>/gi, '')
            .replace(/<img[^>]+src="data:[^"]*"[^>]*\/?>/gi, '')
            .trim()
          if (firstMsg) {
            titleGenerationInFlight.add(taskId)
            ipc.generateThreadTitle(firstMsg, t.workspace).then(({ title }) => {
              if (title && title.trim()) {
                // Re-check: user might have renamed while we were generating
                const current = useTaskStore.getState().tasks[taskId]
                if (current && /^Thread \d{1,2}:\d{2}/.test(current.name)) {
                  useTaskStore.getState().renameTask(taskId, title.trim())
                }
              }
            }).catch((e) => {
              if (import.meta.env.DEV) console.warn('[task-listeners] generateThreadTitle failed:', e)
            }).finally(() => {
              titleGenerationInFlight.delete(taskId)
            })

            // Generate a semantic branch name for worktree threads (fire-and-forget).
            if (t.worktreePath) {
              const currentBranch = t.worktreePath.split('/').pop() ?? ''
              ipc.generateBranchName(firstMsg, t.worktreePath).then(({ branch }) => {
                if (!branch || branch === currentBranch) return
                ipc.renameWorktreeBranch(t.worktreePath!, currentBranch, branch).catch(() => {})
              }).catch(() => {})
            }
          }
        }
      }
    }

    // Emit turn quiesced receipt
    {
      const t = useTaskStore.getState().tasks[taskId]
      if (t) {
        const lastMsg = t.messages[t.messages.length - 1]
        const toolCallCount = lastMsg?.toolCalls?.length ?? 0
        getReceiptBus().publish(createTurnQuiescedReceipt(taskId, t.messages.length, toolCallCount))
      }
    }

    // Analytics: record assistant output word count and diff stats
    {
      const t = useTaskStore.getState().tasks[taskId]
      if (t) {
        const proj = projectName(t.originalWorkspace ?? t.workspace)
        const lastMsg = t.messages[t.messages.length - 1]
        if (lastMsg?.role === 'assistant' && lastMsg.content) {
          record('message_received', {
            project: proj,
            thread: taskId,
            value: lastMsg.content.split(/\s+/).filter(Boolean).length,
          })
        }
        const ws = t.worktreePath ?? t.workspace
        ipc.gitDiffStats(ws).then((stats) => {
          if (stats.additions > 0 || stats.deletions > 0) {
            record('diff_stats', { project: proj, thread: taskId, value: stats.additions, value2: stats.deletions })
            // Emit typed receipt for diff readiness
            getReceiptBus().publish(createDiffReadyReceipt(taskId, stats))
          }
        }).catch(() => {})
        const model = useSettingsStore.getState().currentModelId
        if (model) record('model_used', { project: proj, thread: taskId, detail: model })
      }
    }

    // Persist history after turn ends
    useTaskStore.getState().persistHistory()

    // Incrementally save the new assistant message to SQLite (per-message
    // granularity — survives crashes better than JSON bulk writes).
    // Thread metadata is already saved by persistHistory above.
    {
      const t = useTaskStore.getState().tasks[taskId]
      if (t && t.messages.length > 0) {
        const lastMsg = t.messages[t.messages.length - 1]
        if (lastMsg.role === 'assistant') {
          threadDb.saveMessage(taskId, lastMsg).catch(() => {})
        }
      }
    }

    // Send a native notification when the window is not focused and notifications are enabled
    const settings = useSettingsStore.getState().settings
    const task = useTaskStore.getState().tasks[taskId]
    if (task) {
      const notifStatus = task.status === 'error' ? 'error' : 'completed'
      sendTaskNotification({
        task,
        status: notifStatus,
        isNotificationsEnabled: settings.notifications ?? true,
        isSoundEnabled: settings.soundNotifications ?? true,
        onNotified: (tid) => {
          useTaskStore.setState((s) => ({
            notifiedTaskIds: s.notifiedTaskIds.includes(tid) ? s.notifiedTaskIds : [...s.notifiedTaskIds, tid],
          }))
        },
      })
    }

    // Auto-send the first queued message if any exist
    const state = useTaskStore.getState()
    const queue = state.queuedMessages[taskId] ?? []
    if (queue.length > 0) {
      const nextMsg = queue[0]
      // Remove the first message from the queue
      useTaskStore.setState((s) => ({
        queuedMessages: {
          ...s.queuedMessages,
          [taskId]: (s.queuedMessages[taskId] ?? []).slice(1),
        },
      }))
      // Send it — add as user message and dispatch to backend
      const task = useTaskStore.getState().tasks[taskId]
      if (task) {
        const userMsg: import('@/types').TaskMessage = {
          role: 'user' as const,
          content: nextMsg.text,
          timestamp: new Date().toISOString(),
        }
        useTaskStore.getState().upsertTask({
          ...task,
          status: 'running',
          messages: [...task.messages, userMsg],
        })
        useTaskStore.getState().clearTurn(taskId)
        ipc.sendMessage(taskId, nextMsg.text, nextMsg.attachments ? [...nextMsg.attachments] : undefined)
      }
    }
  })

  const unsub9 = ipc.onDebugLog((entry) => {
    useDebugStore.getState().addEntry(entry)
    if (entry.category === 'stderr') {
      const text = typeof entry.payload === 'string' ? entry.payload : JSON.stringify(entry.payload)
      if (text.includes('Dynamic registration failed') || text.includes('invalid_redirect_uri')) {
        const knownServers = ['slack', 'figma', 'github', 'notion', 'linear', 'jira', 'atlassian']
        const serverName = entry.mcpServerName
          ?? knownServers.find((s) => text.toLowerCase().includes(s))
          ?? 'unknown'
        useClaudeConfigStore.getState().setMcpError(serverName, 'OAuth setup needed — add http://127.0.0.1 as a redirect URI in your OAuth app, or disable in ~/.claude/settings/mcp.json')
      }
    }
  })

  const unsub10 = ipc.onSessionInit(({ taskId, sessionId, models, modes }) => {
    console.log('[session_init] received', { taskId, sessionId, models, modes })
    // Store the claude CLI session ID for this task
    if (sessionId && taskId && taskId !== '__probe__') {
      const s = useTaskStore.getState() as any
      useTaskStore.setState({ sessionIds: { ...s.sessionIds, [taskId]: sessionId } } as any)
    }
    if (models && typeof models === 'object') {
      const m = models as { availableModels?: Array<{ modelId: string; name: string; description?: string | null }>; currentModelId?: string }
      if (Array.isArray(m.availableModels) && m.availableModels.length > 0) {
        const settingsState = useSettingsStore.getState()
        const existingModel = settingsState.currentModelId
        const validExistingModel = existingModel && m.availableModels.some((mod) => mod.modelId === existingModel)
        // Fall back to the persisted defaultModel if the existing in-memory id
        // is empty or invalid. Only use the CLI's reported currentModelId as a
        // last resort so the user's stored choice survives a fresh session.
        const persistedDefault = settingsState.settings.defaultModel ?? null
        const validPersistedDefault = persistedDefault && m.availableModels.some((mod) => mod.modelId === persistedDefault)
        let nextModelId: string | null
        if (validExistingModel) nextModelId = existingModel
        else if (validPersistedDefault) nextModelId = persistedDefault
        else nextModelId = m.currentModelId ?? null
        useSettingsStore.setState({
          availableModels: m.availableModels,
          currentModelId: nextModelId,
        })
        // If the CLI's session boots with a different model than the user
        // chose, push the choice through so the next prompt uses the right
        // one. Skip the probe session and any unmatched ids.
        if (taskId !== '__probe__' && nextModelId && nextModelId !== m.currentModelId) {
          ipc.setModel(taskId, nextModelId).catch(() => {})
        }
      }
    }
    if (modes && typeof modes === 'object') {
      const md = modes as { availableModes?: Array<{ id: string; name: string; description?: string | null }>; currentModeId?: string }
      if (Array.isArray(md.availableModes)) {
        const existingMode = useSettingsStore.getState().currentModeId
        const validExistingMode = existingMode && md.availableModes.some((m) => m.id === existingMode)
        useSettingsStore.setState({
          availableModes: md.availableModes,
          ...(validExistingMode ? {} : { currentModeId: md.currentModeId ?? null }),
        })
        if (validExistingMode && existingMode !== md.currentModeId && taskId !== '__probe__') {
          ipc.setMode(taskId, existingMode).catch(() => {})
        }
      }
    }
  })

  const unsub11 = ipc.onCommandsUpdate(({ commands, mcpServers }) => {
    // mcpServers may arrive as a flat array or a grouped object (e.g. { "other": [...] }).
    // Normalize to a flat LiveMcpServer[] so the UI can always .map() over it.
    let flatServers: import('@/stores/settingsStore').LiveMcpServer[] | undefined
    if (mcpServers) {
      if (Array.isArray(mcpServers)) {
        flatServers = mcpServers
      } else if (typeof mcpServers === 'object') {
        flatServers = Object.values(mcpServers as Record<string, import('@/stores/settingsStore').LiveMcpServer[]>).flat()
      }
    }
    useSettingsStore.setState({
      availableCommands: commands,
      ...(flatServers ? { liveMcpServers: flatServers } : {}),
    })
  })

  const unsub12 = ipc.onTaskError(({ taskId, message }) => {
    useTaskStore.setState((s) => {
      const task = s.tasks[taskId]
      if (!task) return s
      const errorMsg: import('@/types').TaskMessage = {
        role: 'system' as const,
        content: `\u26a0\ufe0f ${message}`,
        timestamp: new Date().toISOString(),
      }
      // Drop the dispatch snapshot — the turn is dead.
      const { [taskId]: _drop, ...remainingSnapshots } = s.dispatchSnapshots
      return {
        tasks: { ...s.tasks, [taskId]: { ...task, messages: [...task.messages, errorMsg], status: 'error' } },
        streamingChunks: { ...s.streamingChunks, [taskId]: '' },
        thinkingChunks: { ...s.thinkingChunks, [taskId]: '' },
        liveToolCalls: { ...s.liveToolCalls, [taskId]: [] },
        liveToolSplits: { ...s.liveToolSplits, [taskId]: [] },
        dispatchSnapshots: remainingSnapshots,
      }
    })
    // Notify on errors while backgrounded
    const errSettings = useSettingsStore.getState().settings
    const errTask = useTaskStore.getState().tasks[taskId]
    if (errTask) {
      sendTaskNotification({
        task: errTask,
        status: 'error',
        isNotificationsEnabled: errSettings.notifications ?? true,
        isSoundEnabled: errSettings.soundNotifications ?? true,
        onNotified: (tid) => {
          useTaskStore.setState((s) => ({
            notifiedTaskIds: s.notifiedTaskIds.includes(tid) ? s.notifiedTaskIds : [...s.notifiedTaskIds, tid],
          }))
        },
      })
    }
  })

  const unsub13 = ipc.onCompactionStatus(({ taskId, status }) => {
    const mapped = status === 'started' ? 'compacting'
      : status === 'completed' ? 'completed'
      : status === 'failed' ? 'failed'
      : null
    if (mapped) {
      useTaskStore.getState().updateCompactionStatus(taskId, mapped as import('@/types').CompactionStatus)
    }
  })

  const unsub14 = ipc.onUserInputRequest(({ taskId, requestId, fields }) => {
    useTaskStore.setState((s) => ({
      pendingUserInputs: { ...s.pendingUserInputs, [taskId]: { requestId, fields } },
    }))
  })

  const unsub15 = ipc.onSubagentUpdate(({ taskId, subagents }) => {
    const parsed = parseSubagents(subagents)
    useTaskStore.getState().updateSubagents(taskId, parsed)
  })

  return () => {
    clearInterval(watchdogInterval)
    unsub1(); unsub2(); unsub3(); unsub4(); unsub5()
    unsub6(); unsub7(); unsub8(); unsub9(); unsub10(); unsub11(); unsub12()
    unsub13(); unsub14(); unsub15()
  }
}
