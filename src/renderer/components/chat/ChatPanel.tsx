import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { IconHistory } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { applyTurnEnd } from '@/stores/task-store-listeners'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { Statusline } from './Statusline'
import { PermissionBanner } from './PermissionBanner'
import { ExecutionPlan } from './ExecutionPlan'
import { CompactSuggestBanner } from './CompactSuggestBanner'
import { TerminalDrawer } from './TerminalDrawer'
import { QueuedMessages } from './QueuedMessages'
import { SearchBar } from './SearchBar'
import { SearchQueryContext } from './HighlightText'
import { BtwOverlay } from './BtwOverlay'
import { UserInputCard } from './UserInputCard'
import { useMessageSearch } from '@/hooks/useMessageSearch'
import { ipc } from '@/lib/ipc'
import { record } from '@/lib/analytics-collector'
import type { TaskMessage, ToolCall, IpcAttachment } from '@/types'
import type { QueuedMessage } from '@/stores/task-store-types'
import type { TimelineRow } from '@/lib/timeline'

const EMPTY_MESSAGES: TaskMessage[] = []
const EMPTY_TOOL_CALLS: ToolCall[] = []
const EMPTY_OPTIONS: Array<{ optionId: string; name: string; kind: string }> = []
const EMPTY_QUEUE: QueuedMessage[] = []

