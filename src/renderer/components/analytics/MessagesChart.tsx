import { useMemo } from 'react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'

/**
 * Daily message count chart (sent + received bars per day).
 *
 * Ports `kirodex/src/renderer/components/analytics/MessagesChart.tsx`. We can
 * not depend on `recharts`, so we render bars with Tailwind utility classes.
 *
 * Acceptance:
 *  - Bar/line chart of daily message totals
 *  - Weekend (and any) gap days render as 0, not skipped/interpolated
 *  - Empty data renders an empty state, no crash
 */

interface DayBucket {
  readonly day: string
  readonly sent: number
  readonly received: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const dayKey = (ts: number): string => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`
}

/** Generate every day key in [start, end] inclusive, gap-free (weekends → 0). */
const enumerateDays = (startMs: number, endMs: number): string[] => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return []
  const out: string[] = []
  // Anchor to local midnight to avoid off-by-one DST drift.
  const start = new Date(startMs)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endMs)
  end.setHours(0, 0, 0, 0)
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    out.push(dayKey(t))
  }
  return out
}

const computeMessagesByDay = (
  sent: AnalyticsEvent[],
  received: AnalyticsEvent[],
): DayBucket[] => {
  if (sent.length === 0 && received.length === 0) return []

  const sentByDay = new Map<string, number>()
  const recvByDay = new Map<string, number>()
  let minTs = Infinity
  let maxTs = -Infinity
  const observe = (ts: number): void => {
    if (ts < minTs) minTs = ts
    if (ts > maxTs) maxTs = ts
  }
  for (const e of sent) {
    sentByDay.set(dayKey(e.ts), (sentByDay.get(dayKey(e.ts)) ?? 0) + 1)
    observe(e.ts)
  }
  for (const e of received) {
    recvByDay.set(dayKey(e.ts), (recvByDay.get(dayKey(e.ts)) ?? 0) + 1)
    observe(e.ts)
  }

  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return []

  // Fill the full range so weekend/gap days render as 0 bars.
  return enumerateDays(minTs, maxTs).map((day) => ({
    day,
    sent: sentByDay.get(day) ?? 0,
    received: recvByDay.get(day) ?? 0,
  }))
}

const fmtNum = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

const sumValue = (events: AnalyticsEvent[]): number => {
  let s = 0
  for (const e of events) s += e.value ?? 0
  return s
}

interface MessagesChartProps {
  readonly sent: AnalyticsEvent[]
  readonly received: AnalyticsEvent[]
}

export const MessagesChart = ({ sent, received }: MessagesChartProps) => {
  const data = useMemo(() => computeMessagesByDay(sent, received), [sent, received])
  const totalMessages = sent.length + received.length
  const inputWords = useMemo(() => sumValue(sent), [sent])
  const outputWords = useMemo(() => sumValue(received), [received])

  const max = useMemo(
    () => data.reduce((m, p) => Math.max(m, p.sent, p.received), 0),
    [data],
  )

  return (
    <ChartCard title="Messages & words">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Messages" value={totalMessages} />
        <Stat label="Input words" value={fmtNum(inputWords)} />
        <Stat label="Output words" value={fmtNum(outputWords)} />
      </div>

      {data.length === 0 ? (
        <EmptyState message="No messages yet" />
      ) : (
        <div>
          <div className="flex h-[140px] items-end gap-[3px]">
            {data.map((p) => {
              const sentH = max > 0 ? (p.sent / max) * 100 : 0
              const recvH = max > 0 ? (p.received / max) * 100 : 0
              return (
                <div
                  key={p.day}
                  className="group relative flex h-full min-w-[4px] flex-1 items-end gap-[2px]"
                  title={`${p.day}\nSent: ${p.sent}\nReceived: ${p.received}`}
                >
                  <div
                    className="flex-1 rounded-t bg-emerald-500/80 transition-all group-hover:bg-emerald-500"
                    style={{ height: `${sentH}%` }}
                    aria-label={`Sent ${p.sent}`}
                  />
                  <div
                    className="flex-1 rounded-t bg-blue-500/80 transition-all group-hover:bg-blue-500"
                    style={{ height: `${recvH}%` }}
                    aria-label={`Received ${p.received}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
            <LegendDot color="bg-emerald-500" label="Sent" />
            <LegendDot color="bg-blue-500" label="Received" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] tabular-nums text-muted-foreground/60">
            <span>{data[0]?.day.slice(5)}</span>
            <span>{data[data.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      )}
    </ChartCard>
  )
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-[15px] font-semibold tabular-nums text-foreground">{value}</span>
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
