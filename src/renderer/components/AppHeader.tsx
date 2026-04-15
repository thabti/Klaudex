import { useEffect, useCallback, useState, useRef, memo } from "react";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconCircleX,
  IconGitCompare,
  IconTerminal2,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconUser,
  IconLogin,
  IconLogout,
  IconRefresh,
  IconUserCheck,
  IconGitFork,
  IconGitBranch,
} from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTaskStore } from "@/stores/taskStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OpenInEditorGroup } from "@/components/OpenInEditorGroup";
import { GitActionsGroup } from "@/components/GitActionsGroup";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

// ── Window drag handler ──────────────────────────────────────
// Belt-and-suspenders: data-tauri-drag-region (+ CSS app-region: drag)
// handles native drag when focused; startDragging() JS API covers edge
// cases where the attribute alone fails (known Tauri issue #4316).
const INTERACTIVE =
  'button, a, input, textarea, select, [role="button"], [data-no-drag]';

const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
  if (e.detail === 2) {
    getCurrentWindow().toggleMaximize();
  } else {
    getCurrentWindow().startDragging();
  }
};

// ── Breadcrumb separator ──────────────────────────────────────────────
const Sep = () => <span className="text-muted-foreground select-none">/</span>;

// ── AppHeader ─────────────────────────────────────────────────────────
interface AppHeaderProps {
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  sidebarPosition?: "left" | "right";
}

