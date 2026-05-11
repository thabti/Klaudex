import { memo, useCallback, useRef, useState } from 'react'
import { IconPlus, IconArrowsUpDown, IconCheck, IconLayoutSidebarLeftCollapse, IconLayoutSidebarRightCollapse, IconFolderOpen, IconLayoutColumns, IconX, IconPin } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useShallow } from 'zustand/react/shallow'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import { useSidebarTasks, type SortKey, type SidebarTask } from '@/hooks/useSidebarTasks'
import { useResizeHandle } from '@/hooks/useResizeHandle'
import { useModifierKeys } from '@/hooks/useModifierKeys'
import { ProjectItem } from './ProjectItem'
import { SidebarFooter } from './SidebarFooter'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'created', label: 'Created' },
  { key: 'recent', label: 'Recent' },
  { key: 'interaction', label: 'Last interaction' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name-asc', label: 'Name A–Z' },
  { key: 'name-desc', label: 'Name Z–A' },
]

const SortDropdown = memo(function SortDropdown({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const handleOpen = useCallback(() => {
    setOpen((v) => {
      if (!v && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect()
        setPos({ top: r.bottom + 4, left: r.left })
      }
      return !v
    })
  }, [])

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button ref={btnRef} type="button" onClick={handleOpen}
            className={cn('inline-flex size-5 cursor-pointer items-center justify-center rounded-md transition-colors',
              open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <IconArrowsUpDown className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Sort tasks</TooltipContent>
      </Tooltip>
      {open && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div className="fixed z-[200] min-w-[130px] rounded-lg border border-border bg-popover py-1 shadow-lg" style={{ top: pos.top, left: pos.left }}>
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.key} type="button"
                onClick={() => { onChange(opt.key); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors">
                <IconCheck className={cn('size-3 shrink-0', sort === opt.key ? 'opacity-100' : 'opacity-0')} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

interface TaskSidebarProps {
  width: number
  onResize: (width: number) => void
  position?: 'left' | 'right'
  onCollapse?: () => void
}

/** Sidebar section showing saved split view pairings */
const SplitViewsList = memo(function SplitViewsList() {
  const splitViews = useTaskStore((s) => s.splitViews)
  const activeSplitId = useTaskStore((s) => s.activeSplitId)
  const tasks = useTaskStore((s) => s.tasks)
  const setActiveSplit = useTaskStore((s) => s.setActiveSplit)
  const removeSplitView = useTaskStore((s) => s.removeSplitView)

  if (splitViews.length === 0) return null

  return (
    <div className="px-2 pb-1">
      <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1">
        <IconLayoutColumns className="size-3 text-violet-400/60" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-violet-400/60">Side by Side</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {splitViews.map((sv) => {
          const leftName = tasks[sv.left]?.name ?? 'Thread'
          const rightName = tasks[sv.right]?.name ?? 'Thread'
          const isActive = sv.id === activeSplitId
          return (
            <li key={sv.id} className="group/sv relative">
              <button
                type="button"
                onClick={() => setActiveSplit(sv.id)}
                className={cn(
                  'flex min-w-0 h-7 w-full items-center gap-1.5 rounded-lg px-2 text-[12px] select-none transition-colors',
                  isActive
                    ? 'bg-violet-500/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-violet-500/5 hover:text-foreground',
                )}
              >
                <IconLayoutColumns className={cn('size-3 shrink-0', isActive ? 'text-violet-400' : 'text-violet-400/50')} />
                <span className="min-w-0 truncate">{leftName}</span>
                <span className="shrink-0 text-violet-400/30">⋮</span>
                <span className="min-w-0 truncate">{rightName}</span>
              </button>
              <button
                type="button"
                aria-label="Remove split view"
                onClick={(e) => { e.stopPropagation(); removeSplitView(sv.id) }}
                className="absolute right-1 top-1/2 -translate-y-1/2 hidden size-4 items-center justify-center rounded text-muted-foreground/50 hover:bg-accent hover:text-foreground group-hover/sv:flex"
              >
                <IconX className="size-2.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})

/** Sidebar section showing pinned threads */
const PinnedThreadsList = memo(function PinnedThreadsList({ selectedTaskId, onSelect }: { selectedTaskId: string | null; onSelect: (id: string) => void }) {
  const pinnedThreadIds = useTaskStore((s) => s.pinnedThreadIds)
  const tasks = useTaskStore((s) => s.tasks)
  const unpinThread = useTaskStore((s) => s.unpinThread)

  const pinnedTasks = pinnedThreadIds.map((id) => tasks[id]).filter(Boolean)
  if (pinnedTasks.length === 0) return null

  return (
    <div className="px-2 pb-1">
      <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1">
        <IconPin className="size-3 text-amber-500/60" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Pinned</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {pinnedTasks.map((task) => {
          const isActive = task.id === selectedTaskId
          return (
            <li key={task.id} className="group/pin relative">
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className={cn(
                  'flex min-w-0 h-7 w-full items-center gap-1.5 rounded-lg px-2 text-[12px] select-none transition-colors',
                  isActive
                    ? 'bg-muted/60 dark:bg-muted/40 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span className="min-w-0 truncate">{task.name}</span>
              </button>
              <button
                type="button"
                aria-label="Unpin thread"
                onClick={(e) => { e.stopPropagation(); unpinThread(task.id) }}
                className="absolute right-1 top-1/2 -translate-y-1/2 hidden size-4 items-center justify-center rounded text-muted-foreground/50 hover:bg-accent hover:text-foreground group-hover/pin:flex"
              >
                <IconX className="size-2.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})

/** Thin separator shown when split views or pinned threads exist above the project list */
const SidebarDivider = memo(function SidebarDivider() {
  const hasSplits = useTaskStore((s) => s.splitViews.length > 0)
  const hasPins = useTaskStore((s) => s.pinnedThreadIds.length > 0)
  if (!hasSplits && !hasPins) return null
  return (
    <div className="flex justify-center py-1">
      <div className="h-px w-8 bg-border/40" />
    </div>
  )
})

const SORT_STORAGE_KEY = 'klaudex-sidebar-sort'

const loadSortPreference = (): SortKey => {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored && SORT_OPTIONS.some((o) => o.key === stored)) return stored as SortKey
  } catch { /* private browsing / quota exceeded */ }
  return 'created'
}

const saveSortPreference = (sort: SortKey): void => {
  try { localStorage.setItem(SORT_STORAGE_KEY, sort) } catch { /* best-effort */ }
}

export const TaskSidebar = memo(function TaskSidebar({ width, onResize, position = 'left', onCollapse }: TaskSidebarProps) {
  const isRight = position === 'right'
  const [sort, setSort] = useState<SortKey>(loadSortPreference)
  const handleSortChange = useCallback((s: SortKey) => {
    setSort(s)
    saveSortPreference(s)
  }, [])
  const projectList = useSidebarTasks(sort)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const isMetaHeld = useModifierKeys()

  const { selectedTaskId, pendingWorkspace, lastAddedProject, setSelectedTask, setView, setNewProjectOpen, removeTask, removeProject, archiveThreads, renameTask, reorderProject, reorderThread, clearLastAddedProject } = useTaskStore(
    useShallow((s) => ({
      selectedTaskId: s.selectedTaskId,
      pendingWorkspace: s.pendingWorkspace,
      lastAddedProject: s.lastAddedProject,
      setSelectedTask: s.setSelectedTask,
      setView: s.setView,
      setNewProjectOpen: s.setNewProjectOpen,
      removeTask: s.removeTask,
      removeProject: s.removeProject,
      archiveThreads: s.archiveThreads,
      renameTask: s.renameTask,
      reorderProject: s.reorderProject,
      reorderThread: s.reorderThread,
      clearLastAddedProject: s.clearLastAddedProject,
    }))
  )

  // Derive the active project workspace from the selected task or pending workspace
  const activeProjectCwd = useTaskStore((s) => {
    if (s.selectedTaskId) {
      const task = s.tasks[s.selectedTaskId]
      if (!task) return null
      return task.originalWorkspace ?? task.workspace
    }
    return s.pendingWorkspace
  })

  /** Move a project up or down, auto-switching to custom sort */
  const handleMoveProject = useCallback((fromIdx: number, direction: 'up' | 'down') => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1
    if (toIdx < 0 || toIdx >= projectList.length) return
    if (sort !== 'custom') handleSortChange('custom')
    reorderProject(fromIdx, toIdx)
  }, [sort, projectList.length, reorderProject, handleSortChange])

  /** Move a thread up or down within a project, auto-switching to custom sort and initializing order */
  const handleMoveThread = useCallback((workspace: string, tasks: readonly SidebarTask[], from: number, to: number) => {
    if (sort !== 'custom') handleSortChange('custom')
    // Initialize threadOrders for this workspace if not yet set
    const state = useTaskStore.getState()
    if (!state.threadOrders[workspace]?.length) {
      const order = tasks.filter((t) => !t.isDraft).map((t) => t.id)
      useTaskStore.setState((s) => ({ threadOrders: { ...s.threadOrders, [workspace]: order } }))
    }
    reorderThread(workspace, from, to)
  }, [sort, handleSortChange, reorderThread])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleSwitchSide = useCallback(() => {
    setCtxMenu(null)
    const store = useSettingsStore.getState()
    const next = position === 'left' ? 'right' : 'left'
    store.saveSettings({ ...store.settings, sidebarPosition: next })
  }, [position])

  const handleSelectTask = useCallback((id: string) => {
    if (id.startsWith('draft:')) {
      useTaskStore.getState().setPendingWorkspace(id.slice(6))
    } else {
      // If this thread is part of a split view, activate that split instead
      const state = useTaskStore.getState()
      const sv = state.splitViews.find((v) => v.left === id || v.right === id)
      if (sv) {
        state.setActiveSplit(sv.id)
        const panel = sv.left === id ? 'left' : 'right'
        state.setFocusedPanel(panel)
        useTaskStore.setState({ selectedTaskId: id })
        setView('chat')
      } else {
        setSelectedTask(id); setView('chat')
      }
    }
  }, [setSelectedTask, setView])
  const handleDeleteTask = useCallback((id: string) => {
    if (id.startsWith('draft:')) {
      const ws = id.slice(6)
      const store = useTaskStore.getState()
      // Clear pendingWorkspace first so PendingChat unmounts before removeDraft,
      // preventing the unmount flush from resurrecting the draft
      if (store.pendingWorkspace === ws) {
        store.setPendingWorkspace(null)
      }
      store.removeDraft(ws)
    } else {
      void ipc.cancelTask(id).catch(() => {}); removeTask(id); void ipc.deleteTask(id)
    }
  }, [removeTask])
  const handleNewThread = useCallback((workspace: string) => { useTaskStore.getState().setPendingWorkspace(workspace) }, [])

  // Sidebar edge resize
  const handleResizeStart = useResizeHandle({
    axis: 'horizontal', size: width, onResize, min: 180, max: Math.round(window.innerWidth * 0.2), reverse: isRight,
  })

  return (
    <div data-testid="task-sidebar" onContextMenu={handleContextMenu} className={cn('relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar pt-9 text-foreground', isRight ? 'border-l pr-1 order-last' : 'border-r pl-1')} style={{ width }}>
      {/* Collapse button in traffic lights zone */}
      {onCollapse && (
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
          className="absolute right-2 top-2 z-20 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isRight ? <IconLayoutSidebarRightCollapse className="size-4" aria-hidden /> : <IconLayoutSidebarLeftCollapse className="size-4" aria-hidden />}
        </button>
      )}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
          <div className="fixed z-[200] min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-lg" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <button type="button" onClick={handleSwitchSide} className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-accent transition-colors">
              {isRight ? <IconLayoutSidebarLeftCollapse className="size-3.5" /> : <IconLayoutSidebarRightCollapse className="size-3.5" />}
              Move sidebar to {isRight ? 'left' : 'right'}
            </button>
          </div>
        </>
      )}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onMouseDown={handleResizeStart}
        className={cn('absolute top-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors', isRight ? 'left-0' : 'right-0')}
      />
      <div className="flex items-center justify-between px-4 py-2 pr-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projects</span>
        <div className="flex shrink-0 items-center gap-1">
          <SortDropdown sort={sort} onChange={handleSortChange} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Add project" data-testid="add-project-button" onClick={() => setNewProjectOpen(true)}
                className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <IconPlus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Import project folder</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <SplitViewsList />
      <PinnedThreadsList selectedTaskId={selectedTaskId ?? (pendingWorkspace ? `draft:${pendingWorkspace}` : null)} onSelect={handleSelectTask} />
      <SidebarDivider />
      <ScrollArea className="min-h-0 flex-1 overflow-hidden px-2">
        <div className="min-w-0 pb-2">
          <div className="relative flex min-w-0 flex-col">
            <ul className="flex min-w-0 flex-col gap-0.5">
              {projectList.length === 0 && (
                <li className="flex flex-col items-center gap-3 px-3 py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted/30">
                    <IconFolderOpen size={20} stroke={1.5} className="text-muted-foreground/70" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-muted-foreground">No projects yet</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Import a folder to start working with Claude</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewProjectOpen(true)}
                    aria-label="Import project folder"
                    tabIndex={0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <IconPlus size={12} /> Import Project
                  </button>
                </li>
              )}
              {projectList.map((project, idx) => (
                <ProjectItem
                  key={project.cwd}
                  name={project.name}
                  cwd={project.cwd}
                  tasks={project.tasks}
                  selectedTaskId={selectedTaskId ?? (pendingWorkspace ? `draft:${pendingWorkspace}` : null)}
                  isActiveProject={project.cwd === activeProjectCwd}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < projectList.length - 1}
                  autoFocus={project.cwd === lastAddedProject}
                  jumpLabel={isMetaHeld && idx < 9 ? `⌘${idx + 1}` : null}
                  isMetaHeld={isMetaHeld}
                  isCustomSort={sort === 'custom'}
                  onSelectTask={handleSelectTask}
                  onNewThread={() => handleNewThread(project.cwd)}
                  onDeleteTask={handleDeleteTask}
                  onRenameTask={renameTask}
                  onRemoveProject={() => removeProject(project.cwd)}
                  onArchiveThreads={() => archiveThreads(project.cwd)}
                  onMoveUp={() => handleMoveProject(idx, 'up')}
                  onMoveDown={() => handleMoveProject(idx, 'down')}
                  onMoveThread={(from, to) => handleMoveThread(project.cwd, project.tasks, from, to)}
                />
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
      <SidebarFooter />
    </div>
  )
})
