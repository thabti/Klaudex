import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AnalyticsEvent } from '@/lib/ipc'

/**
 * Tests for `useSessionTracker` (TASK-048, wave 4).
 *
 * SUT: src/renderer/hooks/useSessionTracker.ts
 *
 * The SUT:
 *   - Calls `useAnalyticsStore.getState().recordEvent(...)` for six event kinds.
 *   - Subscribes to `useTaskStore` for task_created / message_sent.
 *   - Subscribes to `useSettingsStore` for mode_switched.
 *   - Wraps every recordEvent in try/catch so an uninitialised analyticsStore
 *     drops events silently rather than crashing the App tree.
 *   - Exports a `recordSlashCommand(name, taskId?)` helper.
 *
 * The three stores are mocked so the hook can run in jsdom without pulling
 * in the real ipc/history-store/debug-logger graph.
 */

// ── Mock state held in module scope so tests can drive subscribers. ─

const recordEventMock = vi.fn<(e: AnalyticsEvent) => void>()
const flushBufferMock = vi.fn<() => Promise<void>>(async () => {})

interface MockTaskStoreState {
  tasks: Record<string, { messages: { role: string; content: string; timestamp: string }[]; workspace: string; originalWorkspace?: string }>
}
interface MockSettingsStoreState {
  activeWorkspace: string | null
  currentModeId: string | null
}

let taskState: MockTaskStoreState = { tasks: {} }
let settingsState: MockSettingsStoreState = { activeWorkspace: null, currentModeId: null }
const taskListeners = new Set<(s: MockTaskStoreState, p: MockTaskStoreState) => void>()
const settingsListeners = new Set<(s: MockSettingsStoreState, p: MockSettingsStoreState) => void>()

const setTaskState = (next: MockTaskStoreState): void => {
  const prev = taskState
  taskState = next
  taskListeners.forEach((l) => l(taskState, prev))
}
const setSettingsState = (next: MockSettingsStoreState): void => {
  const prev = settingsState
  settingsState = next
  settingsListeners.forEach((l) => l(settingsState, prev))
}

vi.mock('@/stores/analyticsStore', () => ({
  useAnalyticsStore: {
    getState: () => ({
      recordEvent: recordEventMock,
      flushBuffer: flushBufferMock,
    }),
  },
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: {
    getState: () => taskState,
    subscribe: (listener: (s: MockTaskStoreState, p: MockTaskStoreState) => void) => {
      taskListeners.add(listener)
      return () => taskListeners.delete(listener)
    },
  },
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => settingsState,
    subscribe: (listener: (s: MockSettingsStoreState, p: MockSettingsStoreState) => void) => {
      settingsListeners.add(listener)
      return () => settingsListeners.delete(listener)
    },
  },
}))

// Imported AFTER mocks so the mocked store modules are wired in.
import { useSessionTracker, recordSlashCommand } from './useSessionTracker'

const lastCallOfKind = (kind: string): AnalyticsEvent | undefined => {
  for (let i = recordEventMock.mock.calls.length - 1; i >= 0; i--) {
    const ev = recordEventMock.mock.calls[i]?.[0]
    if (ev && ev.kind === kind) return ev
  }
  return undefined
}