const AppHeaderInner = memo(function AppHeaderInner({
  sidePanelOpen,
  onToggleSidePanel,
  isSidebarCollapsed,
  onToggleSidebar,
  sidebarPosition = "left",
}: AppHeaderProps) {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const taskStatus = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.status : null,
  ) as TaskStatus | null;
  const taskName = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.name : null,
  );
  const taskWorkspace = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.workspace : null,
  );
  const taskOriginalWorkspace = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.originalWorkspace : null,
  );
  const taskUserPaused = useTaskStore((s) =>
    selectedTaskId ? s.tasks[selectedTaskId]?.userPaused : undefined,
  );
  const isWorktree = useTaskStore((s) =>
    selectedTaskId ? !!s.tasks[selectedTaskId]?.worktreePath : false,
  );
  const pendingWorkspace = useTaskStore((s) => s.pendingWorkspace);
  const terminalOpen = useTaskStore((s) =>
    selectedTaskId ? s.terminalOpenTasks.has(selectedTaskId) : false,
  );
  const toggleTerminal = useTaskStore((s) => s.toggleTerminal);
  const renameTask = useTaskStore((s) => s.renameTask);
  const projectNames = useTaskStore((s) => s.projectNames);

  // Workspace-level diff stats (reactive to workspace changes)
  // workspace = actual working directory (worktree path for worktree threads) — used for git/diff ops
  const workspace = taskWorkspace ?? pendingWorkspace;
  // projectRoot = always the real project folder — used for display and prefs lookup
  const projectRoot = taskOriginalWorkspace ?? workspace;
  const [diffStats, setDiffStats] = useState({
    additions: 0,
    deletions: 0,
    fileCount: 0,
  });

  // Inline rename state for breadcrumbs
  const [editingThread, setEditingThread] = useState(false);
  const [threadEditValue, setThreadEditValue] = useState("");
  const threadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) {
      setDiffStats({ additions: 0, deletions: 0, fileCount: 0 });
      return;
    }
    let stale = false;
    const fetch = () => {
      ipc
        .gitDiffStats(workspace)
        .then((s) => {
          if (!stale) setDiffStats(s);
        })
        .catch(() => {});
    };
    fetch();
    // Poll every 10s so stats stay fresh even without task activity
    const interval = setInterval(fetch, 10_000);
    return () => {
      stale = true;
      clearInterval(interval);
    };
  }, [workspace, taskStatus]);

  const handlePause = useCallback(() => {
    if (selectedTaskId) ipc.pauseTask(selectedTaskId);
  }, [selectedTaskId]);
  const handleResume = useCallback(() => {
    if (selectedTaskId) ipc.resumeTask(selectedTaskId);
  }, [selectedTaskId]);
  const handleCancel = useCallback(() => {
    if (selectedTaskId) ipc.cancelTask(selectedTaskId);
  }, [selectedTaskId]);
  const forkTask = useTaskStore((s) => s.forkTask);
  const isForking = useTaskStore((s) => s.isForking);
  const handleFork = useCallback(() => {
    if (selectedTaskId && !isForking) void forkTask(selectedTaskId);
  }, [selectedTaskId, forkTask, isForking]);

  // Show workspace from task or from pendingWorkspace (before first message)
  const projectName =
    (projectRoot
      ? (projectNames[projectRoot] ?? projectRoot.split("/").pop())
      : null) ?? null;

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingThread) threadInputRef.current?.select();
  }, [editingThread]);

  const handleThreadDoubleClick = useCallback(() => {
    if (!selectedTaskId || !taskName) return;
    setThreadEditValue(taskName);
    setEditingThread(true);
  }, [selectedTaskId, taskName]);

  const commitThreadRename = useCallback(() => {
    const trimmed = threadEditValue.trim();
    if (selectedTaskId && trimmed && trimmed !== taskName)
      renameTask(selectedTaskId, trimmed);
    setEditingThread(false);
  }, [threadEditValue, taskName, selectedTaskId, renameTask]);
  const canPause = taskStatus === "running";
  const canResume = taskStatus === "paused" && !!taskUserPaused;
  const canCancel =
    taskStatus === "running" || (taskStatus === "paused" && !!taskUserPaused);
  const hasStats = diffStats.additions > 0 || diffStats.deletions > 0;

  return (
    <header
      data-testid="app-header"
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      className="flex h-[38px] shrink-0 items-center gap-3 border-b border-border bg-background p-0 pr-2 pt-1 pl-[74px] select-none [-webkit-user-select:none]"
    >
      {/* Breadcrumb left */}
      <nav
        data-testid="app-header-breadcrumb"
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
      >
        {/* Toggle sidebar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="toggle-sidebar-button"
              aria-label="Toggle sidebar"
              aria-pressed={!isSidebarCollapsed}
              onClick={onToggleSidebar}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {isSidebarCollapsed ? (
                sidebarPosition === "right" ? (
                  <IconLayoutSidebarRightExpand
                    className="size-4"
                    aria-hidden
                  />
                ) : (
                  <IconLayoutSidebarLeftExpand className="size-4" aria-hidden />
                )
              ) : sidebarPosition === "right" ? (
                <IconLayoutSidebarRightCollapse
                  className="size-4"
                  aria-hidden
                />
              ) : (
                <IconLayoutSidebarLeftCollapse className="size-4" aria-hidden />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Toggle sidebar{" "}
            <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">
              ⌘B
            </kbd>
          </TooltipContent>
        </Tooltip>

        {/* Project */}
        {projectName ? (
          <>
            <Sep />
            <span
              className="min-w-0 max-w-[160px] truncate rounded-sm text-[13px] text-muted-foreground px-0.5"
              title={workspace ?? undefined}
            >
              {projectName}
            </span>
          </>
        ) : (
          <>
            <Sep />
            <span
              data-tauri-drag-region
              className="h-3 w-20 rounded bg-muted-foreground/8"
            />
          </>
        )}

        {/* Thread */}
        {taskName ? (
          <>
            <Sep />
            {editingThread ? (
              <input
                ref={threadInputRef}
                data-no-drag
                value={threadEditValue}
                onChange={(e) => setThreadEditValue(e.target.value)}
                onBlur={commitThreadRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitThreadRename();
                  if (e.key === "Escape") setEditingThread(false);
                }}
                className="min-w-0 max-w-[200px] truncate rounded-sm bg-transparent px-0.5 text-[13px] font-medium text-foreground outline-none ring-1 ring-ring"
              />
            ) : (
              <span
                data-no-drag
                role="button"
                tabIndex={0}
                aria-label={`Rename thread ${taskName}`}
                onDoubleClick={handleThreadDoubleClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "F2")
                    handleThreadDoubleClick();
                }}
                className="min-w-0 max-w-[200px] cursor-default truncate rounded-sm text-[13px] font-medium text-foreground hover:bg-accent/50 px-0.5 transition-colors"
                title={taskName}
              >
                {taskName}
              </span>
            )}
            {isWorktree && (
              <IconGitBranch
                className="size-3.5 shrink-0 text-violet-500 dark:text-violet-400"
                aria-label="Worktree thread"
              />
            )}
          </>
        ) : pendingWorkspace ? (
          <>
            <Sep />
            <span className="text-[13px] text-muted-foreground">
              New thread
            </span>
          </>
        ) : !workspace ? (
          <>
            <Sep />
            <span
              data-tauri-drag-region
              className="h-3 w-28 rounded bg-muted-foreground/6"
            />
          </>
        ) : null}
      </nav>

      {/* Actions (right) — ghost placeholders when no workspace, real actions otherwise */}
      {!workspace && (
        <div
          className="flex shrink-0 items-center gap-2 pointer-events-none"
          aria-hidden
        >
          <div className="h-5 w-14 rounded bg-muted-foreground/6" />
          <div className="flex">
            <div className="inline-flex h-6 items-center gap-1.5 rounded-l-md border border-muted-foreground/8 px-1.5">
              <IconGitCompare className="size-3 text-muted-foreground/70" />
            </div>
            <div className="inline-flex h-6 items-center rounded-r-md border border-l-0 border-muted-foreground/8 px-1.5">
              <span className="h-2 w-2 rounded-sm bg-muted-foreground/10" />
            </div>
          </div>
          <div className="inline-flex h-6 items-center rounded-md border border-muted-foreground/8 px-1.5">
            <IconTerminal2 className="size-3 text-muted-foreground/70" />
          </div>
        </div>
      )}
      {workspace && (
        <div className="flex shrink-0 items-center gap-2">
          <ErrorBoundary fallback={null}>
            <OpenInEditorGroup workspace={workspace} />
          </ErrorBoundary>

          {/* Diff stats + git dropdown as one split button */}
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
                    workspace ? "rounded-l-md" : "rounded-md",
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
            {workspace && (
              <ErrorBoundary fallback={null}>
                <GitActionsGroup workspace={workspace} />
              </ErrorBoundary>
            )}
          </div>

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

          {selectedTaskId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-testid="header-fork-button"
                  aria-label="Fork thread"
                  onClick={handleFork}
                  disabled={isForking}
                  className="inline-flex h-6 items-center rounded-md border border-input bg-popover px-1.5 text-xs shadow-xs/5 transition-colors hover:bg-accent/50 dark:bg-input/32 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconGitFork
                    className={`size-3 ${isForking ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isForking ? "Forking…" : "Fork thread"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Pause / Resume / Cancel — commented out, kept for future use
          {canPause && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={handlePause} data-testid="header-pause-button"><IconPlayerPause className="size-3.5" /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Pause</TooltipContent>
            </Tooltip>
          )}
          {canResume && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={handleResume} data-testid="header-resume-button"><IconPlayerPlay className="size-3.5" /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Resume</TooltipContent>
            </Tooltip>
          )}
          {canCancel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={handleCancel} data-testid="header-cancel-button"><IconCircleX className="size-3.5" /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Cancel</TooltipContent>
            </Tooltip>
          )}
          */}
        </div>
      )}

      {/* User menu — always visible */}
      <UserMenu />
    </header>
  );
});

// ── User menu ────────────────────────────────────────────────────

const UserMenu = memo(function UserMenu() {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const kiroAuth = useSettingsStore((s) => s.kiroAuth);
  const kiroAuthChecked = useSettingsStore((s) => s.kiroAuthChecked);
  const checkAuth = useSettingsStore((s) => s.checkAuth);
  const logout = useSettingsStore((s) => s.logout);
  const openLogin = useSettingsStore((s) => s.openLogin);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initial = kiroAuth?.email
    ? kiroAuth.email.charAt(0).toUpperCase()
    : null;

  return (
    <div ref={ref} className="relative shrink-0" data-no-drag>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md transition-colors",
              kiroAuth
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
              !kiroAuthChecked && "animate-pulse",
            )}
          >
            {kiroAuth ? (
              <IconUserCheck className="size-4" />
            ) : (
              <IconUser className="size-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {kiroAuth
            ? (kiroAuth.email ?? kiroAuth.accountType)
            : "Not logged in"}
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl shadow-black/20 animate-in fade-in-0 slide-in-from-top-1 duration-100">
          {kiroAuth ? (
            <>
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="text-[12px] font-medium text-foreground/90 truncate">
                  {kiroAuth.email ?? kiroAuth.accountType}
                </p>
                <p className="text-[10px] text-foreground/70">
                  {kiroAuth.accountType}
                  {kiroAuth.region ? ` · ${kiroAuth.region}` : ""}
                </p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={async () => {
                    setRefreshing(true);
                    await checkAuth();
                    setRefreshing(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground/90 disabled:opacity-50"
                >
                  <IconRefresh
                    className={cn("size-3.5", refreshing && "animate-spin")}
                  />{" "}
                  {refreshing ? "Checking…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-600/70 dark:text-red-400/70 transition-colors hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-400"
                >
                  <IconLogout className="size-3.5" /> Logout
                </button>
              </div>
            </>
          ) : (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  openLogin();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground/90"
              >
                <IconLogin className="size-3.5" /> Login to Kiro
              </button>
              <button
                type="button"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  await checkAuth();
                  setRefreshing(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground/70 disabled:opacity-50"
              >
                <IconRefresh
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />{" "}
                {refreshing ? "Checking…" : "Check again"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const HeaderFallback = () => (
  <header
    data-tauri-drag-region
    className="drag-region flex h-[38px] shrink-0 items-center gap-3 border-b border-border bg-card p-0 pt-1 ml-[74px]"
  />
);

export function AppHeader(props: AppHeaderProps) {
  return (
    <ErrorBoundary fallback={<HeaderFallback />}>
      <AppHeaderInner {...props} />
    </ErrorBoundary>
  );
}
