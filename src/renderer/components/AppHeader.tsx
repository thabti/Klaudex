import { memo, useCallback, useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import {
  IconShieldCheck,
  IconList,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useTaskStore } from "@/stores/taskStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { WindowsControls } from "@/components/unified-title-bar/WindowsControls"
import { HeaderBreadcrumb } from "@/components/header-breadcrumb"
import { HeaderToolbar } from "@/components/header-toolbar"
import { HeaderGhostToolbar } from "@/components/header-ghost-toolbar"
import { HeaderUserMenu } from "@/components/header-user-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AppSettings } from "@/types"

// ── Platform detection ───────────────────────────────────────
type AppPlatform = "macos" | "windows" | "linux"

const detectPlatform = (): AppPlatform => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

const PLATFORM = detectPlatform()
const IS_MAC = PLATFORM === "macos"

// ── Permission mode chip (TASK-107) ──────────────────────────
// Local mirror of the Rust `PermissionMode` enum in
// `src-tauri/src/commands/settings.rs`. The shared `AppSettings` type in
// `types/index.ts` doesn't yet declare `permissions`, so we narrow at the
// boundary.
type PermissionMode = "ask" | "allowListed" | "bypass"
interface Permissions {
  mode: PermissionMode
  allow: string[]
  deny: string[]
}
type SettingsWithPermissions = AppSettings & { permissions?: Permissions }
type ProjectPrefsWithPermissions = {
  permissions?: Permissions
} & Record<string, unknown>

const DEFAULT_PERMISSIONS: Permissions = { mode: "ask", allow: [], deny: [] }

const MODE_DISPLAY: Record<
  PermissionMode,
  {
    Icon: typeof IconShieldCheck
    label: string
    chipClassName: string
    tooltip: string
  }
> = {
  ask: {
    Icon: IconShieldCheck,
    label: "Ask",
    chipClassName: "text-foreground/80 bg-muted hover:bg-muted/80",
    tooltip: "Ask before running tools — click to cycle (Ask → Listed → Bypass)",
  },
  allowListed: {
    Icon: IconList,
    label: "Listed",
    chipClassName: "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20",
    tooltip: "Auto-approve allow-listed tools — click to cycle (Listed → Bypass → Ask)",
  },
  bypass: {
    Icon: IconAlertTriangle,
    label: "Bypass",
    chipClassName: "text-red-400 bg-red-500/10 hover:bg-red-500/20",
    tooltip: "Bypassing permissions — click to cycle (Bypass → Ask → Listed)",
  },
}

const NEXT_MODE: Record<PermissionMode, PermissionMode> = {
  ask: "allowListed",
  allowListed: "bypass",
  bypass: "ask",
}

const selectPermissionMode = (
  s: ReturnType<typeof useSettingsStore.getState>,
): PermissionMode => {
  const settings = s.settings as SettingsWithPermissions
  const ws = s.activeWorkspace
  const projectPerms = ws
    ? (s.settings.projectPrefs?.[ws] as ProjectPrefsWithPermissions | undefined)
        ?.permissions
    : undefined
  if (projectPerms?.mode) return projectPerms.mode
  return settings.permissions?.mode ?? "ask"
}

/** Apply a new permission mode at the active scope (project override if a
 *  workspace is selected, otherwise global). Reverts on persistence failure
 *  and surfaces a toast. Returns the previous mode so callers can chain. */
const setPermissionMode = async (nextMode: PermissionMode): Promise<void> => {
  const { settings, activeWorkspace, setProjectPref, saveSettings } =
    useSettingsStore.getState()
  const settingsWithPerms = settings as SettingsWithPermissions
  const globalPerms = settingsWithPerms.permissions ?? DEFAULT_PERMISSIONS
  const projectPerms = activeWorkspace
    ? (
        settings.projectPrefs?.[activeWorkspace] as
          | ProjectPrefsWithPermissions
          | undefined
      )?.permissions
    : undefined
  const currentScope: Permissions = projectPerms ?? globalPerms
  const previousMode: PermissionMode = currentScope.mode ?? "ask"
  if (previousMode === nextMode) return
  const nextScope: Permissions = { ...currentScope, mode: nextMode }

  try {
    if (activeWorkspace) {
      // setProjectPref persists to disk via ipc.saveSettings internally; if
      // that throws asynchronously it's swallowed. We additionally
      // round-trip via saveSettings to surface failure for the toast path.
      setProjectPref(
        activeWorkspace,
        { permissions: nextScope } as unknown as Parameters<typeof setProjectPref>[1],
      )
    } else {
      const nextSettings: SettingsWithPermissions = {
        ...settingsWithPerms,
        permissions: nextScope,
      }
      await saveSettings(nextSettings as AppSettings)
    }
  } catch (err) {
    console.warn("[permissions] save failed, reverting", err)
    toast.error("Failed to update permission mode")
    // Revert by re-applying the previous mode at the same scope.
    if (activeWorkspace) {
      setProjectPref(
        activeWorkspace,
        { permissions: { ...currentScope, mode: previousMode } } as unknown as Parameters<typeof setProjectPref>[1],
      )
    }
  }
}

const PermissionModeChip = memo(function PermissionModeChip() {
  const mode = useSettingsStore(selectPermissionMode)
  const display = MODE_DISPLAY[mode]
  const Icon = display.Icon

  const handleClick = useCallback(() => {
    void setPermissionMode(NEXT_MODE[mode])
  }, [mode])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          data-testid="permission-mode-chip"
          data-mode={mode}
          aria-label={`Permission mode: ${display.label}. Click to cycle.`}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
            display.chipClassName,
          )}
        >
          <Icon className="size-3.5" />
          <span>{display.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {display.tooltip}
      </TooltipContent>
    </Tooltip>
  )
})

