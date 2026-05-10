import { memo, useCallback } from 'react'
import { IconShieldCheck, IconShieldOff } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AppSettings } from '@/types'

// ── Local mirror of the Rust types in commands/settings.rs ─────────────
// `types/index.ts` is out of TASK-107 scope; we re-declare the shape here
// so the renderer can read/write `permissions.mode` until the shared types
// are updated. The backend serializes camelCase variants.
type PermissionMode = 'ask' | 'allowListed' | 'bypass'
interface Permissions {
  mode: PermissionMode
  allow: string[]
  deny: string[]
}
type SettingsWithPermissions = AppSettings & { permissions?: Permissions }
type ProjectPrefsWithPermissions = { permissions?: Permissions } & Record<string, unknown>

const DEFAULT_PERMISSIONS: Permissions = { mode: 'ask', allow: [], deny: [] }

/**
 * Resolve the effective permission mode for the current workspace, with
 * per-project override taking precedence over the global policy.
 *
 * After TASK-107 nothing reads/writes the legacy `settings.autoApprove`
 * boolean — it's left in `AppSettings` for backward-compat persistence on
 * the Rust side and migrated into `permissions` on first load.
 */
export const selectPermissionMode = (
  s: ReturnType<typeof useSettingsStore.getState>,
): PermissionMode => {
  const settings = s.settings as SettingsWithPermissions
  const ws = s.activeWorkspace
  const projectPerms = ws
    ? (s.settings.projectPrefs?.[ws] as ProjectPrefsWithPermissions | undefined)?.permissions
    : undefined
  if (projectPerms?.mode) return projectPerms.mode
  return settings.permissions?.mode ?? 'ask'
}

/** Backward-compatible selector retained for any consumer that still asks
 *  the binary "is auto-approve on?" question. Maps `bypass` → true,
 *  everything else → false. */
export const selectAutoApprove = (
  s: ReturnType<typeof useSettingsStore.getState>,
): boolean => selectPermissionMode(s) === 'bypass'

/**
 * Compact toggle that flips the active scope between `ask` and `bypass`.
 * Three-way cycling lives in the AppHeader chip; this widget keeps a
 * binary mental model for the chat toolbar.
 */
export const AutoApproveToggle = memo(function AutoApproveToggle() {
  const mode = useSettingsStore(selectPermissionMode)
  const active = mode === 'bypass'

  const toggle = useCallback(() => {
    const { settings, activeWorkspace, setProjectPref, saveSettings } = useSettingsStore.getState()
    const settingsWithPerms = settings as SettingsWithPermissions
    const globalPerms = settingsWithPerms.permissions ?? DEFAULT_PERMISSIONS
    const projectPerms = activeWorkspace
      ? (settings.projectPrefs?.[activeWorkspace] as ProjectPrefsWithPermissions | undefined)?.permissions
      : undefined
    const currentScope: Permissions = projectPerms ?? globalPerms
    const currentMode: PermissionMode = currentScope.mode ?? 'ask'
    const nextMode: PermissionMode = currentMode === 'bypass' ? 'ask' : 'bypass'
    const nextScope: Permissions = { ...currentScope, mode: nextMode }

    if (activeWorkspace) {
      setProjectPref(activeWorkspace, { permissions: nextScope } as unknown as Parameters<typeof setProjectPref>[1])
    } else {
      const nextSettings: SettingsWithPermissions = { ...settingsWithPerms, permissions: nextScope }
      saveSettings(nextSettings as AppSettings).catch(() => {
        console.warn('[autoApprove] failed to persist permission mode')
      })
    }

    // Push the change to any running ACP connection so it takes effect immediately.
    const { selectedTaskId, tasks } = useTaskStore.getState()
    if (!selectedTaskId) return
    const task = tasks[selectedTaskId]
    if (!task) return
    const isLive = task.status === 'running' || task.status === 'pending_permission' || task.status === 'paused' || task.status === 'completed'
    if (isLive) {
      ipc.setAutoApprove(selectedTaskId, nextMode === 'bypass').catch(() => {})
    }
  }, [])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggle}
          data-testid="auto-approve-toggle"
          className={cn(
            'flex items-center gap-1 rounded-lg px-1.5 py-1 text-[14px] font-medium transition-colors',
            active
              ? 'text-foreground/70 hover:text-foreground'
              : 'text-muted-foreground/80 hover:text-muted-foreground',
          )}
        >
          {active ? <IconShieldCheck className="size-3.5" /> : <IconShieldOff className="size-3.5" />}
          <span>{active ? 'Full' : 'Ask'}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{active ? 'Bypassing permissions — click to require confirmation' : 'Ask before running tools — click to bypass permissions'}</TooltipContent>
    </Tooltip>
  )
})
