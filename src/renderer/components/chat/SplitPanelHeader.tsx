import { memo, useCallback } from 'react'
import { IconX } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useProjectIcon } from '@/hooks/useProjectIcon'
import { ProjectIcon } from '@/components/sidebar/ProjectIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SplitPanelHeaderProps {
  readonly taskId: string
  readonly isFocused: boolean
  readonly onClose: () => void
  readonly onFocus: () => void
}

export const SplitPanelHeader = memo(function SplitPanelHeader({
  taskId,
  isFocused,
  onClose,
  onFocus,
}: SplitPanelHeaderProps) {
  const taskName = useTaskStore((s) => s.tasks[taskId]?.name ?? 'Thread')
  const workspace = useTaskStore((s) => {
    const t = s.tasks[taskId]
    return t ? (t.originalWorkspace ?? t.workspace) : null
  })
  const projectName = useTaskStore((s) => {
    const t = s.tasks[taskId]
    const ws = t ? (t.originalWorkspace ?? t.workspace) : null
    if (!ws) return ''
    return s.projectNames[ws] ?? ws.split('/').pop() ?? ''
  })
  const icon = useProjectIcon(workspace ?? '')

  const handleClick = useCallback(() => onFocus(), [onFocus])
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }, [onClose])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Focus ${taskName} panel`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      className={cn(
        'group/header relative flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-3 select-none cursor-pointer transition-colors',
        isFocused ? 'bg-background' : 'bg-card/50 hover:bg-card',
      )}
    >
      <ProjectIcon icon={icon} />
      <span className="min-w-0 max-w-[120px] truncate text-[12px] text-muted-foreground/70">
        {projectName}
      </span>
      <span className="text-[11px] text-muted-foreground/30">/</span>
      <span className={cn(
        'min-w-0 flex-1 truncate text-[12px] transition-colors',
        isFocused ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}>
        {taskName}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Close split panel"
            onClick={handleClose}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all group-hover/header:opacity-100 hover:!bg-accent hover:!text-foreground"
          >
            <IconX className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close split</TooltipContent>
      </Tooltip>
      {/* Focused accent bar */}
      {isFocused && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
      )}
    </div>
  )
})
