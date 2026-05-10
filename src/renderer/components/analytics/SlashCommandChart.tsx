import { useMemo } from 'react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'
import { HorizontalBarSection } from './HorizontalBarSection'

/**
 * TASK-033 — Slash command usage by mode.
 *
 * Ports `kirodex/src/renderer/components/analytics/SlashCommandChart.tsx`.
 * Klaudex differences vs kirodex source:
 *  - Reads `kind === 'slash_cmd'` events from `useAnalyticsStore` directly
 *    instead of taking pre-filtered events as props.
 *  - Renders rows of `<HorizontalBarSection>` instead of a recharts stacked
 *    bar (no chart library in deps). Each row shows the total count for the
 *    command; the mode split (command vs plan) is rendered as inline pills
 *    underneath since the primitive only supports a single value/total pair.
 */

interface SlashRow {
  readonly name: string
  readonly command: number
  readonly plan: number
  readonly total: number
}

/** Parse slash_cmd detail field. New format: "name:mode", legacy: "name". */
const parseSlashDetail = (detail: string): { name: string; mode: 'plan' | 'command' | 'unknown' } => {
  const idx = detail.lastIndexOf(':')
  if (idx > 0) {
    const tail = detail.slice(idx + 1)
    if (tail === 'plan' || tail === 'command') {
      return { name: detail.slice(0, idx), mode: tail }
    }
  }
  return { name: detail, mode: 'unknown' }
}

const computeSlashCommandUsage = (events: AnalyticsEvent[]): SlashRow[] => {
  const byMode: Record<string, { command: number; plan: number }> = {}
  for (const e of events) {
    if (e.kind !== 'slash_cmd') continue
    const { name, mode } = parseSlashDetail(e.detail ?? 'unknown')
    if (!byMode[name]) byMode[name] = { command: 0, plan: 0 }
    if (mode === 'plan') byMode[name].plan += 1
    else byMode[name].command += 1
  }
  return Object.entries(byMode)
    .map<SlashRow>(([name, counts]) => ({
      name,
      command: counts.command,
      plan: counts.plan,
      total: counts.command + counts.plan,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}

export const SlashCommandChart = () => {
  const events = useAnalyticsStore((s) => s.events)
  const rows = useMemo(() => computeSlashCommandUsage(events), [events])

  const maxTotal = useMemo(() => {
    let m = 0
    for (const r of rows) if (r.total > m) m = r.total
    return m
  }, [rows])

  if (rows.length === 0) {
    return (
      <ChartCard title="Slash commands by mode">
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
          No slash command data yet
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Slash commands by mode">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.name} className="flex flex-col gap-1">
            <HorizontalBarSection
              label={row.name}
              value={row.total}
              total={Math.max(maxTotal, 1)}
            />
            <div className="flex items-center gap-2 pl-0.5 text-[10px] text-muted-foreground/70">
              {row.command > 0 ? (
                <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-orange-300">
                  command {row.command}
                </span>
              ) : null}
              {row.plan > 0 ? (
                <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-violet-300">
                  plan {row.plan}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
