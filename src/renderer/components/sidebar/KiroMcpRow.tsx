import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { IconChevronRight, IconCircle, IconCheck, IconPlugOff, IconRefresh, IconBan, IconCircleCheck, IconTerminal } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useKiroStore } from '@/stores/kiroStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDebugStore } from '@/stores/debugStore'
import type { KiroMcpServer } from '@/types'
import { type ViewerState } from './kiro-config-helpers'

export const McpRow = memo(function McpRow({ server, onOpen }: { server: KiroMcpServer; onOpen: (v: ViewerState) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  const liveMcp = useSettingsStore((s) => s.liveMcpServers.find((m) => m.name === server.name))
  const commands = useSettingsStore((s) => s.availableCommands)
  const isReady = server.status === 'ready' || liveMcp?.status === 'ready'
  const hasTools = (liveMcp?.toolCount ?? 0) > 0
  const isExpandable = server.enabled && isReady && hasTools
  const allToolsDisabled = server.disabledTools?.includes('*')

  // Derive tool names from available commands (MCP tools use mcp__servername__toolname pattern)
  const serverTools = useMemo(() => commands.filter((c) => {
    const n = c.name.toLowerCase()
    const sn = server.name.toLowerCase().replace(/-/g, '_')
    return n.startsWith(`mcp__${sn}__`) || n.startsWith(`${sn}__`) || n.startsWith(`${sn}_`)
  }), [commands, server.name])

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    const dismiss = () => setCtxMenu(null)
    document.addEventListener('mousedown', handler)
    window.addEventListener('blur', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [ctxMenu])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Clamp position to keep menu within viewport
    const menuWidth = 180
    const menuHeight = 200
    const x = Math.min(e.clientX, window.innerWidth - menuWidth)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight)
    setCtxMenu({ x, y })
  }, [])

  const handleToggleEnabled = useCallback(() => {
    setCtxMenu(null)
    useKiroStore.getState().toggleMcpServer(server.name, server.enabled)
  }, [server.name, server.enabled])

  const handleDisableAllTools = useCallback(() => {
    setCtxMenu(null)
    useKiroStore.getState().setMcpDisabledTools(server.name, ['*'])
  }, [server.name])

  const handleEnableAllTools = useCallback(() => {
    setCtxMenu(null)
    useKiroStore.getState().setMcpDisabledTools(server.name, [])
  }, [server.name])

  const handleShowLogs = useCallback(() => {
    setCtxMenu(null)
    useDebugStore.getState().setFilter({ mcpServerName: server.name })
    useDebugStore.getState().setOpen(true)
  }, [server.name])

  const handleToggleTool = useCallback((toolName: string) => {
    const current = server.disabledTools ?? []
    const isDisabled = current.includes(toolName) || current.includes('*')
    let next: string[]
    if (current.includes('*')) {
      // Enabling one tool from "all disabled" → disable all except this one
      const allNames = serverTools.map((t) => t.name)
      next = allNames.filter((n) => n !== toolName)
    } else if (isDisabled) {
      next = current.filter((t) => t !== toolName)
    } else {
      next = [...current, toolName]
    }
    useKiroStore.getState().setMcpDisabledTools(server.name, next)
  }, [server.name, server.disabledTools, serverTools])

  const handleRowClick = useCallback(() => {
    if (isExpandable) {
      setExpanded((v) => !v)
    } else if (server.filePath) {
      onOpen({ filePath: server.filePath, title: `MCP: ${server.name}` })
    }
  }, [isExpandable, server.filePath, server.name, onOpen])

  // Status label
  let statusLabel: string | null = null
  let statusClass = ''
  if (!server.enabled) {
    statusLabel = 'Disabled'
    statusClass = 'text-muted-foreground italic'
  } else if (server.status === 'error' || server.status === 'needs-auth') {
    statusLabel = server.status === 'needs-auth' ? 'Auth required' : 'Error'
    statusClass = 'text-red-600 dark:text-red-400'
  } else if (isReady) {
    statusLabel = 'Connected'
    statusClass = 'text-emerald-600 dark:text-emerald-400'
  } else if (server.status === 'connecting') {
    statusLabel = 'Connecting…'
    statusClass = 'text-muted-foreground'
  }

  const dotClass = !server.enabled
    ? 'fill-muted-foreground/50 text-muted-foreground/50'
    : server.status === 'error' || server.status === 'needs-auth'
      ? 'fill-red-500 text-red-500'
      : isReady
        ? 'fill-emerald-500 text-emerald-500'
        : 'fill-muted-foreground text-muted-foreground'

  return (
    <>
      <li className="flex flex-col min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              onClick={handleRowClick}
              onContextMenu={handleContextMenu}
              onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
              className={cn(
                'flex h-6 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-[11px] cursor-pointer',
                'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
                !server.enabled && 'opacity-60',
              )}
            >
              {isExpandable ? (
                <IconChevronRight className={cn('size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150', expanded && 'rotate-90')} aria-hidden />
              ) : (
                <IconCircle className={cn('size-2 shrink-0', dotClass)} aria-hidden />
              )}
              <span className={cn('min-w-0 flex-1 truncate', !server.enabled && 'italic')}>{server.name}</span>
              {statusLabel && (
                <span className={cn('shrink-0 text-[9px] truncate max-w-[70px]', statusClass)}>
                  {statusLabel}
                </span>
              )}
              {isReady && !statusLabel && (
                <IconCheck className="size-3 shrink-0 text-emerald-500" aria-hidden />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[220px]">
            <p className="text-[11px] font-medium">{server.name}</p>
            <p className="text-[10px] text-muted-foreground">{server.transport} · {server.enabled ? 'enabled' : 'disabled'}</p>
            {allToolsDisabled && <p className="text-[10px] text-amber-600 dark:text-amber-400">All tools disabled</p>}
            {server.error && <p className="mt-0.5 text-[9px] text-muted-foreground font-mono truncate">{server.error}</p>}
          </TooltipContent>
        </Tooltip>

        {/* Expanded tool list */}
        {expanded && isExpandable && (
          <ul className="ml-4 flex flex-col gap-px py-0.5">
            {allToolsDisabled && (
              <li className="px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 italic">All tools disabled</li>
            )}
            {serverTools.length > 0 ? (
              serverTools.map((tool) => {
                const toolShort = tool.name.replace(/^mcp__[^_]+__/, '').replace(/^[^_]+__/, '')
                const isDisabled = allToolsDisabled || (server.disabledTools ?? []).includes(tool.name)
                return (
                  <li key={tool.name} className="flex items-center gap-1.5 px-1.5 h-5">
                    <button
                      type="button"
                      onClick={() => handleToggleTool(tool.name)}
                      className={cn(
                        'size-3 shrink-0 rounded border transition-colors',
                        isDisabled
                          ? 'border-muted-foreground/30 bg-transparent'
                          : 'border-emerald-500 bg-emerald-500',
                      )}
                      aria-label={isDisabled ? `Enable ${toolShort}` : `Disable ${toolShort}`}
                    >
                      {!isDisabled && <IconCheck className="size-2.5 text-white" />}
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('text-[10px] truncate', isDisabled && 'line-through text-muted-foreground/60')}>
                          {toolShort}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">{tool.description ?? tool.name}</TooltipContent>
                    </Tooltip>
                  </li>
                )
              })
            ) : (
              <li className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {liveMcp?.toolCount ?? 0} tools available
              </li>
            )}
          </ul>
        )}
      </li>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[300] min-w-[170px] rounded-lg border border-border bg-popover py-1 shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {server.enabled ? (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground cursor-not-allowed opacity-50"
                disabled
                title="Not yet supported"
              >
                <IconRefresh className="size-3.5" /> Reconnect
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-accent"
                onClick={handleToggleEnabled}
              >
                <IconPlugOff className="size-3.5" /> Disable
              </button>
              <div className="my-1 border-t border-border/50" />
              {!allToolsDisabled && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-accent"
                  onClick={handleDisableAllTools}
                >
                  <IconBan className="size-3.5" /> Disable All Tools
                </button>
              )}
              {(server.disabledTools?.length ?? 0) > 0 && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-accent"
                  onClick={handleEnableAllTools}
                >
                  <IconCircleCheck className="size-3.5" /> Enable All Tools
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-accent"
              onClick={handleToggleEnabled}
            >
              <IconCircleCheck className="size-3.5" /> Enable
            </button>
          )}
          <div className="my-1 border-t border-border/50" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-accent"
            onClick={handleShowLogs}
          >
            <IconTerminal className="size-3.5" /> Show MCP Logs
          </button>
        </div>
      )}
    </>
  )
})
