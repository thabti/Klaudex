import { useCallback, useEffect, useState, memo, useRef } from "react"
import {
  IconGitCompare,
  IconTerminal2,
  IconGitBranch,
  IconLayoutColumns,
} from "@tabler/icons-react"
import { useTaskStore } from "@/stores/taskStore"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { OpenInEditorGroup } from "@/components/OpenInEditorGroup"
import { GitActionsGroup } from "@/components/GitActionsGroup"
import { SplitThreadPicker } from "@/components/chat/SplitThreadPicker"
import { ipc } from "@/lib/ipc"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"

/** Toggle button for split-screen mode. Opens a thread picker or closes split. */
const SplitToggleButton = memo(function SplitToggleButton() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const splitTaskId = useTaskStore((s) => s.splitTaskId)
  const isSplit = splitTaskId !== null
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback(() => {
    if (isSplit) {
      useTaskStore.getState().closeSplit()
      return
    }
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPickerPos({ x: rect.right - 280, y: rect.bottom + 6 })
  }, [isSplit])

  if (!selectedTaskId) return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={btnRef}
            type="button"
            data-testid="toggle-split-button"
            aria-label="Toggle split view"
            aria-pressed={isSplit}
            onClick={handleClick}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-all duration-150",
              isSplit
                ? "bg-primary text-white border border-primary/80 hover:bg-primary/90"
                : "bg-gradient-to-r from-violet-500/10 to-blue-500/10 text-violet-400 border border-violet-500/20 hover:from-violet-500/20 hover:to-blue-500/20 hover:text-violet-300",
            )}
          >
            <IconLayoutColumns className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isSplit ? "Close split view" : "Split view · compare two threads"}
        </TooltipContent>
      </Tooltip>
      {pickerPos && selectedTaskId && (
        <SplitThreadPicker
          anchorTaskId={selectedTaskId}
          position={pickerPos}
          onClose={() => setPickerPos(null)}
        />
      )}
    </>
  )
})

interface HeaderToolbarProps {
  workspace: string
  sidePanelOpen: boolean
  onToggleSidePanel: () => void
}

export const HeaderToolbar = memo(function HeaderToolbar({
  workspace,
  sidePanelOpen,
  onToggleSidePanel,
}: HeaderToolbarProps) {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const taskStatus = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.status : null,
  ) as TaskStatus | null
  const terminalOpen = useTaskStore((s) =>
    selectedTaskId ? s.terminalOpenTasks.has(selectedTaskId) : false,
  )
  const toggleTerminal = useTaskStore((s) => s.toggleTerminal)

  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [diffStats, setDiffStats] = useState({
    additions: 0,
    deletions: 0,
    fileCount: 0,
  })

  // Detect whether workspace is a git repo
  useEffect(() => {
    let stale = false
    ipc.gitDetect(workspace).then((detected) => {
      if (!stale) setIsGitRepo(detected)
    }).catch(() => {
      if (!stale) setIsGitRepo(false)
    })
    return () => { stale = true }
  }, [workspace])

  // Poll diff stats only when it's a git repo
  useEffect(() => {
    if (!isGitRepo) return
    let stale = false
    const fetch = () => {
      ipc
        .gitDiffStats(workspace)
        .then((s) => {
          if (!stale) setDiffStats(s)
        })
        .catch(() => {})
    }
    fetch()
    const interval = setInterval(fetch, 10_000)
    return () => {
      stale = true
      clearInterval(interval)
    }
  }, [workspace, taskStatus, isGitRepo])

  const handleInitGit = useCallback(async () => {
    setIsInitializing(true)
    try {
      await ipc.gitInit(workspace)
      setIsGitRepo(true)
    } catch {
      // Error is non-critical; user can retry
    } finally {
      setIsInitializing(false)
    }
  }, [workspace])

  const canPause = taskStatus === "running"
  const hasStats = diffStats.additions > 0 || diffStats.deletions > 0

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ErrorBoundary fallback={null}>
        <OpenInEditorGroup workspace={workspace} />
      </ErrorBoundary>

      {isGitRepo === false && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="git-init-button"
              aria-label="Initialize Git repository"
              disabled={isInitializing}
              onClick={handleInitGit}
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-md border border-input px-2 text-xs shadow-xs/5 transition-colors",
                "bg-popover hover:bg-accent/50 dark:bg-input/32 text-muted-foreground",
                isInitializing && "opacity-50 cursor-not-allowed",
              )}
            >
              <IconGitBranch className="size-3" aria-hidden />
              {isInitializing ? "Initializing…" : "Initialize Git"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Initialize a git repository</TooltipContent>
        </Tooltip>
      )}

      {isGitRepo && (
        <div className="flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="toggle-diff-button"
                aria-label="Toggle diff panel"
                aria-pressed={sidePanelOpen}
                onClick={onToggleSidePanel}
                className={cn(
                  "inline-flex h-6 items-center gap-1.5 px-1.5 text-xs shadow-xs/5 transition-colors border border-input",
                  "rounded-l-md",
                  sidePanelOpen
                    ? "bg-input/64 dark:bg-input text-foreground"
                    : "bg-popover hover:bg-accent/50 dark:bg-input/32 text-muted-foreground",
                )}
              >
                <IconGitCompare className="size-3" aria-hidden />
                {hasStats && (
                  <span
                    className={cn(
                      "flex items-center gap-1 tabular-nums",
                      canPause && "animate-pulse",
                    )}
                  >
                    {diffStats.fileCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {diffStats.fileCount}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-emerald-500">
                      +{diffStats.additions.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-red-500">
                      -{diffStats.deletions.toLocaleString()}
                    </span>
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Files changed</TooltipContent>
          </Tooltip>
          <ErrorBoundary fallback={null}>
            <GitActionsGroup workspace={workspace} />
          </ErrorBoundary>
        </div>
      )}

      {selectedTaskId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="toggle-terminal-button"
              aria-label="Toggle terminal"
              aria-pressed={terminalOpen}
              onClick={() => toggleTerminal(selectedTaskId)}
              className={cn(
                "inline-flex h-6 items-center rounded-md border border-input px-1.5 text-xs shadow-xs/5 transition-colors",
                terminalOpen
                  ? "bg-input/64 dark:bg-input text-foreground"
                  : "bg-popover hover:bg-accent/50 dark:bg-input/32 text-muted-foreground",
              )}
            >
              <IconTerminal2 className="size-3" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Terminal</TooltipContent>
        </Tooltip>
      )}

      <SplitToggleButton />

    </div>
  )
})
