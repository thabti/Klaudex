import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useProjectIcon } from '@/hooks/useProjectIcon'
import { ProjectIcon } from '@/components/sidebar/ProjectIcon'
import { usePanelContext, type PanelKey } from './PanelContext'
import { cn } from '@/lib/utils'

/**
 * SplitThreadPicker — floating dropdown that lets the user choose which
 * thread is bound to a given split panel. Selecting a row updates the
 * PanelContext via `setPanelThread(targetPanel, taskId)`. The dropdown
 * closes on outside click, Escape, or a successful selection.
 *
 * Empty-state: when there are no candidate threads, renders a single
 * "No threads" row instead of an empty list.
 */

interface PickerThreadRowProps {
  readonly taskId: string
  readonly onSelect: (taskId: string) => void
}

const PickerThreadRow = memo(function PickerThreadRow({ taskId, onSelect }: PickerThreadRowProps) {
  const name = useTaskStore((s) => s.tasks[taskId]?.name ?? '')
  const workspace = useTaskStore((s) => {
    const task = s.tasks[taskId]
    return task ? task.originalWorkspace ?? task.workspace : ''
  })
  const projectNames = useTaskStore((s) => s.projectNames)
  const projectName = projectNames[workspace] ?? workspace.split('/').pop() ?? ''
  const icon = useProjectIcon(workspace)

  const handleClick = useCallback(() => {
    onSelect(taskId)
  }, [onSelect, taskId])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <ProjectIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{name || 'Untitled thread'}</p>
        {projectName && (
          <p className="truncate text-[11px] text-muted-foreground">{projectName}</p>
        )}
      </div>
    </button>
  )
})

interface SplitThreadPickerProps {
  /** Which panel will receive the selected thread. */
  readonly targetPanel: PanelKey
  /** Screen-space anchor position for the dropdown. */
  readonly position: { x: number; y: number }
  readonly onClose: () => void
}

export const SplitThreadPicker = memo(function SplitThreadPicker({
  targetPanel,
  position,
  onClose,
}: SplitThreadPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  const { panels, setPanelThread } = usePanelContext()
  const otherPanel: PanelKey = targetPanel === 'left' ? 'right' : 'left'
  const otherThreadId = panels[otherPanel].threadId

  const tasks = useTaskStore((s) => s.tasks)

  // Focus the search input on mount.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on outside click.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const candidates = useMemo(() => {
    return Object.values(tasks)
      .filter((task) => {
        if (task.id === otherThreadId) return false
        if (task.isArchived) return false
        if (task.status === 'completed' || task.status === 'cancelled') return false
        return true
      })
      .sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.timestamp ?? a.createdAt
        const bTime = b.messages[b.messages.length - 1]?.timestamp ?? b.createdAt
        return bTime.localeCompare(aTime)
      })
  }, [tasks, otherThreadId])

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return candidates
    return candidates.filter((task) => task.name.toLowerCase().includes(query))
  }, [candidates, search])

  const handleSelect = useCallback(
    (taskId: string) => {
      setPanelThread(targetPanel, taskId)
      onClose()
    },
    [targetPanel, setPanelThread, onClose],
  )

  // Clamp position so the picker stays visible inside the viewport.
  const clampedTop = Math.max(8, Math.min(position.y, window.innerHeight - 400))
  const clampedLeft = Math.max(8, Math.min(position.x, window.innerWidth - 280))
  // Inline style is unavoidable here: dropdown position is dynamic per the
  // anchor click coordinates and cannot be expressed as Tailwind classes.
  const positionStyle = { top: clampedTop, left: clampedLeft }

  const isEmpty = candidates.length === 0
  const hasMatches = filtered.length > 0

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Choose a thread for this split panel"
      className="fixed z-[400] w-[280px] rounded-xl border border-border bg-popover shadow-xl"
      style={positionStyle}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-[13px] font-medium text-foreground">Choose a thread</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <IconX className="size-3" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search threads…"
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>

      <div
        className={cn(
          'max-h-[300px] overflow-y-auto p-1.5',
          (isEmpty || !hasMatches) && 'p-0',
        )}
      >
        {isEmpty ? (
          <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">No threads</p>
        ) : !hasMatches ? (
          <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">No matches</p>
        ) : (
          filtered.map((task) => (
            <PickerThreadRow key={task.id} taskId={task.id} onSelect={handleSelect} />
          ))
        )}
      </div>
    </div>
  )
})
