import { memo } from 'react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settingsStore'
import type { SlashPanel } from '@/hooks/useSlashAction'

// ── Status dot colors ───────────────────────────────────────────────
const STATUS_DOT: Record<string, { cls: string; label: string }> = {
  running:    { cls: 'bg-emerald-400', label: 'running' },
  loading:    { cls: 'bg-amber-400 animate-pulse', label: 'loading' },
  error:      { cls: 'bg-red-400', label: 'error' },
  'needs-auth': { cls: 'bg-red-400', label: 'needs auth' },
}

// ── Model picker panel ──────────────────────────────────────────────
const ModelPickerPanel = memo(function ModelPickerPanel({ onDismiss }: { onDismiss: () => void }) {
  const models = useSettingsStore((s) => s.availableModels)
  const currentId = useSettingsStore((s) => s.currentModelId)

  const handleSelect = (modelId: string) => {
    const { activeWorkspace, setProjectPref } = useSettingsStore.getState()
    if (activeWorkspace) {
      setProjectPref(activeWorkspace, { modelId })
    } else {
      useSettingsStore.setState({ currentModelId: modelId })
    }
    onDismiss()
  }

  if (models.length === 0) return (
    <PanelShell>
      <p className="px-3 py-3 text-xs text-muted-foreground/70">No models available</p>
    </PanelShell>
  )

  return (
    <PanelShell>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Models</span>
      </div>
      <ul className="max-h-[200px] overflow-y-auto pb-1">
        {models.map((m) => {
          const isActive = m.modelId === currentId
          return (
            <li
              key={m.modelId}
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(m.modelId) }}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <span className={cn('size-1.5 shrink-0 rounded-full', isActive ? 'bg-primary' : 'bg-transparent')} />
              <span className={cn('flex-1 truncate', isActive && 'font-medium')}>{m.name}</span>
              {isActive && <span className="text-[10px] text-primary/60">active</span>}
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
})

// ── Agent / MCP server list panel ───────────────────────────────────
const AgentListPanel = memo(function AgentListPanel() {
  const servers = useSettingsStore((s) => s.liveMcpServers)

  if (servers.length === 0) return (
    <PanelShell>
      <p className="px-3 py-3 text-xs text-muted-foreground/70">No MCP servers connected</p>
    </PanelShell>
  )

  return (
    <PanelShell>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">MCP Servers</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto pb-1">
        <div className="grid grid-cols-[1fr_80px_70px] gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          <span>Name</span>
          <span>Status</span>
          <span className="text-right">Tools</span>
        </div>
        {servers.map((server) => {
          const dot = STATUS_DOT[server.status] ?? STATUS_DOT.loading
          return (
            <div
              key={server.name}
              className="grid grid-cols-[1fr_80px_70px] gap-2 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              <span className="truncate text-foreground/90">{server.name}</span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-1.5 shrink-0 rounded-full', dot.cls)} />
                <span className="text-[11px]">{dot.label}</span>
              </span>
              <span className="text-right text-[11px] text-muted-foreground/70">
                {server.toolCount > 0 ? `${server.toolCount} tools` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </PanelShell>
  )
})

// ── Shared panel shell ──────────────────────────────────────────────
function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-[300] mb-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
      {children}
    </div>
  )
}

// ── Exported dispatcher ─────────────────────────────────────────────
export const SlashActionPanel = memo(function SlashActionPanel({
  panel,
  onDismiss,
}: {
  panel: SlashPanel
  onDismiss: () => void
}) {
  if (panel === 'model') return <ModelPickerPanel onDismiss={onDismiss} />
  if (panel === 'agent') return <AgentListPanel />
  return null
})
