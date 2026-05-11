import { memo, useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { IconClock, IconFolderOpen, IconAlertTriangle, IconX } from '@tabler/icons-react'
import { ipc, type RecentProject } from '@/lib/ipc'
import { useTaskStore } from '@/stores/taskStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SIDEBAR_LIMIT = 5

/** A single recent-project row + its `(missing)` badge resolution. */
interface RecentRow {
  project: RecentProject
  isMissing: boolean
}

/**
 * Open the recent project: import it as a workspace (idempotent — `addProject`
 * dedupes) and surface it via `pendingWorkspace` so the chat panel attaches.
 * Re-orders the persisted recent list by re-adding the entry, which floats it
 * to the top via the backend's `opened_at`-based sort. The macOS native menu
 * is then rebuilt on the backend side as part of the add path.
 */
const openProject = (path: string, name: string, iconPath?: string): void => {
  const store = useTaskStore.getState()
  store.addProject(path)
  store.setPendingWorkspace(path)
  // Fire-and-forget; the backend rebuilds the menu on success. Failures are
  // non-fatal because the workspace switch already happened in-memory.
  ipc.addRecentProject(path, name, iconPath).catch(() => {})
}

const basenameOf = (path: string): string => {
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

interface RecentProjectsListProps {
  /**
   * When `true` the component renders the compact sidebar variant (icon row,
   * up to `SIDEBAR_LIMIT` entries). Defaults to `true`.
   */
  compact?: boolean
}

/**
 * Shows a short list of the user's most recent projects, suitable for the
 * sidebar empty-state. Doubles as the host for the `open-recent-project`
 * Tauri event listener fired by clicks on the macOS File → Recent Projects
 * submenu.
 *
 * NOTE: this component is currently mounted only when the sidebar is visible
 * (TaskSidebar is gated on `!isSidebarCollapsed`). For TASK-039/043, lift the
 * `open-recent-project` listener to a higher always-mounted location (a tiny
 * dedicated `<MenuEventBridge />` mounted from App.tsx is the cleanest option)
 * so File → Recent works even when the sidebar is collapsed.
 */
export const RecentProjectsList = memo(function RecentProjectsList({ compact = true }: RecentProjectsListProps) {
  const [rows, setRows] = useState<RecentRow[]>([])

  const refresh = useCallback(async () => {
    const list = await ipc.getRecentProjects()
    const sliced = list.slice(0, SIDEBAR_LIMIT)
    // Resolve missing-path state in parallel so a slow disk doesn't gate the
    // whole list. `isDirectory` returns `false` on missing paths and on
    // non-directory paths alike, which matches the menu's `(missing)` rule.
    const results = await Promise.all(
      sliced.map(async (project): Promise<RecentRow> => {
        try {
          const exists = await ipc.isDirectory(project.path)
          return { project, isMissing: !exists }
        } catch {
          return { project, isMissing: true }
        }
      }),
    )
    setRows(results)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Listen for native menu clicks (File → Recent Projects → <name>) and
  // the "Clear Recent Projects" item.
  useEffect(() => {
    let active = true
    const unsubs: Array<() => void> = []

    const setup = async (): Promise<void> => {
      const u1 = await listen<string>('open-recent-project', (event) => {
        if (!active) return
        const path = event.payload
        if (!path) return
        const name = basenameOf(path)
        openProject(path, name)
      })
      const u2 = await listen('recent-projects-cleared', () => {
        if (!active) return
        setRows([])
      })
      unsubs.push(u1, u2)
    }

    void setup()
    return () => {
      active = false
      unsubs.forEach((u) => u())
    }
  }, [])

  const handleSelect = useCallback((row: RecentRow) => {
    if (row.isMissing) {
      // Offer to remove the stale entry. Confirm dialog keeps the affordance
      // discoverable without a separate context menu.
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        `"${row.project.name || basenameOf(row.project.path)}" is missing on disk.\n\nRemove it from Recent Projects?`,
      )
      if (ok) {
        ipc.removeRecentProject(row.project.path).catch(() => {})
        setRows((prev) => prev.filter((r) => r.project.path !== row.project.path))
      }
      return
    }
    openProject(row.project.path, row.project.name, row.project.iconPath)
  }, [])

  const handleRemove = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    ipc.removeRecentProject(path).catch(() => {})
    setRows((prev) => prev.filter((r) => r.project.path !== path))
  }, [])

  // The component always remains mounted — even when the list is empty —
  // because the `open-recent-project` listener installed above must stay
  // alive for native macOS File → Recent menu clicks.
  if (rows.length === 0) return <div aria-hidden className="hidden" />

  return (
    <div className={cn('flex flex-col gap-1', compact ? 'px-1 py-2' : 'px-3 py-3')}>
      <div className="flex items-center gap-1.5 px-2 pb-1">
        <IconClock className="size-3 text-muted-foreground/70" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Recent projects
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => {
          const display = row.project.name || basenameOf(row.project.path)
          return (
            <li key={row.project.path}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                      row.isMissing ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {row.isMissing ? (
                      <IconAlertTriangle className="size-3.5 shrink-0 text-amber-500/80" aria-hidden />
                    ) : (
                      <IconFolderOpen className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">{display}</span>
                    {row.isMissing && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-500">
                        missing
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove ${display} from recent projects`}
                      onClick={(e) => handleRemove(e, row.project.path)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground/0 transition-colors hover:bg-destructive/20 hover:text-destructive group-hover:text-muted-foreground/70"
                    >
                      <IconX className="size-3" aria-hidden />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[320px] break-all">
                  {row.project.path}
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
    </div>
  )
})
