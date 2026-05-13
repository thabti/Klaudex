import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Minimal mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/ipc', () => ({ ipc: { setMode: vi.fn(), sendMessage: vi.fn() } }))
vi.mock('@/hooks/useSlashAction', () => ({
  useSlashAction: () => ({ panel: null, dismissPanel: vi.fn(), execute: vi.fn().mockReturnValue(false), executeFullInput: vi.fn().mockReturnValue(false) }),
}))
vi.mock('@/hooks/useAttachments', () => ({
  useAttachments: () => ({
    attachments: [],
    folderPaths: [],
    droppedFiles: [],
    isDragOver: false,
    fileInputRef: { current: null },
    handlePaste: vi.fn(),
    handleFilePickerClick: vi.fn(),
    handleFileInputChange: vi.fn(),
    handleRemoveAttachment: vi.fn(),
    handleRemoveFolder: vi.fn(),
    clearAttachments: vi.fn(),
  }),
}))
vi.mock('@/hooks/useFileMention', () => ({
  useFileMention: () => ({
    mentionTrigger: null,
    mentionIndex: 0,
    mentionedFiles: [],
    handleSelectFile: vi.fn(),
    handleRemoveMention: vi.fn(),
    detectMentionTrigger: vi.fn(),
    dismissMention: vi.fn(),
    incrementMentionIndex: vi.fn(),
    decrementMentionIndex: vi.fn(),
    clearMentions: vi.fn(),
    addMentionedFile: vi.fn(),
  }),
}))
vi.mock('@/stores/claudeConfigStore', () => ({
  useClaudeConfigStore: { getState: () => ({ config: { prompts: [] } }) },
}))

import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatInput } from './useChatInput'

const BASE_TASK_STATE = {
  tasks: {
    't1': { id: 't1', name: 'Test', workspace: '/ws', status: 'paused' as const, createdAt: '', messages: [] },
  },
  selectedTaskId: 't1',
  projects: ['/ws'],
  deletedTaskIds: new Set<string>(),
  softDeleted: {},
  pendingWorkspace: null,
  view: 'chat' as const,
  isNewProjectOpen: false,
  isSettingsOpen: false,
  settingsInitialSection: null,
  streamingChunks: {},
  thinkingChunks: {},
  liveToolCalls: {},
  liveToolSplits: {},
  queuedMessages: {},
  activityFeed: [],
  connected: true,
  terminalOpenTasks: new Set<string>(),
  projectNames: {},
  btwCheckpoint: null,
  archivedMeta: {},
  projectIds: {},
  taskModes: {},
  taskModels: {},
  subagentInfo: {},
  dispatchSnapshots: {},
  liveSubagents: {},
  liveWorktrees: {},
  worktreeSetupState: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  useTaskStore.setState(BASE_TASK_STATE)
  useSettingsStore.setState({
    settings: { claudeBin: 'claude', agentProfiles: [], fontSize: 13 },
    availableModes: [],
    currentModeId: 'default',
    currentModelId: null,
    availableModels: [],
    modelsLoading: false,
    modelsError: null,
    isLoaded: true,
    activeWorkspace: null,
    availableCommands: [],
    liveMcpServers: [],
    claudeAuth: null,
    claudeAuthChecked: false,
  })
})

describe('useChatInput ArrowUp queue-edit behaviour', () => {
  it('dispatches queue-edit-message and removes top item when ArrowUp pressed on empty input with queued messages', () => {
    useTaskStore.getState().enqueueMessage('t1', 'queued text')

    const dispatched: string[] = []
    document.addEventListener('queue-edit-message', (e) => {
      dispatched.push((e as CustomEvent<{ text: string }>).detail.text)
    })

    const onSendMessage = vi.fn()
    const { result } = renderHook(() =>
      useChatInput({ taskId: 't1', onSendMessage }),
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn(), shiftKey: false } as unknown as React.KeyboardEvent)
    })

    expect(dispatched).toContain('queued text')
    expect(useTaskStore.getState().queuedMessages['t1'] ?? []).toHaveLength(0)

    document.removeEventListener('queue-edit-message', () => {})
  })

  it('does not dispatch queue-edit-message when input has text', () => {
    useTaskStore.getState().enqueueMessage('t1', 'queued text')

    const dispatched: string[] = []
    const handler = (e: Event) => dispatched.push((e as CustomEvent<{ text: string }>).detail.text)
    document.addEventListener('queue-edit-message', handler)

    const onSendMessage = vi.fn()
    const { result } = renderHook(() =>
      useChatInput({ taskId: 't1', onSendMessage, initialValue: 'some draft' }),
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn(), shiftKey: false } as unknown as React.KeyboardEvent)
    })

    expect(dispatched).toHaveLength(0)
    expect(useTaskStore.getState().queuedMessages['t1']).toHaveLength(1)

    document.removeEventListener('queue-edit-message', handler)
  })

  it('does not dispatch queue-edit-message when queue is empty', () => {
    const dispatched: string[] = []
    const handler = (e: Event) => dispatched.push((e as CustomEvent<{ text: string }>).detail.text)
    document.addEventListener('queue-edit-message', handler)

    const onSendMessage = vi.fn()
    const { result } = renderHook(() =>
      useChatInput({ taskId: 't1', onSendMessage }),
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn(), shiftKey: false } as unknown as React.KeyboardEvent)
    })

    expect(dispatched).toHaveLength(0)

    document.removeEventListener('queue-edit-message', handler)
  })

  it('removes only the first queued message leaving the rest intact', () => {
    useTaskStore.getState().enqueueMessage('t1', 'first')
    useTaskStore.getState().enqueueMessage('t1', 'second')

    const onSendMessage = vi.fn()
    const { result } = renderHook(() =>
      useChatInput({ taskId: 't1', onSendMessage }),
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn(), shiftKey: false } as unknown as React.KeyboardEvent)
    })

    const remaining = useTaskStore.getState().queuedMessages['t1'] ?? []
    expect(remaining).toHaveLength(1)
    expect(remaining[0].text).toBe('second')
  })
})
