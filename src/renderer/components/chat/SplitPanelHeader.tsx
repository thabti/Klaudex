import { memo, useCallback } from 'react'
import { IconX } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useProjectIcon } from '@/hooks/useProjectIcon'
import { ProjectIcon } from '@/components/sidebar/ProjectIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePanelContext, type PanelKey } from './PanelContext'
import { cn } from '@/lib/utils'

/**
 * SplitPanelHeader — compact header above a chat panel in split mode.
 *
 * Shows the bound thread's project icon, project name, and thread name.
 * Clicking anywhere makes this the active panel. The close button collapses
 * the panel by clearing its bound thread (PanelContext.setPanelThread → null).
 * If no thread is bound, renders a "Select a thread" placeholder.
 */

interface SplitPanelHeaderProps {
  readonly panel: PanelKey
}

export const SplitPanelHeader = memo(function SplitPanelHeader({ panel }: SplitPanelHeaderProps) {
  const { panels, activePanel, setActivePanel, setPanelThread } = usePanelContext()
  const threadId = panels[panel].threadId
  const isFocused = activePanel === panel

  const taskName = useTaskStore((s) => (threadId ? s.tasks[threadId]?.name ?? 'Thread' : null))
  const workspace = useTaskStore((s) => {
    if (!threadId) return null
    const task = s.tasks[threadId]
    return task ? task.originalWorkspace ?? task.workspace : null
  })
  const projectName = useTaskStore((s) => {
    if (!threadId) return ''
    const task = s.tasks[threadId]
    const ws = task ? task.originalWorkspace ?? task.workspace : null
    if (!ws) return ''
    return s.projectNames[ws] ?? ws.split('/').pop() ?? ''
  })
  const icon = useProjectIcon(workspace ?? '')

  const handleFocus = useCallback(() => {
    setActivePanel(panel)
  }, [panel, setActivePanel])

  const handleClose = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    setPanelThread(panel, null)
  }, [panel, setPanelThread])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleFocus()
    }
  }, [handleFocus])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={taskName ? `Focus ${taskName} panel` : 'Empty split panel'}
      aria-pressed={isFocused}
      onClick={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/header relative flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-3 select-none cursor-pointer transition-colors',
        isFocused ? 'bg-background' : 'bg-card/50 hover:bg-card',
      )}
    >
      {threadId === null ? (
        <span className="min-w-0 flex-1 truncate pr-6 text-[12px] text-muted-foreground italic">
          Select a thread
        </span>
      ) : (
        <>
          <ProjectIcon icon={icon} />
          {projectName && (
            <>
              <span className="min-w-0 max-w-[120px] truncate text-[12px] text-muted-foreground/70">
                {projectName}
              </span>
              <span className="text-[11px] text-muted-foreground/30">/</span>
            </>
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate pr-6 text-[12px] transition-colors group-hover/header:pr-8',
              isFocused ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {taskName}
          </span>
        </>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Close split panel"
            onClick={handleClose}
            className={cn(
              'absolute right-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-accent hover:text-destructive',
              !isFocused && 'opacity-0 group-hover/header:opacity-100',
            )}
          >
            <IconX className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close split</TooltipContent>
      </Tooltip>

      {isFocused && <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
    </div>
  )
})
