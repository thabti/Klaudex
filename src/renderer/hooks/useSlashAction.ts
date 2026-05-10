import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import { ipc } from '@/lib/ipc'
import { track } from '@/lib/analytics'
import type { AppSettings } from '@/types'

// ── TASK-107: /yolo permission-mode toggle ─────────────────
// Local mirror of the Rust enum until shared types declare it.
type PermissionMode = 'ask' | 'allowListed' | 'bypass'
interface Permissions {
  mode: PermissionMode
  allow: string[]
  deny: string[]
}
type SettingsWithPermissions = AppSettings & { permissions?: Permissions }
type ProjectPrefsWithPermissions = { permissions?: Permissions } & Record<string, unknown>

const DEFAULT_PERMISSIONS: Permissions = { mode: 'ask', allow: [], deny: [] }

const toggleYoloMode = async (): Promise<PermissionMode> => {
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
    return nextMode
  } catch (err) {
    console.warn('[permissions] save failed, reverting', err)
    toast.error('Failed to update permission mode')
    if (activeWorkspace) {
      setProjectPref(
        activeWorkspace,
        { permissions: { ...currentScope, mode: previousMode } } as unknown as Parameters<typeof setProjectPref>[1],
      )
    }
    return previousMode
  }
}

export type SlashPanel = 'model' | 'agent' | 'usage' | 'stats' | 'branch' | 'worktree' | null

export interface SlashActionResult {
  panel: SlashPanel
  dismissPanel: () => void
  execute: (commandName: string) => boolean
  /** Handle full input text for commands like /btw that need arguments. Returns true if handled. */
  executeFullInput: (input: string) => boolean
}

const bare = (name: string): string => name.replace(/^\/+/, '')

/** Add a system message to the current task's chat */
const addSystemMessage = (text: string): void => {
  const { selectedTaskId, tasks, upsertTask } = useTaskStore.getState()
  if (!selectedTaskId || !tasks[selectedTaskId]) return
  const task = tasks[selectedTaskId]
  upsertTask({
    ...task,
    messages: [...task.messages, { role: 'system', content: text, timestamp: new Date().toISOString() }],
  })
}

/** Switch mode optimistically, then confirm via IPC.
 *  Works even before ACP connects (availableModes may be empty). */
const switchMode = (modeId: string, label: string): void => {
  useSettingsStore.setState({ currentModeId: modeId })
  addSystemMessage(`Switched to ${label} mode`)
  track('feature_used', { feature: 'mode_switch', detail: modeId })
  const taskId = useTaskStore.getState().selectedTaskId
  if (taskId) {
    useTaskStore.getState().setTaskMode(taskId, modeId)
    ipc.setMode(taskId, modeId).catch(() => {
      addSystemMessage(`⚠️ Failed to sync ${label} mode with backend`)
    })
    ipc.sendMessage(taskId, `/agent ${modeId}`).catch(() => {})
  }
}

