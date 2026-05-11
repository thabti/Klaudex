import { useMemo } from 'react'
import type { AnalyticsEvent } from '@/types/analytics'
import { computeSlashCommandUsage } from '@/lib/analytics-aggregators'
import { ChartCard } from './ChartCard'
import { HorizontalBarSection } from './HorizontalBarSection'

export const SlashCommandChart = ({ events }: { events: AnalyticsEvent[] }) => {
  const data = useMemo(() => computeSlashCommandUsage(events), [events])
  return (
    <ChartCard title="Slash commands">
      <HorizontalBarSection data={data} fill="#f97316" emptyMessage="No slash command data yet" />
    </ChartCard>
  )
}
