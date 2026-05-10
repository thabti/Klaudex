import { useMemo } from 'react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'
import { HorizontalBarSection } from './HorizontalBarSection'
import { useSettingsStore, type ModelOption } from '@/stores/settingsStore'

/**
 * Distribution of model usage as horizontal progress bars.
 *
 * Ports `kirodex/src/renderer/components/analytics/ModelPopularityChart.tsx`.
 * Klaudex's `HorizontalBarSection` is a single per-row component (not a
 * recharts wrapper like kirodex's), so we render one row per model.
 *
 * Acceptance:
 *  - Horizontal bars showing per-model message counts
 *  - Models not in `availableModels` render with raw ID + " (legacy)" suffix
 *  - Zero usage renders an empty state
 */

interface ModelRow {
  readonly id: string
  readonly label: string
  readonly count: number
}

const countByDetail = (events: AnalyticsEvent[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const e of events) {
    const key = e.detail ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const buildRows = (
  events: AnalyticsEvent[],
  availableModels: ModelOption[],
): ModelRow[] => {
  const counts = countByDetail(events)
  const known = new Map<string, ModelOption>()
  for (const m of availableModels) known.set(m.modelId, m)

  return Object.entries(counts)
    .map(([id, count]) => {
      const match = known.get(id)
      const label = match ? match.name : `${id} (legacy)`
      return { id, label, count }
    })
    .sort((a, b) => b.count - a.count)
}

interface ModelPopularityChartProps {
  readonly events: AnalyticsEvent[]
}

export const ModelPopularityChart = ({ events }: ModelPopularityChartProps) => {
  const availableModels = useSettingsStore((s) => s.availableModels)
  const rows = useMemo(() => buildRows(events, availableModels), [events, availableModels])
  const total = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows])

  return (
    <ChartCard title="Model popularity">
      {rows.length === 0 || total === 0 ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
          No model data yet
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <HorizontalBarSection
              key={row.id}
              label={row.label}
              value={row.count}
              total={total}
            />
          ))}
        </div>
      )}
    </ChartCard>
  )
}
