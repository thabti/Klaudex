import { memo, useId } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/stores/taskStore'
import { formatTokens, formatCost } from './UsagePanel'
import type { CompactionStatus } from '@/types'

type ColorTier = {
  from: string
  to: string
  text: string
  trackTint: string
}

// Gradient palette per fill tier — keeps the existing thresholds (50/80) but makes each tier
// distinct and lively rather than a single flat stroke colour.
const TIERS = {
  compacting: { from: '#60a5fa', to: '#a855f7', text: 'text-blue-400', trackTint: 'rgba(96,165,250,0.22)' }, // blue → purple
  low:        { from: '#34d399', to: '#22d3ee', text: 'text-emerald-400', trackTint: 'rgba(52,211,153,0.20)' }, // emerald → cyan
  mid:        { from: '#fbbf24', to: '#fb923c', text: 'text-amber-400', trackTint: 'rgba(251,191,36,0.22)' }, // amber → orange
  high:       { from: '#f87171', to: '#ec4899', text: 'text-red-400', trackTint: 'rgba(248,113,113,0.24)' }, // red → pink
} as const satisfies Record<string, ColorTier>

export const ContextRing = memo(function ContextRing({ used, size, compactionStatus }: { used: number; size: number; compactionStatus?: CompactionStatus }) {
  const isPercentage = size === 100 && used <= 100
  const pct = isPercentage ? Math.round(used) : size > 0 ? Math.round((used / size) * 100) : 0
  const r = 9.75
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * Math.min(pct, 100)) / 100
  const isCompacting = compactionStatus === 'compacting'
  const gradId = useId()

  // Narrow selectors for tooltip extras (breakdown, cost, message count)
  const taskId = useTaskStore((s) => s.selectedTaskId)
  const breakdown = useTaskStore((s) => (taskId ? s.tasks[taskId]?.contextUsage ?? null : null))
  const cost = useTaskStore((s) => (taskId ? s.tasks[taskId]?.totalCost ?? 0 : 0))
  const messageCount = useTaskStore((s) => (taskId ? s.tasks[taskId]?.messages?.length ?? 0 : 0))

  const tier: ColorTier =
    isCompacting ? TIERS.compacting :
    pct < 50 ? TIERS.low :
    pct < 80 ? TIERS.mid :
    TIERS.high

  const isHot = !isCompacting && pct >= 80

  // Auto-compact estimate using messages.length / 2 as a turn proxy.
  const turnsSoFar = Math.max(1, Math.floor(messageCount / 2))
  const avgPctPerTurn = pct / turnsSoFar
  const turnsUntilCompact = avgPctPerTurn > 0
    ? Math.max(0, Math.floor((100 - pct) / avgPctPerTurn))
    : 5
  const compactLabel = pct >= 95 || turnsUntilCompact === 0 ? 'soon' : `~${turnsUntilCompact} turns`

  const hasBreakdown =
    !!breakdown && (
      breakdown.inputTokens != null ||
      breakdown.outputTokens != null ||
      breakdown.cacheReadTokens != null ||
      breakdown.cacheCreationTokens != null
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="context-ring"
          className={cn(
            'relative flex h-7 w-7 cursor-default items-center justify-center rounded-full bg-card',
            isCompacting && 'animate-pulse',
            isHot && 'animate-pulse',
          )}
        >
          <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tier.from} />
                <stop offset="100%" stopColor={tier.to} />
              </linearGradient>
            </defs>
            {/* Track — tinted to the active tier so the unfilled portion still hints at state */}
            <circle cx="12" cy="12" r={r} fill="none" stroke={tier.trackTint} strokeWidth="2.5" />
            {/* Progress arc */}
            <circle
              cx="12" cy="12" r={r} fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <span className={cn('relative text-[8px] font-semibold tabular-nums', tier.text)}>
            {isCompacting ? '...' : pct}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-[11px] space-y-1">
        <div className="font-medium">
          {isCompacting
            ? 'Compacting context…'
            : `Context: ${pct}% used · ${Math.round(used / 1000)}k / ${Math.round(size / 1000)}k tokens`}
        </div>
        {hasBreakdown && breakdown && (
          <div className="grid grid-cols-2 gap-x-3 text-muted-foreground">
            {breakdown.inputTokens != null && <span>input: {formatTokens(breakdown.inputTokens)}</span>}
            {breakdown.outputTokens != null && <span>output: {formatTokens(breakdown.outputTokens)}</span>}
            {breakdown.cacheReadTokens != null && <span>cache read: {formatTokens(breakdown.cacheReadTokens)}</span>}
            {breakdown.cacheCreationTokens != null && <span>cache write: {formatTokens(breakdown.cacheCreationTokens)}</span>}
          </div>
        )}
        {cost > 0 && <div className="text-muted-foreground">cost: {formatCost(cost)}</div>}
        {!isCompacting && <div className="text-muted-foreground">auto-compact in {compactLabel}</div>}
      </TooltipContent>
    </Tooltip>
  )
})
