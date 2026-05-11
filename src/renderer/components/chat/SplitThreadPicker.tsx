import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { IconLayoutColumns, IconSearch } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useProjectIcon } from '@/hooks/useProjectIcon'
import { ProjectIcon } from '@/components/sidebar/ProjectIcon'
import { cn } from '@/lib/utils'

interface PickerThreadRowProps {
  readonly taskId: string
  readonly onSelect: (taskId: string) => void
}

const PickerThreadRow = memo(function PickerThreadRow({ taskId, onSelect }: PickerThreadRowProps) {
  const name = useTaskStore((s) => s.tasks[taskId]?.name ?? '')
  const workspace = useTaskStore((s) => {
    const t = s.tasks[taskId]
    return t ? (t.originalWorkspace ?? t.workspace) : ''
  })
  const projectNames = useTaskStore((s) => s.projectNames)
  const projectName = projectNames[workspace] ?? workspace.split('/').pop() ?? ''
  const icon = useProjectIcon(workspace)

  return (
    <button
      type="button"
      onClick={() => onSelect(taskId)}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-violet-500/10"
    >
      <ProjectIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{projectName}</p>
      </div>
    </button>
  )
})

interface SplitThreadPickerProps {
  /** The task that will become the "anchor" (left panel). The user picks the other thread. */
  readonly anchorTaskId: string
  /** Screen position for the picker */
  readonly position: { x: number; y: number }
  readonly onClose: () => void
}

export const SplitThreadPicker = memo(function SplitThreadPicker({
  anchorTaskId,
  position,
  onClose,
}: SplitThreadPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const tasks = useTaskStore((s) => s.tasks)
  const candidates = Object.values(tasks)
    .filter((t) => t.id !== anchorTaskId && !t.isArchived && t.status !== 'completed' && t.status !== 'cancelled' && t.messages.length > 0)
    .sort((a, b) => {
      const aTime = a.messages[a.messages.length - 1]?.timestamp ?? a.createdAt
      const bTime = b.messages[b.messages.length - 1]?.timestamp ?? b.createdAt
      return bTime.localeCompare(aTime)
    })

  const query = search.toLowerCase().trim()
  const filtered = query
    ? candidates.filter((t) => t.name.toLowerCase().includes(query))
    : candidates

  const handleSelect = useCallback((taskId: string) => {
    const state = useTaskStore.getState()
    state.createSplitView(anchorTaskId, taskId)
    onClose()
  }, [anchorTaskId, onClose])

  // Clamp position so picker stays on screen
  const style = {
    top: Math.min(position.y, window.innerHeight - 400),
    left: Math.min(position.x, window.innerWidth - 300),
  }

  return (
    <div
      ref={ref}
      className="fixed z-[400] w-[300px] rounded-xl border border-violet-500/20 bg-popover shadow-2xl shadow-violet-500/5"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3.5 py-3">
        <IconLayoutColumns className="size-4 text-violet-400" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-foreground">Side by side</p>
          <p className="text-[11px] text-muted-foreground">Pick a thread for the right panel</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative border-b border-border/60 px-3.5 py-2">
        <IconSearch className="pointer-events-none absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search threads…"
          className="w-full bg-transparent pl-6 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>

      {/* Thread list */}
      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            {candidates.length === 0 ? 'No other active threads' : 'No matches'}
          </p>
        ) : (
          filtered.map((t) => (
            <PickerThreadRow key={t.id} taskId={t.id} onSelect={handleSelect} />
          ))
        )}
      </div>
    </div>
  )
})
