import { useState, useEffect, useCallback } from 'react'
import { X, FileCode, Maximize2, Minimize2 } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { ipc } from '@/lib/ipc'
import { useResizeHandle } from '@/hooks/useResizeHandle'
import { DiffViewer } from './DiffViewer'

interface CodePanelProps {
  onClose: () => void
}

export function CodePanel({ onClose }: CodePanelProps) {
  const [width, setWidth] = useState(380)
  const [diff, setDiff] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const taskWorkspace = useTaskStore((s) => selectedTaskId ? s.tasks[selectedTaskId]?.workspace : undefined)
  const taskStatus = useTaskStore((s) => selectedTaskId ? s.tasks[selectedTaskId]?.status : undefined)

  const fetchDiff = useCallback(() => {
    if (!selectedTaskId || !taskWorkspace) {
      setDiff('')
      return
    }
    ipc.getTaskDiff(selectedTaskId).then(setDiff).catch(() => setDiff(''))
  }, [selectedTaskId, taskWorkspace])

  // Fetch diff when task changes
  useEffect(() => { fetchDiff() }, [fetchDiff, taskStatus])

  // Resize drag
  const handleResizeStart = useResizeHandle({
    axis: 'horizontal', size: width, onResize: setWidth, min: 240, max: 800, reverse: true,
  })

  return (
    <div
      className="flex h-full min-h-0 min-w-0 border-l"
      style={isExpanded ? { flex: '1 0 100%' } : { width }}
    >
      {/* Resize handle */}
      {!isExpanded && (
        <div
          onMouseDown={handleResizeStart}
          className="w-1 cursor-col-resize hover:bg-accent/40 shrink-0"
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b">
          <div className="flex flex-1 items-center gap-1.5 px-3 py-1.5">
            <FileCode className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground">Files Changed</span>
          </div>
          <button
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? 'Collapse panel' : 'Expand to full width'}
            className="px-1.5 py-1.5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="px-2 py-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Diff content */}
        <div className="flex flex-1 min-h-0">
          <DiffViewer
            diff={diff}
            taskId={selectedTaskId ?? undefined}
            workspace={taskWorkspace}
            onRefreshDiff={fetchDiff}
          />
        </div>
      </div>
    </div>
  )
}