describe('useSessionTracker', () => {
  beforeEach(() => {
    recordEventMock.mockClear()
    flushBufferMock.mockClear()
    taskListeners.clear()
    settingsListeners.clear()
    taskState = { tasks: {} }
    settingsState = { activeWorkspace: null, currentModeId: null }
  })

  it('records session_start on mount', () => {
    settingsState = { activeWorkspace: '/Users/me/projects/klaudex', currentModeId: 'default' }
    renderHook(() => useSessionTracker())

    const ev = lastCallOfKind('session_start')
    expect(ev).toBeDefined()
    expect(ev?.kind).toBe('session_start')
    expect(ev?.project).toBe('klaudex')
    expect(typeof ev?.ts).toBe('number')
  })

  it('records session_end on unmount with a non-negative duration value', () => {
    const { unmount } = renderHook(() => useSessionTracker())
    recordEventMock.mockClear()
    unmount()

    const ev = lastCallOfKind('session_end')
    expect(ev).toBeDefined()
    expect(ev?.kind).toBe('session_end')
    expect(typeof ev?.value).toBe('number')
    expect((ev?.value ?? -1) >= 0).toBe(true)
  })

  it('records task_created when a new task appears in taskStore', () => {
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    act(() => {
      setTaskState({
        tasks: {
          'task-new': { messages: [], workspace: '/Users/me/foo' },
        },
      })
    })

    const ev = lastCallOfKind('task_created')
    expect(ev).toBeDefined()
    expect(ev?.thread).toBe('task-new')
    expect(ev?.project).toBe('foo')
  })

  it('does NOT re-fire task_created for tasks present at mount (seed)', () => {
    // Seed before the hook mounts.
    taskState = {
      tasks: {
        'pre-existing': { messages: [], workspace: '/x' },
      },
    }
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    // Re-emit the same state — no task_created should fire.
    act(() => {
      setTaskState({
        tasks: {
          'pre-existing': { messages: [], workspace: '/x' },
        },
      })
    })
    expect(lastCallOfKind('task_created')).toBeUndefined()
  })

  it('records message_sent when a new user message is appended', () => {
    taskState = {
      tasks: {
        't1': { messages: [], workspace: '/Users/me/foo' },
      },
    }
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    act(() => {
      setTaskState({
        tasks: {
          't1': {
            workspace: '/Users/me/foo',
            messages: [{ role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:00Z' }],
          },
        },
      })
    })

    const ev = lastCallOfKind('message_sent')
    expect(ev).toBeDefined()
    expect(ev?.thread).toBe('t1')
    expect(ev?.project).toBe('foo')
  })

  it('does NOT record message_sent for assistant messages', () => {
    taskState = {
      tasks: { 't1': { messages: [], workspace: '/x' } },
    }
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    act(() => {
      setTaskState({
        tasks: {
          't1': {
            workspace: '/x',
            messages: [{ role: 'assistant', content: 'hi', timestamp: '2026-01-01T00:00:00Z' }],
          },
        },
      })
    })
    expect(lastCallOfKind('message_sent')).toBeUndefined()
  })

  it('records mode_switched when currentModeId changes (after the seed transition)', () => {
    settingsState = { activeWorkspace: '/Users/me/foo', currentModeId: 'default' }
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    act(() => {
      setSettingsState({ activeWorkspace: '/Users/me/foo', currentModeId: 'plan' })
    })

    const ev = lastCallOfKind('mode_switched')
    expect(ev).toBeDefined()
    expect(ev?.detail).toBe('plan')
    expect(ev?.project).toBe('foo')
  })

  it('does not double-fire mode_switched when the mode value is unchanged', () => {
    settingsState = { activeWorkspace: '/x', currentModeId: 'default' }
    renderHook(() => useSessionTracker())
    recordEventMock.mockClear()

    act(() => {
      setSettingsState({ activeWorkspace: '/x', currentModeId: 'default' })
    })
    expect(lastCallOfKind('mode_switched')).toBeUndefined()
  })

  it('silently swallows recordEvent failures (does not crash mount)', () => {
    recordEventMock.mockImplementationOnce(() => {
      throw new Error('analyticsStore not initialised')
    })

    expect(() => renderHook(() => useSessionTracker())).not.toThrow()
  })

  it('exports recordSlashCommand which records a slash_command_used event', () => {
    settingsState = { activeWorkspace: '/Users/me/foo', currentModeId: 'default' }
    recordEventMock.mockClear()

    recordSlashCommand('/clear', 'task-7')

    const ev = lastCallOfKind('slash_command_used')
    expect(ev).toBeDefined()
    expect(ev?.kind).toBe('slash_command_used')
    expect(ev?.detail).toBe('/clear')
    expect(ev?.thread).toBe('task-7')
    expect(ev?.project).toBe('foo')
  })

  it('recordSlashCommand swallows recordEvent failures', () => {
    recordEventMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => recordSlashCommand('/help')).not.toThrow()
  })
})
