import { useMemo } from 'react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'
import { cn } from '@/lib/utils'

/**
 * Hour-of-day heatmap of coding activity.
 *
 * Ports `kirodex/src/renderer/components/analytics/CodingHoursChart.tsx` but the
 * task spec for TASK-027 mandates a 24-cell hour-of-day heatmap (0–23) rather
 * than kirodex's per-day bar chart. We bucket each session event's `ts` by its
 * local hour-of-day, then color-scale each cell to the dataset max.
 *
 * Empty dataset: renders all 24 cells in their resting state — no NaN/Infinity
 * leaks into the alpha channel and no error is thrown.
 */

const HOURS_IN_DAY = 24

const hourOfDay = (ts: number): number => {
  const d = new Date(ts)
  const h = d.getHours()
  if (Number.isFinite(h) && h >= 0 && h <= 23) return h
  return 0
}

interface HourBucket {
  readonly hour: number
  readonly value: number
}

const computeCodingHoursByHour = (events: AnalyticsEvent[]): HourBucket[] => {
  const counts = new Array<number>(HOURS_IN_DAY).fill(0)
  for (const e of events) {
    // Prefer event `value` (seconds) when present so duration-weighted; fall
    // back to a count-of-1 so empty `value` events still register on the map.
    const weight = typeof e.value === 'number' && Number.isFinite(e.value) && e.value > 0 ? e.value : 1
    counts[hourOfDay(e.ts)] += weight
  }
  return counts.map((value, hour) => ({ hour, value }))
}

const formatHour = (hour: number): string => {
  if (hour === 0) return '12a'
  if (hour === 12) return '12p'
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

interface CodingHoursChartProps {
  readonly events: AnalyticsEvent[]
}

export const CodingHoursChart = ({ events }: CodingHoursChartProps) => {
  const buckets = useMemo(() => computeCodingHoursByHour(events), [events])
  const max = useMemo(() => buckets.reduce((m, b) => (b.value > m ? b.value : m), 0), [buckets])
  const hasData = max > 0

  return (
    <ChartCard title="Coding hours">
      <div className="grid grid-cols-12 gap-1.5" role="grid" aria-label="Activity by hour of day">
        {buckets.map((b) => {
          const ratio = hasData ? b.value / max : 0
          // Clamp to a visible-but-quiet floor so empty cells stay legible.
          const opacity = hasData ? Math.max(0.08, ratio) : 0.08
          return (
            <div
              key={b.hour}
              role="gridcell"
              aria-label={`${formatHour(b.hour)}: ${b.value.toFixed(1)}`}
              title={`${formatHour(b.hour)} — ${b.value.toFixed(1)}`}
              className={cn(
                'flex aspect-square items-end justify-center rounded-md border border-border/40 bg-indigo-500',
                'transition-opacity',
              )}
              style={{ opacity }}
            >
              <span className="pb-0.5 text-[9px] font-medium tabular-nums text-white/90">
                {formatHour(b.hour)}
              </span>
            </div>
          )
        })}
      </div>
      {!hasData ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground/60">
          No session data yet
        </p>
      ) : null}
    </ChartCard>
  )
}
