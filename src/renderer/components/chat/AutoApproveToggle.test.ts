import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectAutoApprove } from './AutoApproveToggle'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    setAutoApprove: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
  },
}))

describe('selectAutoApprove', () => {
  it('returns false by default', () => {
    const state = { activeWorkspace: null, settings: { claudeBin: '', agentProfiles: [], fontSize: 13 } } as any
    expect(selectAutoApprove(state)).toBe(false)
  })

  // TASK-107: AutoApproveToggle was rebound to read permissions.mode === 'bypass'
  // (with per-project override) instead of the legacy autoApprove boolean.
  it('returns true when global permissions.mode is bypass', () => {
    const state = {
      activeWorkspace: null,
      settings: { claudeBin: '', agentProfiles: [], fontSize: 13, permissions: { mode: 'bypass', allow: [], deny: [] } },
    } as any
    expect(selectAutoApprove(state)).toBe(true)
  })

  it('returns true when project permissions.mode is bypass', () => {
    const state = {
      activeWorkspace: '/ws',
      settings: {
        claudeBin: '', agentProfiles: [], fontSize: 13,
        permissions: { mode: 'ask', allow: [], deny: [] },
        projectPrefs: { '/ws': { permissions: { mode: 'bypass', allow: [], deny: [] } } },
      },
    } as any
    expect(selectAutoApprove(state)).toBe(true)
  })

  it('falls back to global permissions when project pref has no permissions block', () => {
    const state = {
      activeWorkspace: '/ws',
      settings: {
        claudeBin: '', agentProfiles: [], fontSize: 13,
        permissions: { mode: 'bypass', allow: [], deny: [] },
        projectPrefs: { '/ws': {} },
      },
    } as any
    expect(selectAutoApprove(state)).toBe(true)
  })
})

describe('toggle calls ipc.setAutoApprove for live tasks', () => {
  let ipcMock: { setAutoApprove: ReturnType<typeof vi.fn<(taskId: string, value: boolean) => Promise<void>>> }

  beforeEach(async () => {
    vi.resetAllMocks()
    const ipcModule = await import('@/lib/ipc')
    ipcMock = ipcModule.ipc as any
    ipcMock.setAutoApprove = vi.fn().mockResolvedValue(undefined)
  })

  /** Helper: simulate the toggle logic extracted from the component callback */
  const simulateToggle = (
    settingsState: { settings: any; activeWorkspace: string | null; setProjectPref: any; saveSettings: any },
    taskState: { selectedTaskId: string | null; tasks: Record<string, any> },
  ) => {
    const { settings, activeWorkspace, setProjectPref, saveSettings } = settingsState
    const current = activeWorkspace
      ? (settings.projectPrefs?.[activeWorkspace]?.autoApprove ?? settings.autoApprove ?? false)
      : (settings.autoApprove ?? false)
    const next = !current
    if (activeWorkspace) {
      setProjectPref(activeWorkspace, { autoApprove: next })
    } else {
      saveSettings({ ...settings, autoApprove: next })
    }
    const { selectedTaskId, tasks } = taskState
    if (!selectedTaskId) return
    const task = tasks[selectedTaskId]
    if (!task) return
    const isLive = task.status === 'running' || task.status === 'pending_permission' || task.status === 'paused' || task.status === 'completed'
    if (isLive) {
      ipcMock.setAutoApprove(selectedTaskId, next)
    }
  }

  it('calls setAutoApprove for a running task', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-1', tasks: { 'task-1': { status: 'running' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-1', true)
  })

  it('calls setAutoApprove for a pending_permission task', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: true }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-2', tasks: { 'task-2': { status: 'pending_permission' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-2', false)
  })

  it('calls setAutoApprove for a paused task', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-3', tasks: { 'task-3': { status: 'paused' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-3', true)
  })

  it('calls setAutoApprove for a completed task (connection still alive)', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-4', tasks: { 'task-4': { status: 'completed' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-4', true)
  })

  it('does NOT call setAutoApprove when no task selected', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: null, tasks: {} },
    )
    expect(ipcMock.setAutoApprove).not.toHaveBeenCalled()
  })

  it('does NOT call setAutoApprove when selected task not found', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'ghost', tasks: {} },
    )
    expect(ipcMock.setAutoApprove).not.toHaveBeenCalled()
  })

  it('passes the correct next value (true when currently false)', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-5', tasks: { 'task-5': { status: 'running' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-5', true)
  })

  it('passes the correct next value (false when currently true)', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: true }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-6', tasks: { 'task-6': { status: 'running' } } },
    )
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-6', false)
  })

  it('uses project pref over global when workspace active', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      {
        settings: { autoApprove: false, projectPrefs: { '/ws': { autoApprove: true } } },
        activeWorkspace: '/ws',
        setProjectPref,
        saveSettings,
      },
      { selectedTaskId: 'task-7', tasks: { 'task-7': { status: 'running' } } },
    )
    // Project pref is true, so next = false
    expect(ipcMock.setAutoApprove).toHaveBeenCalledWith('task-7', false)
    expect(setProjectPref).toHaveBeenCalledWith('/ws', { autoApprove: false })
  })

  it('does NOT call setAutoApprove for cancelled task', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-8', tasks: { 'task-8': { status: 'cancelled' } } },
    )
    expect(ipcMock.setAutoApprove).not.toHaveBeenCalled()
  })

  it('does NOT call setAutoApprove for error task', () => {
    const setProjectPref = vi.fn()
    const saveSettings = vi.fn()
    simulateToggle(
      { settings: { autoApprove: false }, activeWorkspace: null, setProjectPref, saveSettings },
      { selectedTaskId: 'task-9', tasks: { 'task-9': { status: 'error' } } },
    )
    expect(ipcMock.setAutoApprove).not.toHaveBeenCalled()
  })
})
