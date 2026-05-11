import { useEffect, useRef } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'

/**
 * Session-wide analytics tracker (port of `kirodex/src/renderer/hooks/useSessionTracker.ts`).
 *
 * Mounted ONCE at the App.tsx root (not per-component). Records six distinct
 * event kinds on the analyticsStore buffer:
 *   - `session_start`     emitted on mount
 *   - `session_end`       emitted on unmount + window beforeunload
 *   - `task_created`      emitted when a new entry appears in `useTaskStore.tasks`
 *   - `message_sent`      emitted when a user message lands in any task
 *   - `slash_command_used` emitted by callers via the exported `recordSlashCommand` helper
 *   - `mode_switched`     emitted when `useSettingsStore.currentModeId` changes
 *
 * Klaudex-specific renames vs kirodex (per CLAUDE.md):
 *   - `useKiroStore`             → `useTaskStore`
 *   - `analyticsStore.recordEvent` exists in Klaudex too — same name.
 *
 * Failure semantics: every `recordEvent` call is wrapped in try/catch so an
 * uninitialized or crashed analyticsStore drops events silently rather than
 * crashing the App tree. This matters during boot (analyticsStore may not have
 * hydrated yet) and on quota-exceeded localStorage paths.
 */

const safeRecord = (event: AnalyticsEvent): void => {
  try {
    useAnalyticsStore.getState().recordEvent(event)
  } catch {
    // analyticsStore not yet initialized or flush failed — drop silently.
  }
}

/** Best-effort short workspace name for the `project` field (basename only). */
const projectNameOf = (workspace: string | null | undefined): string | undefined => {
  if (!workspace) return undefined
  return workspace.replace(/\\/g, '/').split('/').pop() || undefined
}

/**
 * Public helper: callers (e.g. useSlashAction) emit a slash-command-used event
 * via this function rather than reaching into the analyticsStore directly.
 * Lives next to the hook so both stay in sync about the event shape.
 */
export const recordSlashCommand = (commandName: string, taskId?: string): void => {
  const ws = useSettingsStore.getState().activeWorkspace
  safeRecord({
    ts: Date.now(),
    kind: 'slash_command_used',
    project: projectNameOf(ws),
    thread: taskId,
    detail: commandName,
  })
}

export const useSessionTracker = (): void => {
  // Track which task IDs / message counts we've already reported so we only
  // emit `task_created` once per task and `message_sent` once per new user
  // message. Stored in refs (not module scope) per CLAUDE.md "Module-level
  // mutable variables in React hooks" — so a hook unmount/remount cycle
  // (e.g. HMR) starts with fresh tracking state.
  const knownTaskIdsRef = useRef<Set<string>>(new Set())
  const messageCountByTaskRef = useRef<Map<string, number>>(new Map())
  const lastModeIdRef = useRef<string | null>(null)
  const sessionStartedAtRef = useRef<number>(Date.now())
  const endedRef = useRef<boolean>(false)

  // ── session_start ────────────────────────────────────────────────
  useEffect(() => {
    const ws = useSettingsStore.getState().activeWorkspace
    sessionStartedAtRef.current = Date.now()
    safeRecord({
      ts: sessionStartedAtRef.current,
      kind: 'session_start',
      project: projectNameOf(ws),
    })

    // Seed task tracking with whatever tasks already exist so we don't fire a
    // burst of `task_created` for hydrated history on first mount.
    const initialTasks = useTaskStore.getState().tasks
    for (const id of Object.keys(initialTasks)) {
      knownTaskIdsRef.current.add(id)
      messageCountByTaskRef.current.set(id, initialTasks[id].messages.length)
    }

    // Seed mode so the first switch is detected as a real change, not a startup blip.
    lastModeIdRef.current = useSettingsStore.getState().currentModeId

    const fireSessionEnd = (): void => {
      if (endedRef.current) return
      endedRef.current = true
      const seconds = Math.max(0, Math.round((Date.now() - sessionStartedAtRef.current) / 1000))
      const ws2 = useSettingsStore.getState().activeWorkspace
      safeRecord({
        ts: Date.now(),
        kind: 'session_end',
        project: projectNameOf(ws2),
        value: seconds,
      })
      // Best-effort flush so the buffer hits disk before the page is torn down.
      try {
        void useAnalyticsStore.getState().flushBuffer()
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('beforeunload', fireSessionEnd)

    return () => {
      fireSessionEnd()
      window.removeEventListener('beforeunload', fireSessionEnd)
    }
  }, [])

  // ── task_created + message_sent (subscribe to taskStore) ────────
  useEffect(() => {
    const unsubscribe = useTaskStore.subscribe((state) => {
      // Diff tasks → fire task_created for new IDs.
      for (const [id, task] of Object.entries(state.tasks)) {
        if (!knownTaskIdsRef.current.has(id)) {
          knownTaskIdsRef.current.add(id)
          const ws = task.originalWorkspace ?? task.workspace
          safeRecord({
            ts: Date.now(),
            kind: 'task_created',
            project: projectNameOf(ws),
            thread: id,
          })
          messageCountByTaskRef.current.set(id, task.messages.length)
          continue
        }
        // Detect newly-appended user messages.
        const prevCount = messageCountByTaskRef.current.get(id) ?? 0
        if (task.messages.length > prevCount) {
          // Only fire for genuinely new user messages (skip system, assistant).
          for (let i = prevCount; i < task.messages.length; i++) {
            const msg = task.messages[i]
            if (msg.role !== 'user') continue
            const ws = task.originalWorkspace ?? task.workspace
            safeRecord({
              ts: Date.now(),
              kind: 'message_sent',
              project: projectNameOf(ws),
              thread: id,
            })
          }
          messageCountByTaskRef.current.set(id, task.messages.length)
        } else if (task.messages.length < prevCount) {
          // Compaction / undo / clear shrunk messages — keep the counter in
          // sync so the next append doesn't double-report.
          messageCountByTaskRef.current.set(id, task.messages.length)
        }
      }
      // Drop tracking for tasks that no longer exist (deleted/archived).
      for (const id of knownTaskIdsRef.current) {
        if (!(id in state.tasks)) {
          knownTaskIdsRef.current.delete(id)
          messageCountByTaskRef.current.delete(id)
        }
      }
    })
    return unsubscribe
  }, [])

  // ── mode_switched (subscribe to settingsStore) ──────────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state) => {
      const next = state.currentModeId
      if (next === lastModeIdRef.current) return
      const prev = lastModeIdRef.current
      lastModeIdRef.current = next
      // Skip the initial null→value transition that happens during hydration.
      if (prev === null) return
      const ws = state.activeWorkspace
      safeRecord({
        ts: Date.now(),
        kind: 'mode_switched',
        project: projectNameOf(ws),
        detail: next ?? 'default',
      })
    })
    return unsubscribe
  }, [])
}
