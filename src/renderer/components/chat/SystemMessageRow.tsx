import { memo, useCallback } from 'react'
import { IconGitFork, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react'
import type { SystemMessageRow as SystemMessageRowData } from '@/lib/timeline'
import { HighlightText } from './HighlightText'
import { useTaskStore } from '@/stores/taskStore'

export const SystemMessageRow = memo(function SystemMessageRow({ row }: { row: SystemMessageRowData }) {
  if (row.variant === 'fork') {
    const parentName = row.content.replace(/^Forked from:\s*/, '')
    const parentTaskId = useTaskStore((s) => {
      const taskId = s.selectedTaskId
      return taskId ? s.tasks[taskId]?.parentTaskId : undefined
    })
    return (
      <div className="pb-4" data-timeline-row-kind="system-message">
        <div className="mx-auto flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground/60">
          <IconGitFork className="size-3.5 shrink-0" aria-hidden />
          <span>Forked from {parentTaskId
            ? <ParentLink parentTaskId={parentTaskId} parentName={parentName} />
            : <span className="text-muted-foreground/80">{parentName}</span>
          }</span>
        </div>
      </div>
    )
  }

  if (row.variant === 'info') {
    return (
      <div className="pb-4" data-timeline-row-kind="system-message">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-2 text-[13px] text-blue-600 dark:text-blue-400">
          <IconInfoCircle className="size-4 shrink-0" aria-hidden />
          <span className="break-words"><HighlightText text={row.content} /></span>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-4" data-timeline-row-kind="system-message">
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-2.5 text-[15px] text-destructive/80">
        <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="break-words"><HighlightText text={row.content.replace(/^\u26a0\ufe0f\s*/, '')} /></span>
      </div>
    </div>
  )
})

const ParentLink = memo(function ParentLink({ parentTaskId, parentName }: { parentTaskId: string; parentName: string }) {
  const setSelectedTask = useTaskStore((s) => s.setSelectedTask)
  const handleClick = useCallback(() => { setSelectedTask(parentTaskId) }, [setSelectedTask, parentTaskId])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTask(parentTaskId) }
  }, [setSelectedTask, parentTaskId])
  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Go to parent thread: ${parentName}`}
      className="text-muted-foreground/80 underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50 cursor-pointer"
    >
      {parentName}
    </button>
  )
})