/** Format cost as USD with appropriate decimal places */
const formatCost = (cost: number): string => {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

/**
 * Owns the streaming selectors so ChatPanel doesn't re-render on every token.
 */
const StreamingMessageList = memo(function StreamingMessageList({
  taskId: taskIdProp,
  isRunning,
  searchMatchIds,
  activeMatchId,
  onTimelineRows,
}: {
  taskId?: string | null
  isRunning: boolean
  searchMatchIds?: string[]
  activeMatchId?: string | null
  onTimelineRows?: (rows: TimelineRow[]) => void
}) {
  const storeSelectedId = useTaskStore((s) => s.selectedTaskId)
  const resolvedId = taskIdProp ?? storeSelectedId
  const messages = useTaskStore((s) => resolvedId ? s.tasks[resolvedId]?.messages ?? EMPTY_MESSAGES : EMPTY_MESSAGES)
  const streamingChunk = useTaskStore((s) => s.btwCheckpoint ? '' : resolvedId ? s.streamingChunks[resolvedId] ?? '' : '')
  const liveToolCalls = useTaskStore((s) => s.btwCheckpoint ? EMPTY_TOOL_CALLS : resolvedId ? s.liveToolCalls[resolvedId] ?? EMPTY_TOOL_CALLS : EMPTY_TOOL_CALLS)
  const liveThinking = useTaskStore((s) => s.btwCheckpoint ? '' : resolvedId ? s.thinkingChunks[resolvedId] ?? '' : '')

  return (
    <MessageList
      messages={messages}
      streamingChunk={streamingChunk}
      liveToolCalls={liveToolCalls}
      liveThinking={liveThinking}
      isRunning={isRunning}
      searchMatchIds={searchMatchIds}
      activeMatchId={activeMatchId}
      onTimelineRows={onTimelineRows}
    />
  )
})

/** Send a message directly to the backend for a specific task. */
async function sendMessageDirect(targetTaskId: string, msg: string, attachments?: IpcAttachment[]): Promise<void> {
  const state = useTaskStore.getState()
  const task = state.tasks[targetTaskId]
  if (!task) return
  const isDraft = task.messages.length === 0 && task.status === 'paused'
  const needsNewConnection = task.needsNewConnection === true

  const userMsg = { role: 'user' as const, content: msg, timestamp: new Date().toISOString() }
  state.upsertTask({ ...task, status: 'running', messages: [...task.messages, userMsg] })
  state.clearTurn(task.id)

  const proj = (task.originalWorkspace ?? task.workspace).replace(/\\/g, '/').split('/').pop() ?? ''
  record('message_sent', { project: proj, thread: task.id, value: msg.split(/\s+/).filter(Boolean).length })

  if (isDraft || needsNewConnection) {
    const { settings, currentModeId } = useSettingsStore.getState()
    const projectRoot = task.originalWorkspace ?? task.workspace
    const projectPrefs = projectRoot ? settings.projectPrefs?.[projectRoot] : undefined
    const autoApprove = projectPrefs?.autoApprove !== undefined ? projectPrefs.autoApprove : settings.autoApprove
    const modeId = currentModeId && currentModeId !== 'default' ? currentModeId : undefined
    const created = await ipc.createTask({ name: task.name, workspace: task.workspace, prompt: msg, autoApprove, modeId, attachments })
    const draft = useTaskStore.getState().tasks[task.id]
    const messages = draft?.messages.length ? draft.messages : [userMsg]
    state.upsertTask({ ...created, messages, needsNewConnection: undefined })
    record('thread_created', { project: proj, thread: created.id })
    if (currentModeId && currentModeId !== 'kiro_default') {
      useTaskStore.getState().setTaskMode(created.id, currentModeId)
    }
    state.setSelectedTask(created.id)
  } else {
    ipc.sendMessage(task.id, msg, attachments)
  }
}

/** Zigzag divider shown at top of archived conversations */
const ArchivedBanner = memo(function ArchivedBanner() {
  return (
    <div className="relative flex items-center justify-center py-4 px-6 select-none" data-testid="chat-archived-banner">
      <svg className="flex-1 h-3 text-blue-600/30 dark:text-blue-400/30" preserveAspectRatio="none" viewBox="0 0 120 12">
        <path d="M0,6 L5,0 L10,6 L15,0 L20,6 L25,0 L30,6 L35,0 L40,6 L45,0 L50,6 L55,0 L60,6 L65,0 L70,6 L75,0 L80,6 L85,0 L90,6 L95,0 L100,6 L105,0 L110,6 L115,0 L120,6" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="flex shrink-0 items-center gap-1.5 mx-3 rounded-full border border-blue-400/20 bg-card px-3 py-1">
        <IconHistory className="size-3 text-blue-600/50 dark:text-blue-400/50" />
        <span className="text-[11px] font-medium text-blue-500/60 dark:text-blue-300/50">Previous conversation — view only</span>
      </div>
      <svg className="flex-1 h-3 text-blue-600/30 dark:text-blue-400/30" preserveAspectRatio="none" viewBox="0 0 120 12">
        <path d="M0,6 L5,0 L10,6 L15,0 L20,6 L25,0 L30,6 L35,0 L40,6 L45,0 L50,6 L55,0 L60,6 L65,0 L70,6 L75,0 L80,6 L85,0 L90,6 L95,0 L100,6 L105,0 L110,6 L115,0 L120,6" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  )
})

interface ChatPanelProps {
  /** Override the task ID to display. When omitted, uses selectedTaskId from the store. */
  taskId?: string | null
}

export const ChatPanel = memo(function ChatPanel({ taskId: taskIdProp }: ChatPanelProps) {
  const storeSelectedId = useTaskStore((s) => s.selectedTaskId)
  const resolvedTaskId = taskIdProp ?? storeSelectedId
  const taskStatus = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.status : null)
  const isArchived = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.isArchived === true : false)
  const taskPlan = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.plan : null)
  const pendingPermission = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.pendingPermission : null)
  const contextUsage = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.contextUsage : null)
  const isPlanMode = useSettingsStore((s) => s.currentModeId === 'kiro_planner')
  const taskWorkspace = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.workspace : null)
  const isWorktree = useTaskStore((s) => resolvedTaskId ? !!s.tasks[resolvedTaskId]?.worktreePath : false)
  const messageCount = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.messages?.length ?? 0 : 0)
  const terminalOpen = useTaskStore((s) => resolvedTaskId ? s.terminalOpenTasks.has(resolvedTaskId) : false)
  const toggleTerminal = useTaskStore((s) => s.toggleTerminal)
  const queuedMessages = useTaskStore((s) => resolvedTaskId ? s.queuedMessages[resolvedTaskId] ?? EMPTY_QUEUE : EMPTY_QUEUE)
  const isBtwMode = useTaskStore((s) => s.btwCheckpoint !== null)
  const totalCost = useTaskStore((s) => resolvedTaskId ? s.tasks[resolvedTaskId]?.totalCost : undefined)
  const pendingUserInput = useTaskStore((s) => resolvedTaskId ? (s as any).pendingUserInputs?.[resolvedTaskId] : undefined)

  const timelineRowsRef = useRef<TimelineRow[]>([])
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([])
  const handleTimelineRows = useCallback((rows: TimelineRow[]) => {
    if (rows !== timelineRowsRef.current) {
      timelineRowsRef.current = rows
      setTimelineRows(rows)
    }
  }, [])

  const search = useMessageSearch(timelineRows)

  const prevTaskIdRef = useRef(resolvedTaskId)
  useEffect(() => {
    if (prevTaskIdRef.current !== resolvedTaskId && search.isOpen) {
      search.close()
    }
    prevTaskIdRef.current = resolvedTaskId
  }, [resolvedTaskId, search])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        if (search.isOpen) {
          search.close()
        } else {
          search.open()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [search])

  const handleSendMessage = useCallback(async (msg: string, attachments?: IpcAttachment[]) => {
    const state = useTaskStore.getState()
    const id = resolvedTaskId
    const task = id ? state.tasks[id] : null
    if (!task || !id) return

    if (task.status === 'running' && !state.btwCheckpoint) {
      state.enqueueMessage(task.id, msg, attachments)
      return
    }

    await sendMessageDirect(id, msg, attachments)
  }, [resolvedTaskId])

  const handleRemoveQueued = useCallback((index: number) => {
    if (resolvedTaskId) useTaskStore.getState().removeQueuedMessage(resolvedTaskId, index)
  }, [resolvedTaskId])

  const handleSteer = useCallback(async (index: number) => {
    const state = useTaskStore.getState()
    const id = resolvedTaskId
    if (!id) return
    const queued = state.queuedMessages[id]?.[index]
    if (!queued) return
    await ipc.pauseTask(id)
    state.removeQueuedMessage(id, index)
    useTaskStore.setState((s) => applyTurnEnd(s, id))
    await sendMessageDirect(id, queued.text, queued.attachments ? [...queued.attachments] : undefined)
  }, [resolvedTaskId])

  const handleReorderQueued = useCallback((from: number, to: number) => {
    if (resolvedTaskId) useTaskStore.getState().reorderQueuedMessage(resolvedTaskId, from, to)
  }, [resolvedTaskId])

  const [isInputCollapsed, setIsInputCollapsed] = useState(false)
  const handleToggleCollapse = useCallback(() => setIsInputCollapsed((v) => !v), [])

  const handlePermissionSelect = useCallback((optionId: string) => {
    const state = useTaskStore.getState()
    const task = resolvedTaskId ? state.tasks[resolvedTaskId] : null
    if (task?.pendingPermission) {
      ipc.selectPermissionOption(task.id, task.pendingPermission.requestId, optionId).catch(() => {})
    }
  }, [resolvedTaskId])

  const handlePause = useCallback(() => {
    if (resolvedTaskId) ipc.pauseTask(resolvedTaskId)
  }, [resolvedTaskId])

  if (!taskStatus) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Klaudex</EmptyTitle>
          <EmptyDescription>Select a task or create a new one to get started.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const isRunning = taskStatus === 'running'
  const inputDisabled = isArchived || taskStatus === 'cancelled'

  const searchQuery = search.isOpen ? search.query : ''

  return (
    <div data-testid="chat-panel" className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {isBtwMode && <BtwOverlay />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {taskPlan && taskPlan.length > 0 && (
          <div className="shrink-0 px-4 pt-2">
            <ExecutionPlan steps={taskPlan} />
          </div>
        )}

        {search.isOpen && (
          <div className="shrink-0">
            <SearchBar
              query={search.query}
              matchCount={search.matchCount}
              activeIndex={search.activeIndex}
              onQueryChange={search.setQuery}
              onNext={search.goToNext}
              onPrevious={search.goToPrevious}
              onClose={search.close}
            />
          </div>
        )}

        <SearchQueryContext.Provider value={searchQuery}>
          <StreamingMessageList
            taskId={resolvedTaskId}
            isRunning={isRunning && !isBtwMode}
            searchMatchIds={search.isOpen ? search.matchIds : undefined}
            activeMatchId={search.isOpen ? search.activeMatchId : undefined}
            onTimelineRows={handleTimelineRows}
          />
        </SearchQueryContext.Provider>

        {isArchived && <ArchivedBanner />}

        {!isArchived && pendingPermission && resolvedTaskId && (
          <PermissionBanner
            taskId={resolvedTaskId}
            toolName={pendingPermission.toolName}
            description={pendingPermission.description}
            options={pendingPermission.options ?? EMPTY_OPTIONS}
            onSelect={handlePermissionSelect}
          />
        )}

        {!isArchived && pendingUserInput && resolvedTaskId && (
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-4xl xl:max-w-5xl">
            <UserInputCard
              taskId={resolvedTaskId}
              requestId={pendingUserInput.requestId}
              fields={pendingUserInput.fields}
            />
          </div>
        )}

        {!isArchived && totalCost !== undefined && totalCost > 0 && (
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-4xl xl:max-w-5xl">
            <div className="flex justify-end pb-1">
              <span className="text-[11px] tabular-nums text-muted-foreground/70">
                {formatCost(totalCost)} spent
              </span>
            </div>
          </div>
        )}

        {!isArchived && (
          <CompactSuggestBanner contextUsage={contextUsage} isPlanMode={isPlanMode} />
        )}

        {!isArchived && (
          <QueuedMessages messages={queuedMessages} onRemove={handleRemoveQueued} onReorder={handleReorderQueued} onSteer={isRunning ? handleSteer : undefined} />
        )}

        {isArchived ? (
          <div className="px-4 pb-4 pt-2 sm:px-6">
            <div className="mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl">
              <div className="flex items-center justify-center rounded-2xl border border-border/40 bg-card px-4 py-3 opacity-50">
                <span className="text-[13px] text-muted-foreground/80">This conversation is from a previous session</span>
              </div>
            </div>
          </div>
        ) : (
          <ChatInput
            disabled={inputDisabled}
            disabledReason={isArchived ? 'Previous session — view only' : taskStatus === 'cancelled' ? 'Task was cancelled' : undefined}
            contextUsage={contextUsage}
            messageCount={messageCount}
            isRunning={isRunning}
            hasQueuedMessages={queuedMessages.length > 0}
            onSendMessage={handleSendMessage}
            onPause={handlePause}
            workspace={taskWorkspace}
            isWorktree={isWorktree}
            isCollapsed={isInputCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        )}
        <Statusline />
      </div>
      {terminalOpen && taskWorkspace && resolvedTaskId && (
        <TerminalDrawer key={resolvedTaskId} cwd={taskWorkspace} onClose={() => toggleTerminal(resolvedTaskId)} />
      )}
    </div>
  )
})
