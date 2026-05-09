/**
 * Command Palette — ported from t3code.
 *
 * A Cmd+K / Ctrl+K overlay for quick navigation and actions:
 * - Search threads by name
 * - Switch between projects
 * - Run git actions
 * - Open settings
 * - Create new threads
 */
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { IconSearch, IconMessage, IconFolder, IconSettings, IconGitBranch, IconPlus, IconHistory } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'
import type { SidebarTask } from '@/hooks/useSidebarTasks'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  category: 'thread' | 'project' | 'action'
}

export const CommandPalette = memo(function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const tasks = useTaskStore((s) => s.tasks)
  const archivedMeta = useTaskStore((s) => s.archivedMeta)
  const projects = useTaskStore((s) => s.projects)
  const projectNames = useTaskStore((s) => s.projectNames)
  const setSelectedTask = useTaskStore((s) => s.setSelectedTask)
  const setView = useTaskStore((s) => s.setView)
  const setPendingWorkspace = useTaskStore((s) => s.setPendingWorkspace)
  const setSettingsOpen = useTaskStore((s) => s.setSettingsOpen)
  const hydrateArchivedTask = useTaskStore((s) => s.hydrateArchivedTask)

  // Build command items
  const items = useMemo((): CommandItem[] => {
    const result: CommandItem[] = []
    const lowerQuery = query.toLowerCase()

    // Thread items (live tasks)
    for (const task of Object.values(tasks)) {
      if (lowerQuery && !task.name.toLowerCase().includes(lowerQuery)) continue
      result.push({
        id: `thread:${task.id}`,
        label: task.name,
        description: task.workspace.split('/').pop(),
        icon: <IconMessage className="size-3.5" />,
        action: () => { setSelectedTask(task.id); setView('chat'); onClose() },
        category: 'thread',
      })
    }

    // Archived threads
    for (const meta of Object.values(archivedMeta)) {
      if (lowerQuery && !meta.name.toLowerCase().includes(lowerQuery)) continue
      result.push({
        id: `archived:${meta.id}`,
        label: meta.name,
        description: `${meta.workspace.split('/').pop()} · archived`,
        icon: <IconHistory className="size-3.5 text-muted-foreground/50" />,
        action: () => {
          void hydrateArchivedTask(meta.id).then((ok) => {
            if (ok) { setSelectedTask(meta.id); setView('chat') }
          })
          onClose()
        },
        category: 'thread',
      })
    }

    // Project items
    for (const ws of projects) {
      const name = projectNames[ws] ?? ws.split('/').pop() ?? ws
      if (lowerQuery && !name.toLowerCase().includes(lowerQuery)) continue
      result.push({
        id: `project:${ws}`,
        label: name,
        description: ws,
        icon: <IconFolder className="size-3.5" />,
        action: () => { setPendingWorkspace(ws); setView('chat'); onClose() },
        category: 'project',
      })
    }

    // Action items (always shown unless filtered out)
    const actions: CommandItem[] = [
      {
        id: 'action:new-thread',
        label: 'New Thread',
        description: 'Start a new conversation',
        icon: <IconPlus className="size-3.5" />,
        action: () => {
          const ws = useSettingsStore.getState().activeWorkspace
          if (ws) setPendingWorkspace(ws)
          setView('chat')
          onClose()
        },
        category: 'action',
      },
      {
        id: 'action:settings',
        label: 'Open Settings',
        icon: <IconSettings className="size-3.5" />,
        action: () => { setSettingsOpen(true); onClose() },
        category: 'action',
      },
      {
        id: 'action:dashboard',
        label: 'Dashboard',
        icon: <IconGitBranch className="size-3.5" />,
        action: () => { setView('dashboard'); onClose() },
        category: 'action',
      },
    ]

    for (const action of actions) {
      if (lowerQuery && !action.label.toLowerCase().includes(lowerQuery)) continue
      result.push(action)
    }

    // Limit results
    return result.slice(0, 50)
  }, [query, tasks, archivedMeta, projects, projectNames, setSelectedTask, setView, setPendingWorkspace, setSettingsOpen, hydrateArchivedTask, onClose])

  // Reset selection when query changes
  useEffect(() => { setSelectedIndex(0) }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, items.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      items[selectedIndex]?.action()
    }
  }, [items, selectedIndex, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-[15%] z-[501] w-full max-w-[520px] -translate-x-1/2 rounded-xl border border-border bg-popover shadow-2xl" onKeyDown={handleKeyDown}>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <IconSearch className="size-4 shrink-0 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads, projects, or actions…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <kbd className="shrink-0 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-muted-foreground/50">
              No results found
            </div>
          )}
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                idx === selectedIndex ? 'bg-accent text-foreground' : 'text-foreground/80 hover:bg-accent/50',
              )}
            >
              <span className="shrink-0 text-muted-foreground">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
              {item.description && (
                <span className="shrink-0 truncate text-[11px] text-muted-foreground/50">{item.description}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
})
