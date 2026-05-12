import { useDebugStore } from '@/stores/debugStore'
import { useTaskStore } from '@/stores/taskStore'
import type { DebugLogEntry } from '@/types'

/** Resolve the active task ID for context tagging. */
const getActiveTaskId = (): string | null =>
  useTaskStore.getState().selectedTaskId ?? null

/** Create a base entry with defaults filled in. */
const createEntry = (
  overrides: Partial<DebugLogEntry> & Pick<DebugLogEntry, 'category' | 'type' | 'summary'>,
): DebugLogEntry => ({
  id: Date.now() + Math.random(),
  timestamp: new Date().toISOString(),
  direction: 'out',
  taskId: getActiveTaskId(),
  payload: null,
  isError: false,
  ...overrides,
})

/** Log an outgoing IPC invoke call. */
export const logIpc = (command: string, params?: unknown): void => {
  useDebugStore.getState().addEntry(createEntry({
    category: 'ipc',
    direction: 'out',
    type: command,
    summary: `invoke ${command}`,
    payload: params ?? null,
  }))
}

/** Log a successful IPC response. */
export const logIpcResult = (command: string, result: unknown, durationMs: number): void => {
  const summary = typeof result === 'object' && result !== null
    ? `${command} → OK (${durationMs}ms)`
    : `${command} → ${String(result).slice(0, 80)} (${durationMs}ms)`
  useDebugStore.getState().addEntry(createEntry({
    category: 'ipc',
    direction: 'in',
    type: `${command}:result`,
    summary,
    payload: result,
  }))
}

/** Log an IPC error. */
export const logIpcError = (command: string, err: unknown, durationMs: number): void => {
  const message = err instanceof Error ? err.message : String(err)
  useDebugStore.getState().addEntry(createEntry({
    category: 'ipc',
    direction: 'in',
    type: `${command}:error`,
    summary: `${command} → FAILED: ${message.slice(0, 120)} (${durationMs}ms)`,
    payload: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    isError: true,
  }))
}

/** Log an incoming Tauri event. */
export const logEvent = (
  eventName: string,
  payload: unknown,
  taskId?: string | null,
): void => {
  useDebugStore.getState().addEntry(createEntry({
    category: 'event',
    direction: 'in',
    type: eventName,
    summary: `event: ${eventName}`,
    payload,
    taskId: taskId ?? getActiveTaskId(),
  }))
}

/** Log a store action (state change). */
export const logStoreAction = (
  storeName: string,
  action: string,
  payload?: unknown,
): void => {
  useDebugStore.getState().addEntry(createEntry({
    category: 'store',
    direction: 'out',
    type: `${storeName}.${action}`,
    summary: `${storeName}: ${action}`,
    payload: payload ?? null,
  }))
}

/** Log a git operation. */
export const logGit = (
  operation: string,
  payload?: unknown,
): void => {
  useDebugStore.getState().addEntry(createEntry({
    category: 'git',
    direction: 'out',
    type: operation,
    summary: `git: ${operation}`,
    payload: payload ?? null,
  }))
}

/** Log a PTY operation. */
export const logPty = (
  operation: string,
  payload?: unknown,
): void => {
  useDebugStore.getState().addEntry(createEntry({
    category: 'pty',
    direction: 'out',
    type: operation,
    summary: `pty: ${operation}`,
    payload: payload ?? null,
  }))
}

/** Log an error from any source. */
export const logError = (
  source: string,
  err: unknown,
  context?: Record<string, unknown>,
): void => {
  const message = err instanceof Error ? err.message : String(err)
  useDebugStore.getState().addEntry(createEntry({
    category: 'error',
    direction: 'in',
    type: `${source}:error`,
    summary: `${source}: ${message.slice(0, 120)}`,
    payload: {
      message,
      ...(err instanceof Error ? { stack: err.stack } : {}),
      ...context,
    },
    isError: true,
  }))
}
