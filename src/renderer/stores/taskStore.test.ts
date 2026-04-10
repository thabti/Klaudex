import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    cancelTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    listTasks: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/lib/history-store', () => ({
  loadThreads: vi.fn().mockResolvedValue([]),
  loadProjects: vi.fn().mockResolvedValue([]),
  saveThreads: vi.fn().mockResolvedValue(undefined),
  toArchivedTasks: vi.fn().mockReturnValue([]),
  clearHistory: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./debugStore', () => ({
  useDebugStore: { getState: () => ({ addEntry: vi.fn() }) },
}))
vi.mock('./settingsStore', () => ({
  useSettingsStore: { getState: () => ({}), setState: vi.fn() },
}))
vi.mock('./diffStore', () => ({
  useDiffStore: { getState: () => ({ fetchDiff: vi.fn() }) },
}))
vi.mock('./kiroStore', () => ({
  useKiroStore: { getState: () => ({ setMcpError: vi.fn() }) },
}))

import { useTaskStore } from './taskStore'
import type { AgentTask } from '@/types'

const makeTask = (overrides?: Partial<AgentTask>): AgentTask => ({
  id: 'task-1',
  name: 'Test Task',
  workspace: '/projects/test',
  status: 'paused',
  createdAt: '2026-01-01T00:00:00Z',
  messages: [],
  ...overrides,
})

beforeEach(() => {
  useTaskStore.setState({
    tasks: {}, projects: [], deletedTaskIds: new Set(), selectedTaskId: null,
    streamingChunks: {}, thinkingChunks: {}, liveToolCalls: {},
    queuedMessages: {}, activityFeed: [], connected: false,
    terminalOpenTasks: new Set(), pendingWorkspace: null,
    view: 'dashboard', isNewProjectOpen: false, isSettingsOpen: false, projectNames: {},
  })
})

describe('upsertTask', () => {
  it('adds a new task', () => {
    useTaskStore.getState().upsertTask(makeTask())
    expect(useTaskStore.getState().tasks['task-1']).toBeDefined()
  })

  it('updates existing task', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().upsertTask(makeTask({ status: 'running' }))
    expect(useTaskStore.getState().tasks['task-1'].status).toBe('running')
  })

  it('preserves messages when incoming has fewer', () => {
    const msg = { role: 'user' as const, content: 'hi', timestamp: '' }
    useTaskStore.getState().upsertTask(makeTask({ messages: [msg] }))
    useTaskStore.getState().upsertTask(makeTask({ status: 'running', messages: [] }))
    expect(useTaskStore.getState().tasks['task-1'].messages).toHaveLength(1)
  })

  it('skips deleted task IDs', () => {
    useTaskStore.setState({ deletedTaskIds: new Set(['task-1']) })
    useTaskStore.getState().upsertTask(makeTask())
    expect(useTaskStore.getState().tasks['task-1']).toBeUndefined()
  })

  it('adds activity feed entry on status change', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().upsertTask(makeTask({ status: 'running' }))
    expect(useTaskStore.getState().activityFeed.length).toBeGreaterThan(0)
  })
})

describe('removeTask', () => {
  it('removes task from state', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().removeTask('task-1')
    expect(useTaskStore.getState().tasks['task-1']).toBeUndefined()
  })

  it('clears streaming data', () => {
    useTaskStore.setState({ streamingChunks: { 'task-1': 'text' }, thinkingChunks: { 'task-1': 'think' }, liveToolCalls: { 'task-1': [] } })
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().removeTask('task-1')
    expect(useTaskStore.getState().streamingChunks['task-1']).toBeUndefined()
    expect(useTaskStore.getState().thinkingChunks['task-1']).toBeUndefined()
    expect(useTaskStore.getState().liveToolCalls['task-1']).toBeUndefined()
  })

  it('adds to deletedTaskIds', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().removeTask('task-1')
    expect(useTaskStore.getState().deletedTaskIds.has('task-1')).toBe(true)
  })

  it('clears selectedTaskId if removed', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.setState({ selectedTaskId: 'task-1' })
    useTaskStore.getState().removeTask('task-1')
    expect(useTaskStore.getState().selectedTaskId).toBeNull()
  })
})

describe('streaming', () => {
  it('appendChunk accumulates text', () => {
    useTaskStore.getState().appendChunk('t1', 'hello ')
    useTaskStore.getState().appendChunk('t1', 'world')
    expect(useTaskStore.getState().streamingChunks['t1']).toBe('hello world')
  })

  it('appendThinkingChunk accumulates text', () => {
    useTaskStore.getState().appendThinkingChunk('t1', 'hmm ')
    useTaskStore.getState().appendThinkingChunk('t1', 'ok')
    expect(useTaskStore.getState().thinkingChunks['t1']).toBe('hmm ok')
  })

  it('clearTurn resets all live state', () => {
    useTaskStore.setState({
      streamingChunks: { t1: 'text' },
      thinkingChunks: { t1: 'think' },
      liveToolCalls: { t1: [{ toolCallId: 'tc1', title: 'test', status: 'completed' }] },
    })
    useTaskStore.getState().clearTurn('t1')
    expect(useTaskStore.getState().streamingChunks['t1']).toBe('')
    expect(useTaskStore.getState().thinkingChunks['t1']).toBe('')
    expect(useTaskStore.getState().liveToolCalls['t1']).toEqual([])
  })
})

