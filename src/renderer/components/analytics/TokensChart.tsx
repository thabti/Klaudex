import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { AnalyticsEvent } from '@/types/analytics'
import { computeTokensByDay, computeTotalTokens } from '@/lib/analytics-aggregators'
import { ChartCard, StatRow, EmptyChart } from './ChartCard'

const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const TokensChart = ({ events }: { events: AnalyticsEvent[] }) => {
  const data = useMemo(() => computeTokensByDay(events), [events])
  const total = useMemo(() => computeTotalTokens(events), [events])

  return (
    <ChartCard title="Token usage">
      <StatRow label="Total tokens" value={fmtTokens(total)} />
      {data.length === 0 ? (
        <EmptyChart message="No token data yet" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtTokens} />
            <Tooltip contentStyle={{ fontSize: 11, background: 'var(--color-card)', border: '1px solid var(--color-border)' }} formatter={(v: number) => fmtTokens(v)} />
            <Bar dataKey="value" name="Tokens" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
