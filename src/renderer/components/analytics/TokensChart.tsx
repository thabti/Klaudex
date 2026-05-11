import { useMemo } from 'react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'

/**
 * TASK-034 — Token usage chart.
 *
 * Ports `kirodex/src/renderer/components/analytics/TokensChart.tsx` and
 * integrates with Klaudex's existing per-task token tracking (commit 7f03008).
 *
 * Klaudex token data flow:
 *  - `taskStore.tasks[].contextUsage` carries the current per-task breakdown:
 *    `{ used, size, inputTokens?, outputTokens?, cacheReadTokens?,
 *      cacheCreationTokens? }` — populated by `updateUsage()` from ACP usage
 *    notifications. This is the live-truth source for "total tokens" and is
 *    independent of the analytics event log.
 *  - `taskStore.tasks[].totalCost` is the cumulative cost in USD per task.
 *  - The analytics store also records `kind === 'token_usage'` events with
 *    `value = total tokens`, used here for the by-day time series.
 *
 * We sum `contextUsage.inputTokens + outputTokens + cacheReadTokens +
 * cacheCreationTokens` across all tasks for the headline total, fall back to
 * `contextUsage.used` when the breakdown isn't populated, and sum `totalCost`
 * across tasks for the cost line. The day-by-day SVG chart uses analytics
 * events because the live store doesn't track token deltas over time.
 *
 * No chart library in deps — the bar chart is hand-rolled SVG.
 */

interface DayValue {
  readonly day: string
  readonly value: number
}

const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

const fmtCost = (n: number): string => {
  if (n <= 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

/** Cheap day key that avoids `toISOString` allocations. */
const dayKey = (ts: number): string => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`
}

const computeTokensByDay = (events: AnalyticsEvent[]): DayValue[] => {
  const buckets = new Map<string, number>()
  for (const e of events) {
    if (e.kind !== 'token_usage') continue
    const key = dayKey(e.ts)
    buckets.set(key, (buckets.get(key) ?? 0) + (e.value ?? 0))
  }
  return [...buckets.entries()]
    .map<DayValue>(([day, value]) => ({ day, value }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

export const TokensChart = () => {
  const events = useAnalyticsStore((s) => s.events)
  const tasks = useTaskStore((s) => s.tasks)

  const data = useMemo(() => computeTokensByDay(events), [events])

  /**
   * Live totals from `taskStore.contextUsage` — the canonical token tracker
   * shipped in commit 7f03008. Prefer the per-component breakdown
   * (input + output + cacheRead + cacheCreation); fall back to `used` when
   * the breakdown fields aren't present.
   */
  const { totalTokens, totalCost } = useMemo(() => {
    let tokens = 0
    let cost = 0
    for (const id in tasks) {
      const t = tasks[id]
      if (!t) continue
      const cu = t.contextUsage
      if (cu) {
        const breakdown =
          (cu.inputTokens ?? 0) +
          (cu.outputTokens ?? 0) +
          (cu.cacheReadTokens ?? 0) +
          (cu.cacheCreationTokens ?? 0)
        tokens += breakdown > 0 ? breakdown : cu.used
      }
      if (typeof t.totalCost === 'number' && Number.isFinite(t.totalCost)) {
        cost += t.totalCost
      }
    }
    return { totalTokens: tokens, totalCost: cost }
  }, [tasks])

  const maxValue = useMemo(() => {
    let m = 0
    for (const d of data) if (d.value > m) m = d.value
    return m
  }, [data])

  const hasSeries = data.length > 0 && maxValue > 0
  const hasLiveTotal = totalTokens > 0

  return (
    <ChartCard title="Token usage">
      <div className="mb-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted-foreground">Total tokens</span>
          <span className="text-[15px] font-semibold tabular-nums text-foreground">
            {hasLiveTotal ? fmtTokens(totalTokens) : '—'}
          </span>
        </div>
        {totalCost > 0 ? (
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-muted-foreground">Est. cost</span>
            <span className="text-[15px] font-semibold tabular-nums text-amber-400">
              ~{fmtCost(totalCost)}
            </span>
          </div>
        ) : null}
      </div>
      {hasSeries ? (
        <TokensSparkline data={data} maxValue={maxValue} />
      ) : (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
          {hasLiveTotal ? 'No token history yet' : 'No token data yet'}
        </div>
      )}
      {totalCost > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground/50">
          Cost reported by the agent runtime, summed across all threads.
        </p>
      ) : null}
    </ChartCard>
  )
}

interface TokensSparklineProps {
  readonly data: readonly DayValue[]
  readonly maxValue: number
}

/** Hand-rolled SVG bar chart — recharts is not a dep. */
const TokensSparkline = ({ data, maxValue }: TokensSparklineProps) => {
  const height = 120
  const width = 100 // % — SVG viewBox so it scales responsively
  const barGap = 0.15
  const barWidth = (width - barGap * (data.length + 1)) / data.length
  const safeMax = Math.max(maxValue, 1)

  return (
    <svg
      role="img"
      aria-label="Token usage over time"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
    >
      {data.map((d, i) => {
        const h = (d.value / safeMax) * (height - 18)
        const x = barGap + i * (barWidth + barGap)
        const y = height - 14 - h
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 0.5)}
              rx={0.4}
              ry={0.4}
              className="fill-amber-500/80"
            >
              <title>{`${d.day}: ${fmtTokens(d.value)} tokens`}</title>
            </rect>
            {i === 0 || i === data.length - 1 ? (
              <text
                x={x + barWidth / 2}
                y={height - 3}
                textAnchor="middle"
                className="fill-muted-foreground/60"
                style={{ fontSize: '6px' }}
              >
                {d.day.slice(5)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
