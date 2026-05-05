/**
 * Optimized store selectors for the task store.
 *
 * These selectors provide fine-grained access to store data, preventing
 * unnecessary re-renders by selecting only the fields a component needs.
 *
 * Inspired by T3 Code's normalized store pattern where sidebar data,
 * session state, and message content are separate concerns that don't
 * trigger each other's re-renders.
 */

import type { TaskStore } from './task-store-types'
import type { AgentTask } from '@/types'

// ── Sidebar-optimized selectors ───────────────────────────────────

/**
 * Metadata-only view of a task for sidebar rendering.
 * Excludes messages, streaming state, and tool calls.
 */
export interface TaskShellData {
  readonly id: string
  readonly name: string
  readonly status: AgentTask['status']
  readonly workspace: string
  readonly createdAt: string
  readonly isArchived?: boolean
  readonly worktreePath?: string
  readonly originalWorkspace?: string
  readonly projectId?: string
}

/**
 * Select only the task shell (metadata) for a given task ID.
 * This selector is stable when only messages/streaming change.
 */
export function selectTaskShell(state: TaskStore, taskId: string): TaskShellData | null {
  const task = state.tasks[taskId]
  if (!task) return null
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    workspace: task.workspace,
    createdAt: task.createdAt,
    isArchived: task.isArchived,
    worktreePath: task.worktreePath,
    originalWorkspace: task.originalWorkspace,
    projectId: task.projectId,
  }
}

/**
 * Select the task status only. Useful for components that only need
 * to know if a task is running/paused/completed.
 */
export function selectTaskStatus(state: TaskStore, taskId: string | null): AgentTask['status'] | null {
  if (!taskId) return null
  return state.tasks[taskId]?.status ?? null
}

/**
 * Select whether a task is archived.
 */
export function selectTaskIsArchived(state: TaskStore, taskId: string | null): boolean {
  if (!taskId) return false
  return state.tasks[taskId]?.isArchived === true
}

// ── Active thread selectors ───────────────────────────────────────

/**
 * Select the message count for a task without subscribing to message content.
 */
export function selectMessageCount(state: TaskStore, taskId: string | null): number {
  if (!taskId) return 0
  return state.tasks[taskId]?.messages?.length ?? 0
}

/**
 * Select context usage for a task.
 */
export function selectContextUsage(state: TaskStore, taskId: string | null): { used: number; size: number } | null {
  if (!taskId) return null
  return state.tasks[taskId]?.contextUsage ?? null
}

/**
 * Select the pending permission for a task.
 */
export function selectPendingPermission(state: TaskStore, taskId: string | null) {
  if (!taskId) return null
  return state.tasks[taskId]?.pendingPermission ?? null
}

/**
 * Select the plan for a task.
 */
export function selectTaskPlan(state: TaskStore, taskId: string | null) {
  if (!taskId) return null
  return state.tasks[taskId]?.plan ?? null
}

/**
 * Select the workspace for a task.
 */
export function selectTaskWorkspace(state: TaskStore, taskId: string | null): string | null {
  if (!taskId) return null
  return state.tasks[taskId]?.workspace ?? null
}

/**
 * Select whether a task has a worktree.
 */
export function selectIsWorktree(state: TaskStore, taskId: string | null): boolean {
  if (!taskId) return false
  return !!state.tasks[taskId]?.worktreePath
}

// ── Streaming selectors ───────────────────────────────────────────

/**
 * Select streaming chunk for a task, respecting BTW mode.
 */
export function selectStreamingChunk(state: TaskStore, taskId: string | null): string {
  if (!taskId) return ''
  if (state.btwCheckpoint?.taskId === taskId) return ''
  return state.streamingChunks[taskId] ?? ''
}

/**
 * Select thinking chunk for a task, respecting BTW mode.
 */
export function selectThinkingChunk(state: TaskStore, taskId: string | null): string {
  if (!taskId) return ''
  if (state.btwCheckpoint?.taskId === taskId) return ''
  return state.thinkingChunks[taskId] ?? ''
}

/**
 * Select live tool calls for a task, respecting BTW mode.
 */
export function selectLiveToolCalls(state: TaskStore, taskId: string | null) {
  if (!taskId) return []
  if (state.btwCheckpoint?.taskId === taskId) return []
  return state.liveToolCalls[taskId] ?? []
}

// ── Sidebar summary selectors ─────────────────────────────────────

/**
 * Select the count of active (running) tasks across all projects.
 * Useful for showing a global activity indicator.
 */
export function selectRunningTaskCount(state: TaskStore): number {
  let count = 0
  for (const task of Object.values(state.tasks)) {
    if (task.status === 'running') count++
  }
  return count
}

/**
 * Select task IDs for a given workspace/project.
 * Returns a stable empty array when no tasks exist.
 */
const EMPTY_IDS: string[] = []
export function selectTaskIdsForWorkspace(state: TaskStore, workspace: string): string[] {
  const ids: string[] = []
  for (const task of Object.values(state.tasks)) {
    const ws = task.originalWorkspace ?? task.workspace
    if (ws === workspace) ids.push(task.id)
  }
  return ids.length > 0 ? ids : EMPTY_IDS
}
