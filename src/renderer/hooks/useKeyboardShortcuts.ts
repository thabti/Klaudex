import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTaskStore } from '@/stores/taskStore'
import { useDiffStore } from '@/stores/diffStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ipc } from '@/lib/ipc'
import type { AppSettings } from '@/types'

// ── TASK-107: Cmd+Shift+Y permission-mode toggle ────────────
// Local mirror of the Rust enum until the shared types in
// `types/index.ts` declare a `permissions` field.
type PermissionMode = 'ask' | 'allowListed' | 'bypass'
interface Permissions {
  mode: PermissionMode
  allow: string[]
  deny: string[]
}
type SettingsWithPermissions = AppSettings & { permissions?: Permissions }
type ProjectPrefsWithPermissions = { permissions?: Permissions } & Record<string, unknown>

const DEFAULT_PERMISSIONS: Permissions = { mode: 'ask', allow: [], deny: [] }

/** Toggle between Ask ↔ Bypass at the active scope (project override
 *  takes precedence over the global policy). Skips AllowListed because
 *  the Cmd+Shift+Y / `/yolo` shortcut models a binary "safe / yolo"
 *  mental model — three-way cycling lives on the chip click. */
const toggleYoloMode = async (): Promise<void> => {
  const { settings, activeWorkspace, setProjectPref, saveSettings } =
    useSettingsStore.getState()
  const settingsWithPerms = settings as SettingsWithPermissions
  const globalPerms = settingsWithPerms.permissions ?? DEFAULT_PERMISSIONS
  const projectPerms = activeWorkspace
    ? (settings.projectPrefs?.[activeWorkspace] as ProjectPrefsWithPermissions | undefined)?.permissions
    : undefined
  const currentScope: Permissions = projectPerms ?? globalPerms
  const previousMode: PermissionMode = currentScope.mode ?? 'ask'
  const nextMode: PermissionMode = previousMode === 'bypass' ? 'ask' : 'bypass'
  const nextScope: Permissions = { ...currentScope, mode: nextMode }

  try {
    if (activeWorkspace) {
      setProjectPref(
        activeWorkspace,
        { permissions: nextScope } as unknown as Parameters<typeof setProjectPref>[1],
      )
    } else {
      const nextSettings: SettingsWithPermissions = {
        ...settingsWithPerms,
        permissions: nextScope,
      }
      await saveSettings(nextSettings as AppSettings)
    }
  } catch (err) {
    console.warn('[permissions] save failed, reverting', err)
    toast.error('Failed to update permission mode')
    if (activeWorkspace) {
      setProjectPref(
        activeWorkspace,
        { permissions: { ...currentScope, mode: previousMode } } as unknown as Parameters<typeof setProjectPref>[1],
      )
    }
  }
}

/**
 * Returns a flat, ordered list of all thread IDs across all projects.
 * Ordered by: project order, then most-recent-first within each project.
 */
function getOrderedThreadIds(): string[] {
  const { tasks, projects } = useTaskStore.getState()
  const ids: string[] = []
  const seen = new Set<string>()

  // Group by workspace in project order
  for (const ws of projects) {
    const wsTasks = Object.values(tasks)
      .filter((t) => t.workspace === ws)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    for (const t of wsTasks) {
      ids.push(t.id)
      seen.add(t.id)
    }
  }

  // Catch any orphaned tasks
  for (const t of Object.values(tasks)) {
    if (!seen.has(t.id)) ids.push(t.id)
  }

  return ids
}

/**
 * Global keyboard shortcuts for Klaudex.
 * Attach once in App.tsx.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ── Escape → Stop running agent (skip when terminal has focus) ──
      if (e.key === 'Escape') {
        const isTerminalFocused = !!(e.target as HTMLElement)?.closest('[data-testid="terminal-drawer"]')
        if (isTerminalFocused) return
        const state = useTaskStore.getState()
        const id = state.selectedTaskId
        const task = id ? state.tasks[id] : null
        if (task?.status === 'running') {
          e.preventDefault()
          ipc.pauseTask(task.id)
          state.clearTurn(task.id)
          return
        }
      }

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Ignore when typing in inputs (except our textarea which handles its own keys)
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT') return

      const key = e.key.toLowerCase()

      // ── Cmd+, → Open settings ──────────────────────────────
      if (key === ',' && !e.shiftKey) {
        e.preventDefault()
        useTaskStore.getState().setSettingsOpen(true)
        return
      }

      // ── Cmd+J → Toggle terminal ────────────────────────────
      if (key === 'j' && !e.shiftKey) {
        e.preventDefault()
        const tid = useTaskStore.getState().selectedTaskId; if (tid) useTaskStore.getState().toggleTerminal(tid)
        return
      }

      // ── Cmd+B → Toggle btw (tangent) mode ──────────────────
      if (key === 'b' && !e.shiftKey) {
        e.preventDefault()
        const state = useTaskStore.getState()
        if (state.btwCheckpoint) {
          state.exitBtwMode(false)
        } else {
          // Focus chat input with /btw prefilled
          document.dispatchEvent(new CustomEvent('btw-shortcut'))
        }
        return
      }

      // ── Cmd+D → Toggle diff ────────────────────────────────
      if (key === 'd' && !e.shiftKey) {
        e.preventDefault()
        useDiffStore.getState().toggleOpen()
        return
      }

      // ── Cmd+W → Close thread/project ──────────────────────────
      if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        const state = useTaskStore.getState()
        const taskId = state.selectedTaskId
        if (taskId) {
          void ipc.cancelTask(taskId).catch(() => {})
          state.removeTask(taskId)
          void ipc.deleteTask(taskId)
        } else if (state.pendingWorkspace) {
          state.setPendingWorkspace(null)
        }
        return
      }

      // ── Cmd+Shift+Y → Toggle Ask ↔ Bypass (YOLO) ──────────
      if (e.shiftKey && key === 'y') {
        e.preventDefault()
        void toggleYoloMode()
        return
      }

      // ── Cmd+Shift+[ → Previous thread ──────────────────────
      if (e.shiftKey && (key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault()
        const ids = getOrderedThreadIds()
        const current = useTaskStore.getState().selectedTaskId
        const idx = current ? ids.indexOf(current) : -1
        const prev = idx > 0 ? ids[idx - 1] : ids[ids.length - 1]
        if (prev) useTaskStore.getState().setSelectedTask(prev)
        return
      }

      // ── Cmd+Shift+] → Next thread ─────────────────────────
      if (e.shiftKey && (key === ']' || e.code === 'BracketRight')) {
        e.preventDefault()
        const ids = getOrderedThreadIds()
        const current = useTaskStore.getState().selectedTaskId
        const idx = current ? ids.indexOf(current) : -1
        const next = idx < ids.length - 1 ? ids[idx + 1] : ids[0]
        if (next) useTaskStore.getState().setSelectedTask(next)
        return
      }

      // ── Cmd+1 through Cmd+9 → Jump to thread ──────────────
      if (!e.shiftKey && key >= '1' && key <= '9') {
        e.preventDefault()
        const ids = getOrderedThreadIds()
        const jumpIdx = parseInt(key, 10) - 1
        if (jumpIdx < ids.length) {
          useTaskStore.getState().setSelectedTask(ids[jumpIdx])
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
