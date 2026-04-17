import { memo, useCallback } from 'react'
import { IconShieldCheck, IconShieldOff } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'

export const selectAutoApprove = (s: ReturnType<typeof useSettingsStore.getState>) => {
  const ws = s.activeWorkspace
  const projectPref = ws ? s.settings.projectPrefs?.[ws]?.autoApprove : undefined
  return projectPref !== undefined ? projectPref : (s.settings.autoApprove ?? false)
}

export const AutoApproveToggle = memo(function AutoApproveToggle() {
  const active = useSettingsStore(selectAutoApprove)

  const toggle = useCallback(() => {
    const { settings, activeWorkspace, setProjectPref, saveSettings } = useSettingsStore.getState()
    const current = activeWorkspace
      ? (settings.projectPrefs?.[activeWorkspace]?.autoApprove ?? settings.autoApprove ?? false)
      : (settings.autoApprove ?? false)
    const next = !current
    if (activeWorkspace) {
      setProjectPref(activeWorkspace, { autoApprove: next })
    } else {
      saveSettings({ ...settings, autoApprove: next })
    }
    // Push the change to any running ACP connection so it takes effect immediately
    const { selectedTaskId, tasks } = useTaskStore.getState()
    if (!selectedTaskId) return
    const task = tasks[selectedTaskId]
    if (!task) return
    const isLive = task.status === 'running' || task.status === 'pending_permission' || task.status === 'paused'
    if (isLive) {
      ipc.setAutoApprove(selectedTaskId, next).catch(() => {})
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
      <TooltipContent side="top">{active ? 'Auto-approve all tools \u2014 click to require confirmation' : 'Ask before running tools \u2014 click to auto-approve'}</TooltipContent>
    </Tooltip>
  )
})