export const useSlashAction = (): SlashActionResult => {
  const [panel, setPanel] = useState<SlashPanel>(null)

  const execute = useCallback((commandName: string): boolean => {
    const name = bare(commandName)
    // Track every recognized slash command. The switch below rejects unknown
    // names by returning false, so we gate the track call on that path via
    // the `default` case.
    const KNOWN = new Set(['clear', 'model', 'agent', 'settings', 'upload', 'plan', 'usage', 'stats', 'close', 'exit', 'branch', 'worktree', 'btw', 'tangent', 'fork', 'undo', 'yolo'])
    if (KNOWN.has(name)) {
      track('feature_used', { feature: 'slash_command', detail: name })
    }
    switch (name) {
      case 'clear': {
        const { selectedTaskId, tasks, clearTurn } = useTaskStore.getState()
        if (selectedTaskId && tasks[selectedTaskId]) {
          // Directly set messages to [] — bypasses upsertTask's merge logic
          useTaskStore.setState((s) => {
            const task = s.tasks[selectedTaskId]
            if (!task) return s
            return { tasks: { ...s.tasks, [selectedTaskId]: { ...task, messages: [] } } }
          })
          clearTurn(selectedTaskId)
        }
        setPanel(null)
        return true
      }
      case 'model':
        setPanel((p) => (p === 'model' ? null : 'model'))
        return true
      case 'agent':
        setPanel((p) => (p === 'agent' ? null : 'agent'))
        return true
      case 'settings':
        useTaskStore.getState().setSettingsOpen(true)
        setPanel(null)
        return true
      case 'upload':
        // Trigger the hidden file input — dispatched as a custom event picked up by ChatInput
        document.dispatchEvent(new CustomEvent('slash-upload'))
        setPanel(null)
        return true
      case 'usage':
        setPanel((p) => (p === 'usage' ? null : 'usage'))
        return true
      case 'stats':
        setPanel((p) => (p === 'stats' ? null : 'stats'))
        return true
      case 'plan': {
        const current = useSettingsStore.getState().currentModeId
        if (current === 'plan') {
          switchMode('default', 'Default')
        } else {
          switchMode('plan', 'Plan')
        }
        setPanel(null)
        return true
      }
      case 'close':
      case 'exit': {
        const { selectedTaskId, archiveTask, pendingWorkspace, setPendingWorkspace } = useTaskStore.getState()
        if (selectedTaskId) {
          archiveTask(selectedTaskId)
        } else if (pendingWorkspace) {
          setPendingWorkspace(null)
        }
        setPanel(null)
        return true
      }
      case 'branch':
        setPanel((p) => (p === 'branch' ? null : 'branch'))
        return true
      case 'worktree':
        setPanel((p) => (p === 'worktree' ? null : 'worktree'))
        return true
      case 'btw':
      case 'tangent': {
        // When selected from the picker, exit btw mode if active
        const { btwCheckpoint, exitBtwMode } = useTaskStore.getState()
        if (btwCheckpoint) {
          exitBtwMode(false)
          setPanel(null)
          return true
        }
        // Not in btw mode — return false so the picker inserts "/btw " for the user to type a question
        setPanel(null)
        return false
      }
      case 'fork': {
        const { selectedTaskId, forkTask } = useTaskStore.getState()
        if (selectedTaskId) void forkTask(selectedTaskId)
        setPanel(null)
        return true
      }
      case 'yolo': {
        // Toggle Ask ↔ Bypass (same scope rules as the AppHeader chip and
        // Cmd+Shift+Y). Posts a system message so the chat surfaces the
        // mode change inline.
        void toggleYoloMode().then((newMode) => {
          addSystemMessage(
            newMode === 'bypass'
              ? '⚠️ YOLO mode enabled — all tool calls auto-approved'
              : 'YOLO mode disabled — permission prompts re-enabled',
          )
        })
        setPanel(null)
        return true
      }
      case 'undo': {
        const { selectedTaskId, tasks } = useTaskStore.getState()
        if (!selectedTaskId) return true
        const task = tasks[selectedTaskId]
        if (!task || task.status === 'running') {
          addSystemMessage('⚠️ Cannot undo while the agent is running')
          return true
        }
        ipc.rollbackTask(selectedTaskId, 1).then(() => {
          addSystemMessage('↩️ Rolled back the last turn')
          // Remove the last assistant+user message pair from local state
          const current = useTaskStore.getState().tasks[selectedTaskId]
          if (!current) return
          const msgs = [...current.messages]
          // Remove trailing assistant message
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
          // Remove trailing user message
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user') msgs.pop()
          useTaskStore.getState().upsertTask({ ...current, messages: msgs })
        }).catch(() => {
          addSystemMessage('⚠️ Failed to roll back')
        })
        setPanel(null)
        return true
      }
      default:
        setPanel(null)
        return false
    }
  }, [])

  const executeFullInput = useCallback((input: string): boolean => {
    const trimmed = input.trim()
    // Match /btw or /tangent at the start
    const match = trimmed.match(/^\/(?:btw|tangent)\b(.*)$/i)
    if (!match) return false
    const arg = match[1].trim()
    const { selectedTaskId, btwCheckpoint, exitBtwMode, enterBtwMode } = useTaskStore.getState()
    track('feature_used', { feature: 'slash_command', detail: 'btw' })
    // If already in btw mode, exit
    if (btwCheckpoint) {
      const keepTail = arg.toLowerCase() === 'tail'
      exitBtwMode(keepTail)
      return true
    }
    // Enter btw mode with a question
    if (!arg) return true // no question = no-op
    if (selectedTaskId) enterBtwMode(selectedTaskId, arg)
    // Return false so the caller sends the question as a message (PendingChat handles btw entry after task creation)
    return false
  }, [])

  const dismissPanel = useCallback(() => setPanel(null), [])

  return { panel, dismissPanel, execute, executeFullInput }
}