describe('upsertToolCall', () => {
  it('adds new tool call', () => {
    useTaskStore.getState().upsertToolCall('t1', { toolCallId: 'tc1', title: 'read', status: 'pending' })
    expect(useTaskStore.getState().liveToolCalls['t1']).toHaveLength(1)
  })

  it('updates existing by toolCallId', () => {
    useTaskStore.getState().upsertToolCall('t1', { toolCallId: 'tc1', title: 'read', status: 'pending' })
    useTaskStore.getState().upsertToolCall('t1', { toolCallId: 'tc1', title: 'read', status: 'completed' })
    expect(useTaskStore.getState().liveToolCalls['t1']).toHaveLength(1)
    expect(useTaskStore.getState().liveToolCalls['t1'][0].status).toBe('completed')
  })
})

describe('queue', () => {
  it('enqueue and dequeue', () => {
    useTaskStore.getState().enqueueMessage('t1', 'msg1')
    useTaskStore.getState().enqueueMessage('t1', 'msg2')
    const msgs = useTaskStore.getState().dequeueMessages('t1')
    expect(msgs).toEqual(['msg1', 'msg2'])
    expect(useTaskStore.getState().queuedMessages['t1']).toEqual([])
  })

  it('removeQueuedMessage removes by index', () => {
    useTaskStore.getState().enqueueMessage('t1', 'a')
    useTaskStore.getState().enqueueMessage('t1', 'b')
    useTaskStore.getState().enqueueMessage('t1', 'c')
    useTaskStore.getState().removeQueuedMessage('t1', 1)
    expect(useTaskStore.getState().queuedMessages['t1']).toEqual(['a', 'c'])
  })

  it('reorderQueuedMessage moves item', () => {
    useTaskStore.getState().enqueueMessage('t1', 'a')
    useTaskStore.getState().enqueueMessage('t1', 'b')
    useTaskStore.getState().enqueueMessage('t1', 'c')
    useTaskStore.getState().reorderQueuedMessage('t1', 0, 2)
    expect(useTaskStore.getState().queuedMessages['t1']).toEqual(['b', 'c', 'a'])
  })
})

describe('createDraftThread', () => {
  it('creates a paused task and selects it', () => {
    const id = useTaskStore.getState().createDraftThread('/ws')
    const task = useTaskStore.getState().tasks[id]
    expect(task).toBeDefined()
    expect(task.status).toBe('paused')
    expect(task.workspace).toBe('/ws')
    expect(useTaskStore.getState().selectedTaskId).toBe(id)
    expect(useTaskStore.getState().view).toBe('chat')
  })
})

describe('projects', () => {
  it('addProject adds workspace', () => {
    useTaskStore.getState().addProject('/ws')
    expect(useTaskStore.getState().projects).toContain('/ws')
  })

  it('addProject deduplicates', () => {
    useTaskStore.getState().addProject('/ws')
    useTaskStore.getState().addProject('/ws')
    expect(useTaskStore.getState().projects).toHaveLength(1)
  })

  it('reorderProject swaps positions', () => {
    useTaskStore.setState({ projects: ['/a', '/b', '/c'] })
    useTaskStore.getState().reorderProject(0, 2)
    expect(useTaskStore.getState().projects).toEqual(['/b', '/c', '/a'])
  })
})

describe('simple setters', () => {
  it('setSelectedTask', () => {
    useTaskStore.getState().setSelectedTask('x')
    expect(useTaskStore.getState().selectedTaskId).toBe('x')
  })

  it('setView', () => {
    useTaskStore.getState().setView('chat')
    expect(useTaskStore.getState().view).toBe('chat')
  })

  it('setNewProjectOpen', () => {
    useTaskStore.getState().setNewProjectOpen(true)
    expect(useTaskStore.getState().isNewProjectOpen).toBe(true)
  })

  it('setSettingsOpen', () => {
    useTaskStore.getState().setSettingsOpen(true)
    expect(useTaskStore.getState().isSettingsOpen).toBe(true)
  })

  it('toggleTerminal', () => {
    useTaskStore.getState().toggleTerminal('t1')
    expect(useTaskStore.getState().terminalOpenTasks.has('t1')).toBe(true)
    useTaskStore.getState().toggleTerminal('t1')
    expect(useTaskStore.getState().terminalOpenTasks.has('t1')).toBe(false)
  })

  it('renameTask', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().renameTask('task-1', 'New Name')
    expect(useTaskStore.getState().tasks['task-1'].name).toBe('New Name')
  })

  it('renameProject', () => {
    useTaskStore.getState().renameProject('/ws', 'My Project')
    expect(useTaskStore.getState().projectNames['/ws']).toBe('My Project')
  })

  it('setPendingWorkspace', () => {
    useTaskStore.getState().setPendingWorkspace('/ws')
    expect(useTaskStore.getState().pendingWorkspace).toBe('/ws')
    expect(useTaskStore.getState().selectedTaskId).toBeNull()
    expect(useTaskStore.getState().view).toBe('chat')
  })

  it('updatePlan', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().updatePlan('task-1', [{ content: 'step', status: 'pending', priority: 'high' }])
    expect(useTaskStore.getState().tasks['task-1'].plan).toHaveLength(1)
  })

  it('updateUsage', () => {
    useTaskStore.getState().upsertTask(makeTask())
    useTaskStore.getState().updateUsage('task-1', 5000, 10000)
    expect(useTaskStore.getState().tasks['task-1'].contextUsage).toEqual({ used: 5000, size: 10000 })
  })
})
