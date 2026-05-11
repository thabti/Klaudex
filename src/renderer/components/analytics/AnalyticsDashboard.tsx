import { memo, useEffect, useMemo } from 'react'
import { IconArrowLeft, IconChartBar, IconClock } from '@tabler/icons-react'
import { useAnalyticsStore, type TimeRange } from '@/stores/analyticsStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChartCard } from './ChartCard'
import { CodingHoursChart } from './CodingHoursChart'
import { MessagesChart } from './MessagesChart'
import { TokensChart } from './TokensChart'
import { DiffStatsChart } from './DiffStatsChart'
import { ModelPopularityChart } from './ModelPopularityChart'
import { SlashCommandChart } from './SlashCommandChart'
import { ToolCallChart } from './ToolCallChart'
import { ProjectStatsChart } from './ProjectStatsChart'
import { cn } from '@/lib/utils'

/**
 * TASK-036 — Top-level analytics dashboard container.
 *
 * Ports `kirodex/src/renderer/components/analytics/AnalyticsDashboard.tsx` to
 * Klaudex. Differences vs kirodex:
 *
 *  - Klaudex has no shared `lib/analytics-aggregators.ts` (the wave-4 chart
 *    agents inlined their own aggregators per-file). The single-pass kind →
 *    bucket partition is reproduced inline below so charts that take pre-
 *    filtered slices (CodingHours, Messages, DiffStats, ModelPopularity)
 *    avoid an O(n * k) scan; the four self-binding charts (Tokens,
 *    SlashCommand, ToolCall, ProjectStats) read the store directly and
 *    don't need the partition.
 *  - Klaudex's wave-4 charts are eagerly imported because none of them
 *    pull in heavy chart libraries (recharts is not a dep — every chart
 *    is hand-rolled SVG / CSS bars). The kirodex `lazy()` + `Suspense`
 *    boundary doesn't earn its weight here, so we drop it.
 *  - TASK-031 (ModeUsageChart) is deferred because it's blocked on TASK-003
 *    (live Claude CLI mode-ID capture). The "Mode usage" slot renders a
 *    placeholder card so the dashboard layout still has 9 sections.
 *  - Klaudex's `View` union is `'chat' | 'dashboard'` (see
 *    `task-store-types.ts`). `setView('chat')` is the safe back-target;
 *    TASK-037 (next wave) will mount this component from `App.tsx` and
 *    extend the union to include an analytics view.
 */

const RANGES: { label: string; value: TimeRange }[] = [
  { label: 'All Time', value: 'all' },
  { label: '30 Days', value: '30d' },
  { label: '7 Days', value: '7d' },
]

interface PartitionedEvents {
  readonly session: AnalyticsEvent[]
  readonly message_sent: AnalyticsEvent[]
  readonly message_received: AnalyticsEvent[]
  readonly diff_stats: AnalyticsEvent[]
  readonly file_edited: AnalyticsEvent[]
  readonly model_used: AnalyticsEvent[]
}

const EMPTY_PARTITION: PartitionedEvents = {
  session: [],
  message_sent: [],
  message_received: [],
  diff_stats: [],
  file_edited: [],
  model_used: [],
}

/**
 * Single-pass O(n) partition. Only buckets the kinds the prop-taking charts
 * care about — the rest read the unioned `events` array straight from the
 * store. This keeps the dashboard linear in event count even as the chart
 * matrix grows.
 */
const partitionEvents = (events: AnalyticsEvent[]): PartitionedEvents => {
  const session: AnalyticsEvent[] = []
  const message_sent: AnalyticsEvent[] = []
  const message_received: AnalyticsEvent[] = []
  const diff_stats: AnalyticsEvent[] = []
  const file_edited: AnalyticsEvent[] = []
  const model_used: AnalyticsEvent[] = []
  for (const e of events) {
    switch (e.kind) {
      case 'session':
        session.push(e)
        break
      case 'message_sent':
        message_sent.push(e)
        break
      case 'message_received':
        message_received.push(e)
        break
      case 'diff_stats':
        diff_stats.push(e)
        break
      case 'file_edited':
        file_edited.push(e)
        break
      case 'model_used':
        model_used.push(e)
        break
      default:
        break
    }
  }
  return { session, message_sent, message_received, diff_stats, file_edited, model_used }
}

export const AnalyticsDashboard = memo(function AnalyticsDashboard() {
  const events = useAnalyticsStore((s) => s.events)
  const isLoaded = useAnalyticsStore((s) => s.isLoaded)
  const timeRange = useAnalyticsStore((s) => s.timeRange)
  const setTimeRange = useAnalyticsStore((s) => s.setTimeRange)
  const loadEvents = useAnalyticsStore((s) => s.loadEvents)
  const setView = useTaskStore((s) => s.setView)

  // Hydrate once on mount when the store hasn't loaded yet. The store guards
  // against duplicate loads internally via `isLoaded`, but we also short-
  // circuit here so re-mounts (HMR, panel toggles) don't re-fetch.
  useEffect(() => {
    if (!isLoaded) {
      void loadEvents()
    }
    // We intentionally only watch `isLoaded`/`loadEvents`; if the user clears
    // analytics data (`clearData()`), the store sets `events: []` while
    // keeping `isLoaded: true`, so we don't want to re-hydrate from this hook.
  }, [isLoaded, loadEvents])

  const partition = useMemo(() => (events.length === 0 ? EMPTY_PARTITION : partitionEvents(events)), [events])

  const handleBack = (): void => {
    setView('chat')
  }

  const isEmpty = isLoaded && events.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Back to chat"
        >
          <IconArrowLeft size={16} stroke={1.5} />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <IconChartBar size={18} stroke={1.5} className="text-primary" />
          <h1 className="text-[15px] font-semibold">Analytics</h1>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted/40 p-0.5" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={timeRange === r.value}
              onClick={() => setTimeRange(r.value)}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-medium transition-colors',
                timeRange === r.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          {!isLoaded ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              Loading analytics...
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <IconChartBar size={40} stroke={1} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No analytics data yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Start chatting to populate your usage stats
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <CodingHoursChart events={partition.session} />
              <MessagesChart sent={partition.message_sent} received={partition.message_received} />
              <TokensChart />
              <DiffStatsChart diffEvents={partition.diff_stats} fileEvents={partition.file_edited} />
              <ModelPopularityChart events={partition.model_used} />
              {/* TODO: TASK-031 — ModeUsageChart blocked on TASK-003 (live Claude CLI mode ID capture) */}
              <ChartCard title="Mode usage">
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <IconClock size={28} stroke={1.25} className="text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Mode usage analytics will appear once mode IDs are verified against Claude CLI emit (TASK-003)
                  </p>
                </div>
              </ChartCard>
              <SlashCommandChart />
              <ToolCallChart />
              <ProjectStatsChart />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
