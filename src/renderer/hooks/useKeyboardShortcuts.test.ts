import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    pauseTask: vi.fn().mockResolvedValue(undefined),
    resumeTask: vi.fn().mockResolvedValue(undefined),
    cancelTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    setMode: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {},
      activeWorkspace: null,
      setProjectPref: vi.fn(),
      saveSettings: vi.fn().mockResolvedValue(undefined),
    }),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))
vi.mock('@/stores/claudeConfigStore', () => ({
  useClaudeConfigStore: {
    getState: () => ({ config: { prompts: [], agents: [] } }),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))
vi.mock('@/stores/diffStore', () => ({
  useDiffStore: {
    getState: () => ({ isOpen: false, setOpen: vi.fn() }),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))
vi.mock('@/stores/debugStore', () => ({
  useDebugStore: {
    getState: () => ({ isOpen: false, setOpen: vi.fn() }),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

import { ipc } from '@/lib/ipc'
import { useTaskStore } from '@/stores/taskStore'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import type { AgentTask } from '@/types'

const makeTask = (overrides?: Partial<AgentTask>): AgentTask => ({
  id: 'task-1',
  name: 'Test',
  workspace: '/ws',
  status: 'running',
  createdAt: '2026-01-01T00:00:00Z',
  messages: [{ role: 'user' as const, content: 'hello', timestamp: '2026-01-01T00:00:00Z' }],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  useTaskStore.setState({
    tasks: {},
    selectedTaskId: null,
    projects: [],
    projectIds: {},
    deletedTaskIds: new Set(),
    softDeleted: {},
    pendingWorkspace: null,
    view: 'chat',
    isNewProjectOpen: false,
    isSettingsOpen: false,
    streamingChunks: {},
    thinkingChunks: {},
    liveToolCalls: {},
    liveToolSplits: {},
    queuedMessages: {},
    activityFeed: [],
    connected: true,
    terminalOpenTasks: new Set(),
    projectNames: {},
    btwCheckpoint: null,
    archivedMeta: {},
    taskModes: {},
    taskModels: {},
    dispatchSnapshots: {},
    liveSubagents: {},
    settingsInitialSection: null,
  })
})

describe('useKeyboardShortcuts — Escape on running task', () => {
  it('calls ipc.pauseTask with the selected task id', () => {
    const task = makeTask()
    useTaskStore.setState({ tasks: { 'task-1': task }, selectedTaskId: 'task-1' })
    renderHook(() => useKeyboardShortcuts())

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(ipc.pauseTask).toHaveBeenCalledWith('task-1')
  })

  it('sets needsNewConnection on the task after pause', () => {
    const task = makeTask()
    useTaskStore.setState({ tasks: { 'task-1': task }, selectedTaskId: 'task-1' })
    renderHook(() => useKeyboardShortcuts())

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    const updated = useTaskStore.getState().tasks['task-1']
    expect(updated?.needsNewConnection).toBe(true)
  })

  it('dispatches agent-paused DOM event', () => {
    const task = makeTask()
    useTaskStore.setState({ tasks: { 'task-1': task }, selectedTaskId: 'task-1' })
    renderHook(() => useKeyboardShortcuts())

    let fired = false
    document.addEventListener('agent-paused', () => { fired = true }, { once: true })

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(fired).toBe(true)
  })

  it('clears streaming turn data', () => {
    const task = makeTask()
    useTaskStore.setState({
      tasks: { 'task-1': task },
      selectedTaskId: 'task-1',
      streamingChunks: { 'task-1': 'partial output' },
      liveToolCalls: { 'task-1': [{ toolCallId: 'tc1', title: 'bash', status: 'in_progress' as const }] },
    })
    renderHook(() => useKeyboardShortcuts())

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    const s = useTaskStore.getState()
    expect(s.streamingChunks['task-1']).toBe('')
    expect(s.liveToolCalls['task-1']).toEqual([])
  })

  it('does nothing when task is not running', () => {
    const task = makeTask({ status: 'paused' })
    useTaskStore.setState({ tasks: { 'task-1': task }, selectedTaskId: 'task-1' })
    renderHook(() => useKeyboardShortcuts())

    let fired = false
    document.addEventListener('agent-paused', () => { fired = true }, { once: true })

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(ipc.pauseTask).not.toHaveBeenCalled()
    expect(fired).toBe(false)
  })

  it('does nothing when no task is selected', () => {
    useTaskStore.setState({ tasks: {}, selectedTaskId: null })
    renderHook(() => useKeyboardShortcuts())

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(ipc.pauseTask).not.toHaveBeenCalled()
  })

  it('does nothing when Escape fired from terminal drawer', () => {
    const task = makeTask()
    useTaskStore.setState({ tasks: { 'task-1': task }, selectedTaskId: 'task-1' })
    renderHook(() => useKeyboardShortcuts())

    const terminal = document.createElement('div')
    terminal.setAttribute('data-testid', 'terminal-drawer')
    document.body.appendChild(terminal)

    // Dispatch from the terminal element so e.target is naturally inside the drawer
    terminal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(ipc.pauseTask).not.toHaveBeenCalled()
    document.body.removeChild(terminal)
  })
})
