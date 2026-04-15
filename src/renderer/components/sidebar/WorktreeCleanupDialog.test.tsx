import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    cancelTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    listTasks: vi.fn().mockResolvedValue([]),
    gitWorktreeRemove: vi.fn().mockResolvedValue(undefined),
    gitWorktreeHasChanges: vi.fn().mockResolvedValue(false),
  },
}))
vi.mock('@/lib/history-store', () => ({
  loadThreads: vi.fn().mockResolvedValue([]),
  loadProjects: vi.fn().mockResolvedValue([]),
  loadSoftDeleted: vi.fn().mockResolvedValue([]),
  saveThreads: vi.fn().mockResolvedValue(undefined),
  saveSoftDeleted: vi.fn().mockResolvedValue(undefined),
  toArchivedTasks: vi.fn().mockReturnValue([]),
  clearHistory: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/stores/debugStore', () => ({
  useDebugStore: { getState: () => ({ addEntry: vi.fn() }) },
}))
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: {}, saveSettings: vi.fn().mockResolvedValue(undefined) }), setState: vi.fn() },
}))
vi.mock('@/stores/diffStore', () => ({
  useDiffStore: { getState: () => ({ fetchDiff: vi.fn() }) },
}))
vi.mock('@/stores/kiroStore', () => ({
  useKiroStore: { getState: () => ({ setMcpError: vi.fn() }) },
}))

import { WorktreeCleanupDialog } from './WorktreeCleanupDialog'

beforeEach(() => {
  useTaskStore.setState({
    tasks: {},
    projects: [],
    deletedTaskIds: new Set(),
    softDeleted: {},
    selectedTaskId: null,
    streamingChunks: {},
    thinkingChunks: {},
    liveToolCalls: {},
    queuedMessages: {},
    activityFeed: [],
    connected: false,
    terminalOpenTasks: new Set(),
    pendingWorkspace: null,
    view: 'dashboard',
    isNewProjectOpen: false,
    isSettingsOpen: false,
    projectNames: {},
    worktreeCleanupPending: null,
  })
})

describe('WorktreeCleanupDialog', () => {
  it('does not render when worktreeCleanupPending is null', () => {
    render(<WorktreeCleanupDialog />)
    expect(screen.queryByText('Worktree has uncommitted changes')).not.toBeInTheDocument()
  })

  it('renders dialog when worktreeCleanupPending is set', () => {
    useTaskStore.setState({
      worktreeCleanupPending: {
        taskId: 'task-1',
        worktreePath: '/project/.kiro/worktrees/my-feature',
        originalWorkspace: '/project',
        action: 'delete',
      },
    })
    render(<WorktreeCleanupDialog />)
    expect(screen.getByText('Worktree has uncommitted changes')).toBeInTheDocument()
    expect(screen.getByText('/project/.kiro/worktrees/my-feature')).toBeInTheDocument()
  })

  it('shows both action buttons', () => {
    useTaskStore.setState({
      worktreeCleanupPending: {
        taskId: 'task-1',
        worktreePath: '/project/.kiro/worktrees/feat',
        originalWorkspace: '/project',
        action: 'archive',
      },
    })
    render(<WorktreeCleanupDialog />)
    expect(screen.getByText('Keep worktree')).toBeInTheDocument()
    expect(screen.getByText('Remove anyway')).toBeInTheDocument()
  })

  it('calls resolveWorktreeCleanup(false) when "Keep worktree" is clicked', () => {
    useTaskStore.setState({
      worktreeCleanupPending: {
        taskId: 'task-1',
        worktreePath: '/project/.kiro/worktrees/feat',
        originalWorkspace: '/project',
        action: 'delete',
      },
    })
    render(<WorktreeCleanupDialog />)
    fireEvent.click(screen.getByText('Keep worktree'))
    expect(useTaskStore.getState().worktreeCleanupPending).toBeNull()
  })

  it('calls resolveWorktreeCleanup(true) when "Remove anyway" is clicked', async () => {
    const { ipc } = await import('@/lib/ipc')
    useTaskStore.setState({
      worktreeCleanupPending: {
        taskId: 'task-1',
        worktreePath: '/project/.kiro/worktrees/feat',
        originalWorkspace: '/project',
        action: 'delete',
      },
    })
    render(<WorktreeCleanupDialog />)
    fireEvent.click(screen.getByText('Remove anyway'))
    expect(useTaskStore.getState().worktreeCleanupPending).toBeNull()
    expect(ipc.gitWorktreeRemove).toHaveBeenCalledWith('/project', '/project/.kiro/worktrees/feat')
  })
})
