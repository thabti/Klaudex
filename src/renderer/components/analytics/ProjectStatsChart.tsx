import { useMemo } from 'react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ChartCard } from './ChartCard'
import { HorizontalBarSection } from './HorizontalBarSection'

/**
 * TASK-032 — Per-project stats card.
 *
 * Ports `kirodex/src/renderer/components/analytics/ProjectStatsChart.tsx`.
 * Klaudex differences vs kirodex source:
 *  - Reads events from `useAnalyticsStore` directly instead of taking them as
 *    props (kirodex passed pre-partitioned `threadEvents` / `messageEvents`).
 *  - Uses Klaudex's `<HorizontalBarSection label/value/total>` primitive
 *    instead of recharts (no chart library in package.json — TASK-026 chose
 *    plain CSS bars). Two stacked bar rows per project: threads, messages.
 *  - Empty-state markup is inline because `ChartCard.tsx` doesn't export
 *    `EmptyChart` / `StatRow` like kirodex does.
 */

interface ProjectRow {
  readonly project: string
  readonly threads: number
  readonly messages: number
}

const computeProjectStats = (events: AnalyticsEvent[]): ProjectRow[] => {
  const threads = new Map<string, Set<string>>()
  const messages = new Map<string, number>()
  for (const e of events) {
    if (!e.project) continue
    if (e.kind === 'thread_created') {
      let set = threads.get(e.project)
      if (!set) {
        set = new Set()
        threads.set(e.project, set)
      }
      if (e.thread) set.add(e.thread)
      continue
    }
    if (e.kind === 'message_sent' || e.kind === 'message_received') {
      messages.set(e.project, (messages.get(e.project) ?? 0) + 1)
    }
  }
  const allProjects = new Set<string>([...threads.keys(), ...messages.keys()])
  return [...allProjects]
    .map<ProjectRow>((project) => ({
      project,
      threads: threads.get(project)?.size ?? 0,
      messages: messages.get(project) ?? 0,
    }))
    .sort((a, b) => b.messages - a.messages)
}

const projectLabel = (path: string): string => {
  // Show the trailing path segment; analytics events store full workspace
  // paths and the chart doesn't have horizontal room for them.
  const trimmed = path.replace(/[\\/]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return idx >= 0 ? trimmed.slice(idx + 1) || trimmed : trimmed
}

export const ProjectStatsChart = () => {
  const events = useAnalyticsStore((s) => s.events)
  const data = useMemo(() => computeProjectStats(events), [events])

  const { maxThreads, maxMessages } = useMemo(() => {
    let mt = 0
    let mm = 0
    for (const row of data) {
      if (row.threads > mt) mt = row.threads
      if (row.messages > mm) mm = row.messages
    }
    return { maxThreads: mt, maxMessages: mm }
  }, [data])

  if (data.length === 0) {
    return (
      <ChartCard title="Projects" className="lg:col-span-2">
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
          No project data yet
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Projects" className="lg:col-span-2">
      <ul className="flex flex-col gap-3">
        {data.slice(0, 12).map((row) => (
          <li key={row.project} className="flex flex-col gap-1.5">
            <span
              className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70"
              title={row.project}
            >
              {projectLabel(row.project)}
            </span>
            <HorizontalBarSection
              label="Threads"
              value={row.threads}
              total={Math.max(maxThreads, 1)}
            />
            <HorizontalBarSection
              label="Messages"
              value={row.messages}
              total={Math.max(maxMessages, 1)}
            />
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
