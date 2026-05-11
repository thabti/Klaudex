import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { IconChevronDown, IconHandStop, IconMessageQuestion } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AppSettings } from '@/types'

// ── Local mirror of the Rust types in commands/settings.rs ─────────────
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

/** Backward-compatible selector: maps `bypass` → true, else → false. */
export const selectAutoApprove = (
  s: ReturnType<typeof useSettingsStore.getState>,
): boolean => selectPermissionMode(s) === 'bypass'

interface PermissionEntry {
  readonly id: 'auto-approve' | 'ask-first'
  readonly mode: PermissionMode
  readonly label: string
  readonly description: string
  readonly icon: typeof IconHandStop
}

const PERMISSIONS: readonly PermissionEntry[] = [
  { id: 'ask-first', mode: 'ask', label: 'Ask first', description: 'Confirm before running tools', icon: IconMessageQuestion },
  { id: 'auto-approve', mode: 'bypass', label: 'Auto-approve', description: 'Run all tools without asking', icon: IconHandStop },
] as const

export const AutoApproveToggle = memo(function AutoApproveToggle() {
  const mode = useSettingsStore(selectPermissionMode)
  const isAutoApprove = mode === 'bypass'
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = useCallback((permissionId: string) => {
    const nextMode: PermissionMode = permissionId === 'auto-approve' ? 'bypass' : 'ask'
    const { settings, activeWorkspace, setProjectPref, saveSettings } = useSettingsStore.getState()
    const settingsWithPerms = settings as SettingsWithPermissions
    const globalPerms = settingsWithPerms.permissions ?? DEFAULT_PERMISSIONS
    const projectPerms = activeWorkspace
      ? (settings.projectPrefs?.[activeWorkspace] as ProjectPrefsWithPermissions | undefined)?.permissions
      : undefined
    const currentScope: Permissions = projectPerms ?? globalPerms
    if (currentScope.mode === nextMode) {
      setIsOpen(false)
      return
    }
    const nextScope: Permissions = { ...currentScope, mode: nextMode }
    if (activeWorkspace) {
      setProjectPref(activeWorkspace, { permissions: nextScope } as unknown as Parameters<typeof setProjectPref>[1])
    } else {
      const nextSettings: SettingsWithPermissions = { ...settingsWithPerms, permissions: nextScope }
      saveSettings(nextSettings as AppSettings).catch(() => {
        console.warn('[autoApprove] failed to persist permission mode')
      })
    }
    const { selectedTaskId, tasks } = useTaskStore.getState()
    if (selectedTaskId) {
      const task = tasks[selectedTaskId]
      const isLive = task && (task.status === 'running' || task.status === 'pending_permission' || task.status === 'paused' || task.status === 'completed')
      if (isLive) {
        ipc.setAutoApprove(selectedTaskId, nextMode === 'bypass').catch(() => {})
      }
    }
    setIsOpen(false)
  }, [])

  const currentId = isAutoApprove ? 'auto-approve' : 'ask-first'
  const current = PERMISSIONS.find((p) => p.id === currentId) ?? PERMISSIONS[0]
  const CurrentIcon = current.icon

  return (
    <div ref={ref} data-testid="auto-approve-toggle" className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Permissions: ${current.label}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'flex items-center gap-1 rounded-lg px-1.5 py-1 text-[14px] font-medium transition-colors',
          isAutoApprove
            ? 'text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <CurrentIcon className="size-3.5" aria-hidden />
        <span>{current.label}</span>
        <IconChevronDown className="size-3 shrink-0 opacity-50" aria-hidden />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select permissions"
          className="absolute bottom-full left-0 z-[200] mb-2 min-w-[180px] rounded-xl border border-border bg-popover py-1.5 shadow-xl"
        >
          {PERMISSIONS.map((p) => {
            const isActive = p.id === currentId
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleSelect(p.id)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-accent',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                  p.id === 'auto-approve' && isActive && 'text-amber-600 dark:text-amber-400',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <div className="flex flex-col items-start">
                  <span>{p.label}</span>
                  <span className="text-[10px] text-muted-foreground/70">{p.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
