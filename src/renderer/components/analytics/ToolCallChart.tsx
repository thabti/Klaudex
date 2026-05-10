import { useMemo } from 'react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'
import { HorizontalBarSection } from './HorizontalBarSection'

/**
 * TASK-035 — Tool call breakdown.
 *
 * Ports `kirodex/src/renderer/components/analytics/ToolCallChart.tsx`.
 * Klaudex differences vs kirodex source:
 *  - Reads `kind === 'tool_call'` events from `useAnalyticsStore` directly
 *    instead of taking pre-filtered events as props.
 *  - Klaudex's `<HorizontalBarSection>` primitive takes `{label, value,
 *    total}` per row (not a `Record<string, number>` like kirodex's), so the
 *    list of bars is rendered as a `<ul>` of rows.
 *  - Empty-state markup is inline since Klaudex's `ChartCard.tsx` doesn't
 *    export `EmptyChart` / `StatRow`.
 */

interface ToolRow {
  readonly name: string
  readonly count: number
}

const computeToolCallBreakdown = (events: AnalyticsEvent[]): { rows: ToolRow[]; total: number } => {
  const counts: Record<string, number> = {}
  let total = 0
  for (const e of events) {
    if (e.kind !== 'tool_call') continue
    const name = e.detail ?? 'unknown'
    counts[name] = (counts[name] ?? 0) + 1
    total += 1
  }
  const rows = Object.entries(counts)
    .map<ToolRow>(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  return { rows, total }
}

export const ToolCallChart = () => {
  const events = useAnalyticsStore((s) => s.events)
  const { rows, total } = useMemo(() => computeToolCallBreakdown(events), [events])

  const maxCount = useMemo(() => {
    let m = 0
    for (const r of rows) if (r.count > m) m = r.count
    return m
  }, [rows])

  return (
    <ChartCard title="Tool calls">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[12px] text-muted-foreground">Total tool calls</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {total.toLocaleString()}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
          No tool call data yet
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.name}>
              <HorizontalBarSection
                label={row.name}
                value={row.count}
                total={Math.max(maxCount, 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
