import { useState, useEffect, useCallback } from 'react'
import { IconX, IconFileCode, IconMaximize, IconMinimize, IconGitCommit, IconLoader2 } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTaskStore } from '@/stores/taskStore'
import { ipc } from '@/lib/ipc'
import { toast } from 'sonner'
import { useResizeHandle } from '@/hooks/useResizeHandle'
import { DiffViewer } from './DiffViewer'

interface CodePanelProps {
  onClose: () => void
  workspace?: string
}

export function CodePanel({ onClose, workspace: workspaceProp }: CodePanelProps) {
  const [width, setWidth] = useState(380)
  const [diff, setDiff] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)

  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const taskWorkspace = useTaskStore((s) => selectedTaskId ? s.tasks[selectedTaskId]?.workspace : undefined)
  const taskStatus = useTaskStore((s) => selectedTaskId ? s.tasks[selectedTaskId]?.status : undefined)
  const effectiveWorkspace = taskWorkspace ?? workspaceProp

  const fetchDiff = useCallback(() => {
    if (selectedTaskId && taskWorkspace) {
      ipc.getTaskDiff(selectedTaskId).then(setDiff).catch(() => setDiff(''))
    } else if (effectiveWorkspace) {
      ipc.gitDiff(effectiveWorkspace).then(setDiff).catch(() => setDiff(''))
    } else {
      setDiff('')
    }
  }, [selectedTaskId, taskWorkspace, effectiveWorkspace])

  useEffect(() => { fetchDiff() }, [fetchDiff, taskStatus])

  const handleResizeStart = useResizeHandle({
    axis: 'horizontal', size: width, onResize: setWidth, min: 240, max: 800, reverse: true,
  })

  const hasChanges = diff.trim().length > 0
  const isCommitDisabled = !hasChanges || !effectiveWorkspace || isCommitting

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim() || !effectiveWorkspace) return
    setIsCommitting(true)
    try {
      await ipc.gitCommit(effectiveWorkspace, commitMsg.trim())
      setCommitMsg('')
      toast.success('Committed')
      fetchDiff()
    } catch (e) {
      toast.error('Commit failed', { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setIsCommitting(false)
    }
  }, [commitMsg, effectiveWorkspace, fetchDiff])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleCommit()
    }
  }, [handleCommit])

  return (
    <div
      className="flex h-full min-h-0 min-w-0 border-l"
      style={isExpanded ? { flex: '1 0 100%' } : { width }}
    >
      {!isExpanded && (
        <div
          onMouseDown={handleResizeStart}
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 shrink-0 transition-colors"
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b">
          <div className="flex flex-1 items-center gap-1.5 px-3 py-1.5">
            <IconFileCode className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground">Files Changed</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsExpanded((v) => !v)}
                aria-label={isExpanded ? 'Collapse panel' : 'Expand to full width'}
                className="px-1.5 py-1.5 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <IconMinimize className="h-3 w-3" /> : <IconMaximize className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{isExpanded ? 'Collapse panel' : 'Expand to full width'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onClose} aria-label="Close panel" className="px-2 py-1.5 text-muted-foreground hover:text-foreground">
                <IconX className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </div>

        {/* Diff content */}
        <div className="flex flex-1 min-h-0">
          <DiffViewer
            diff={diff}
            taskId={selectedTaskId ?? undefined}
            workspace={effectiveWorkspace}
            onRefreshDiff={fetchDiff}
          />
        </div>

        {/* Commit input */}
        <div className="shrink-0 border-t px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCommitDisabled}
              placeholder={hasChanges ? 'Commit message…' : 'No changes'}
              aria-label="Commit message"
              className="flex-1 min-w-0 rounded border border-input bg-background px-2 py-1 text-[11px] outline-none placeholder:text-muted-foreground/60 focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={isCommitDisabled || !commitMsg.trim()}
              aria-label="Commit"
              className="shrink-0 flex items-center justify-center rounded bg-primary px-1.5 py-1 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCommitting
                ? <IconLoader2 className="size-3.5 animate-spin" />
                : <IconGitCommit className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
