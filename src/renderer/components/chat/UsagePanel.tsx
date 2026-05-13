import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { PanelShell } from './PanelShell'

/** Format token counts as human-readable strings (e.g. 1.5K, 2.3M) */
export const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Format cost as USD with appropriate decimal places */
export const formatCost = (cost: number): string => {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

interface DonutSegment {
  readonly label: string
  readonly value: number
  readonly color: string
}

/** SVG donut chart rendered from segment data */
const DonutChart = memo(function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: readonly DonutSegment[]
  centerLabel: string
  centerValue: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  let accumulated = 0

  return (
    <svg viewBox="0 0 100 100" className="size-[88px]" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
      {/* Background ring */}
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth="10" opacity="0.3" />
      {/* Segments */}
      {total > 0 && segments.map((seg) => {
        if (seg.value <= 0) return null
        const pct = seg.value / total
        const dashLength = circumference * pct
        const dashOffset = circumference * (1 - accumulated / total)
        accumulated += seg.value
        return (
          <circle
            key={seg.label}
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            className="origin-center -rotate-90"
            style={{ transformOrigin: '50px 50px' }}
          />
        )
      })}
      {/* Center text */}
      <text x="50" y="46" textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{centerValue}</text>
      <text x="50" y="57" textAnchor="middle" className="fill-muted-foreground text-[7px]">{centerLabel}</text>
    </svg>
  )
})

interface BreakdownBarProps {
  readonly label: string
  readonly value: number
  readonly total: number
  readonly color: string
}

/** Single horizontal bar for a token category */
const BreakdownBar = memo(function BreakdownBar({ label, value, total, color }: BreakdownBarProps) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-foreground">{formatTokens(value)}</span>
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
})

export const UsagePanel = memo(function UsagePanel({ onDismiss }: { onDismiss: () => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const currentModel = useSettingsStore((s) => s.currentModelId)

  const entries = useMemo(() => {
    return Object.values(tasks)
      .filter((t) => t.contextUsage && t.contextUsage.size > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [tasks])

  const selectedTask = selectedTaskId ? tasks[selectedTaskId] : null
  const cu = selectedTask?.contextUsage
  const totalCost = selectedTask?.totalCost

  // Aggregate token breakdown for the selected task
  const inputTokens = cu?.inputTokens ?? 0
  const outputTokens = cu?.outputTokens ?? 0
  const cacheReadTokens = cu?.cacheReadTokens ?? 0
  const cacheCreationTokens = cu?.cacheCreationTokens ?? 0
  const hasBreakdown = inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreationTokens > 0

  // Donut segments for context usage
  const contextPct = cu && cu.size > 0 ? Math.round((cu.used / cu.size) * 100) : 0
  const donutSegments: DonutSegment[] = useMemo(() => {
    if (!hasBreakdown) {
      return [
        { label: 'Used', value: cu?.used ?? 0, color: '#3b82f6' },
        { label: 'Free', value: Math.max((cu?.size ?? 0) - (cu?.used ?? 0), 0), color: 'transparent' },
      ]
    }
    return [
      { label: 'Input', value: inputTokens, color: '#3b82f6' },
      { label: 'Output', value: outputTokens, color: '#8b5cf6' },
      { label: 'Cache read', value: cacheReadTokens, color: '#10b981' },
      { label: 'Cache write', value: cacheCreationTokens, color: '#f59e0b' },
    ]
  }, [hasBreakdown, cu?.used, cu?.size, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens])

  // Colors for breakdown bars
  const COLORS = {
    input: '#3b82f6',
    output: '#8b5cf6',
    cacheRead: '#10b981',
    cacheWrite: '#f59e0b',
  } as const

  return (
    <PanelShell onDismiss={onDismiss}>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Token Usage</span>
      </div>

      {/* Donut + summary */}
      {cu && cu.size > 0 ? (
        <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-3">
          <div className="flex items-center gap-4">
            <DonutChart
              segments={donutSegments}
              centerLabel="context"
              centerValue={`${contextPct}%`}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <div className="text-[11px] text-muted-foreground">Context window</div>
                <div className="text-[13px] font-medium tabular-nums text-foreground">
                  {formatTokens(cu.used)} / {formatTokens(cu.size)}
                </div>
              </div>
              {totalCost !== undefined && totalCost > 0 && (
                <div>
                  <div className="text-[11px] text-muted-foreground">Cost</div>
                  <div className="text-[13px] font-medium tabular-nums text-foreground">{formatCost(totalCost)}</div>
                </div>
              )}
              <div className="text-[10px] text-muted-foreground/70">{currentModel ?? 'unknown model'}</div>
            </div>
          </div>

          {/* Token breakdown bars */}
          {hasBreakdown && (
            <div className="mt-3 space-y-1.5 border-t border-border/30 pt-2.5">
              <BreakdownBar label="Input" value={inputTokens} total={cu.used} color={COLORS.input} />
              <BreakdownBar label="Output" value={outputTokens} total={cu.used} color={COLORS.output} />
              <BreakdownBar label="Cache read" value={cacheReadTokens} total={cu.used} color={COLORS.cacheRead} />
              <BreakdownBar label="Cache write" value={cacheCreationTokens} total={cu.used} color={COLORS.cacheWrite} />
            </div>
          )}
        </div>
      ) : (
        <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-muted-foreground">No usage data for current thread</span>
          </div>
        </div>
      )}

      {/* Per-task list */}
      {entries.length > 0 ? (
        <>
          <div className="px-3 pb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              All threads ({entries.length})
            </span>
          </div>
          <ul className="max-h-[160px] overflow-y-auto pb-1.5" role="list">
            {entries.map((task) => {
              const tcu = task.contextUsage!
              const pct = tcu.size > 0 ? (tcu.used / tcu.size) * 100 : 0
              const isSelected = task.id === selectedTaskId
              return (
                <li
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-[12px]',
                    isSelected ? 'bg-accent/50 text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('size-1.5 shrink-0 rounded-full', isSelected ? 'bg-primary' : 'bg-muted-foreground/30')} />
                      <span className="truncate">{task.name || task.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className="shrink-0 text-[11px] tabular-nums">{formatTokens(tcu.used)}</span>
                  {task.totalCost !== undefined && task.totalCost > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatCost(task.totalCost)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground/70">No usage data yet</p>
      )}
    </PanelShell>
  )
})