const BypassBanner = memo(function BypassBanner() {
  const mode = useSettingsStore(selectPermissionMode)
  if (mode !== "bypass") return null

  const handleDisable = () => {
    void setPermissionMode("ask")
  }

  return (
    <div
      data-testid="bypass-banner"
      role="status"
      aria-live="polite"
      className="flex h-6 shrink-0 items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/10 px-3 text-[11px] text-red-300"
    >
      <span className="flex items-center gap-1.5">
        <IconAlertTriangle className="size-3.5" aria-hidden />
        <span>
          Bypassing permissions — anything the agent runs is auto-approved
        </span>
      </span>
      <button
        type="button"
        onClick={handleDisable}
        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-500/20 hover:text-red-100"
      >
        Disable
      </button>
    </div>
  )
})

// ── Window drag handler ──────────────────────────────────────
const INTERACTIVE =
  'button, a, input, textarea, select, [role="button"], [data-no-drag]'

const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest(INTERACTIVE)) return
  if (e.detail === 2) {
    getCurrentWindow().toggleMaximize()
  } else {
    getCurrentWindow().startDragging()
  }
}

// ── AppHeader ─────────────────────────────────────────────────────────
interface AppHeaderProps {
  sidePanelOpen: boolean
  onToggleSidePanel: () => void
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  sidebarPosition?: "left" | "right"
}

const AppHeaderInner = memo(function AppHeaderInner({
  sidePanelOpen,
  onToggleSidePanel,
  isSidebarCollapsed,
  onToggleSidebar,
  sidebarPosition = "left",
}: AppHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!IS_MAC) return
    getCurrentWindow().isFullscreen().then(setIsFullscreen).catch(() => {})
    let unlisten: (() => void) | undefined
    getCurrentWindow().onResized(() => {
      getCurrentWindow().isFullscreen().then(setIsFullscreen).catch(() => {})
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  const taskWorkspace = useTaskStore((s) => {
    const id = s.selectedTaskId
    return id ? s.tasks[id]?.workspace : null
  })
  const pendingWorkspace = useTaskStore((s) => s.pendingWorkspace)
  const workspace = taskWorkspace ?? pendingWorkspace

  return (
    <>
      <header
        data-testid="app-header"
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        className={cn(
          "flex h-[38px] shrink-0 items-center gap-3 border-b border-border bg-background p-0 pt-1 select-none [-webkit-user-select:none]",
          IS_MAC ? (isFullscreen ? "pl-2 pr-2" : "pl-[74px] pr-2") : "pl-2 pr-[138px]",
        )}
      >
        {/* Breadcrumb left */}
        <HeaderBreadcrumb
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
          sidebarPosition={sidebarPosition}
          isMac={IS_MAC}
        />

        {/* Actions right */}
        {!workspace && <HeaderGhostToolbar />}
        {workspace && (
          <HeaderToolbar
            workspace={workspace}
            sidePanelOpen={sidePanelOpen}
            onToggleSidePanel={onToggleSidePanel}
          />
        )}

        {/* Permission mode chip */}
        <PermissionModeChip />

        {/* User menu */}
        <HeaderUserMenu />

        {/* Window controls for Windows/Linux */}
        {!IS_MAC && (
          <div className="fixed top-0 right-0 z-50">
            <WindowsControls />
          </div>
        )}
      </header>
      <BypassBanner />
    </>
  )
})

const HeaderFallback = () => (
  <header
    data-tauri-drag-region
    className={cn(
      "drag-region flex h-[38px] shrink-0 items-center gap-3 border-b border-border bg-card p-0 pt-1",
      IS_MAC ? "ml-[74px]" : "ml-2 mr-[138px]",
    )}
  />
)

export function AppHeader(props: AppHeaderProps) {
  return (
    <ErrorBoundary fallback={<HeaderFallback />}>
      <AppHeaderInner {...props} />
    </ErrorBoundary>
  )
}
