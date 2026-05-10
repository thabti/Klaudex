import { useMemo, useState } from 'react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'

/**
 * Two-line chart of additions and deletions per day.
 *
 * Ports `kirodex/src/renderer/components/analytics/DiffStatsChart.tsx`. Klaudex
 * does not depend on `recharts`, so we draw a small SVG line chart inline.
 *
 * Acceptance:
 *  - Two lines (additions + deletions) over a date X-axis
 *  - Hover tooltip shows daily counts
 *  - Single data point still renders (we draw a dot instead of a line)
 */

interface DayPoint {
  readonly day: string
  readonly additions: number
  readonly deletions: number
}

const dayKey = (ts: number): string => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`
}

const computeDiffStatsByDay = (events: AnalyticsEvent[]): DayPoint[] => {
  const map = new Map<string, { additions: number; deletions: number }>()
  for (const e of events) {
    const key = dayKey(e.ts)
    const cur = map.get(key) ?? { additions: 0, deletions: 0 }
    cur.additions += e.value ?? 0
    cur.deletions += e.value2 ?? 0
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([day, v]) => ({ day, additions: v.additions, deletions: v.deletions }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

const computeFilesEdited = (events: AnalyticsEvent[]): number =>
  new Set(events.map((e) => e.detail).filter(Boolean)).size

interface DiffStatsChartProps {
  readonly diffEvents: AnalyticsEvent[]
  readonly fileEvents: AnalyticsEvent[]
}

const CHART_W = 320
const CHART_H = 140
const PADDING_X = 28
const PADDING_Y = 14

export const DiffStatsChart = ({ diffEvents, fileEvents }: DiffStatsChartProps) => {
  const data = useMemo(() => computeDiffStatsByDay(diffEvents), [diffEvents])
  const totalAdditions = useMemo(
    () => data.reduce((s, p) => s + p.additions, 0),
    [data],
  )
  const totalDeletions = useMemo(
    () => data.reduce((s, p) => s + p.deletions, 0),
    [data],
  )
  const filesEdited = useMemo(() => computeFilesEdited(fileEvents), [fileEvents])

  const max = useMemo(() => {
    let m = 0
    for (const p of data) {
      if (p.additions > m) m = p.additions
      if (p.deletions > m) m = p.deletions
    }
    return m
  }, [data])

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const innerW = CHART_W - PADDING_X * 2
  const innerH = CHART_H - PADDING_Y * 2

  const xFor = (idx: number): number => {
    if (data.length <= 1) return PADDING_X + innerW / 2
    return PADDING_X + (idx / (data.length - 1)) * innerW
  }
  const yFor = (value: number): number => {
    if (max <= 0) return PADDING_Y + innerH
    return PADDING_Y + innerH - (value / max) * innerH
  }

  const additionsPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.additions)}`).join(' ')
  const deletionsPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.deletions)}`).join(' ')

  const hovered = hoverIdx !== null ? data[hoverIdx] ?? null : null

  return (
    <ChartCard title="Code changes">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Additions" value={`+${totalAdditions}`} color="text-emerald-500" />
        <Stat label="Deletions" value={`-${totalDeletions}`} color="text-red-400" />
        <Stat label="Files edited" value={filesEdited} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No diff data yet" />
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="h-[140px] w-full"
            role="img"
            aria-label="Additions and deletions per day"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* baseline */}
            <line
              x1={PADDING_X}
              x2={CHART_W - PADDING_X}
              y1={PADDING_Y + innerH}
              y2={PADDING_Y + innerH}
              className="stroke-border/40"
              strokeWidth={1}
            />

            {data.length === 1 ? (
              <>
                <circle cx={xFor(0)} cy={yFor(data[0]!.additions)} r={3.5} className="fill-emerald-500" />
                <circle cx={xFor(0)} cy={yFor(data[0]!.deletions)} r={3.5} className="fill-red-400" />
              </>
            ) : (
              <>
                <path d={additionsPath} className="fill-none stroke-emerald-500" strokeWidth={1.5} />
                <path d={deletionsPath} className="fill-none stroke-red-400" strokeWidth={1.5} />
              </>
            )}

            {/* invisible hover targets */}
            {data.map((_, i) => {
              const cellW = data.length === 1 ? innerW : innerW / Math.max(1, data.length - 1)
              return (
                <rect
                  key={i}
                  x={xFor(i) - cellW / 2}
                  y={PADDING_Y}
                  width={cellW}
                  height={innerH}
                  className="cursor-pointer fill-transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              )
            })}

            {hoverIdx !== null && data[hoverIdx] ? (
              <>
                <line
                  x1={xFor(hoverIdx)}
                  x2={xFor(hoverIdx)}
                  y1={PADDING_Y}
                  y2={PADDING_Y + innerH}
                  className="stroke-border/60"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={xFor(hoverIdx)} cy={yFor(data[hoverIdx]!.additions)} r={3} className="fill-emerald-500" />
                <circle cx={xFor(hoverIdx)} cy={yFor(data[hoverIdx]!.deletions)} r={3} className="fill-red-400" />
              </>
            ) : null}
          </svg>

          {hovered ? (
            <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border/40 bg-card px-2 py-1.5 text-[11px] shadow-sm">
              <div className="font-medium tabular-nums text-foreground">{hovered.day}</div>
              <div className="text-emerald-500 tabular-nums">+{hovered.additions}</div>
              <div className="text-red-400 tabular-nums">-{hovered.deletions}</div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <LegendDot color="bg-emerald-500" label="Additions" />
            <LegendDot color="bg-red-400" label="Deletions" />
          </div>
        </div>
      )}
    </ChartCard>
  )
}

const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className={`text-[15px] font-semibold tabular-nums ${color ?? 'text-foreground'}`}>
      {value}
    </span>
  </div>
)

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
    {message}
  </div>
)

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
    <span>{label}</span>
  </span>
)
