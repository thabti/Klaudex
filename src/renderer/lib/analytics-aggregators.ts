import type { AnalyticsEvent, AnalyticsEventKind } from '@/types/analytics'

export interface DayValue { day: string; value: number; value2?: number }

/** Pre-partition events by kind in a single pass. O(n) instead of O(n * k). */
export interface PartitionedEvents {
  session: AnalyticsEvent[]
  message_sent: AnalyticsEvent[]
  message_received: AnalyticsEvent[]
  token_usage: AnalyticsEvent[]
  tool_call: AnalyticsEvent[]
  file_edited: AnalyticsEvent[]
  diff_stats: AnalyticsEvent[]
  slash_cmd: AnalyticsEvent[]
  model_used: AnalyticsEvent[]
  mode_switch: AnalyticsEvent[]
  thread_created: AnalyticsEvent[]
  mcp_used: AnalyticsEvent[]
  skill_used: AnalyticsEvent[]
}

const EMPTY: AnalyticsEvent[] = []

export const partitionEvents = (events: AnalyticsEvent[]): PartitionedEvents => {
  const p: PartitionedEvents = {
    session: [], message_sent: [], message_received: [], token_usage: [],
    tool_call: [], file_edited: [], diff_stats: [], slash_cmd: [],
    model_used: [], mode_switch: [], thread_created: [], mcp_used: [], skill_used: [],
  }
  for (const e of events) {
    const bucket = p[e.kind as AnalyticsEventKind]
    if (bucket) bucket.push(e)
  }
  return p
}

/** Group events by day using fast math (no Date object per event). */
const dayKey = (ts: number): string => {
  // Faster than new Date(ts).toISOString().slice(0,10) — avoids object allocation
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`
}

const byDay = (events: AnalyticsEvent[]): Map<string, AnalyticsEvent[]> => {
  const map = new Map<string, AnalyticsEvent[]>()
  for (const e of events) {
    const key = dayKey(e.ts)
    let arr = map.get(key)
    if (!arr) { arr = []; map.set(key, arr) }
    arr.push(e)
  }
  return map
}

const countBy = (events: AnalyticsEvent[], field: 'detail' | 'project'): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const e of events) {
    const key = e[field] ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const sumValue = (events: AnalyticsEvent[]): number => {
  let s = 0
  for (const e of events) s += e.value ?? 0
  return s
}

// ── Public aggregators (all take pre-partitioned slices) ──────────

export const computeCodingHoursByDay = (events: AnalyticsEvent[]): DayValue[] => {
  const days = byDay(events)
  return [...days.entries()].map(([day, evts]) => ({
    day,
    value: Math.round(sumValue(evts) / 3600 * 10) / 10,
  })).sort((a, b) => a.day.localeCompare(b.day))
}

export const computeTotalCodingHours = (events: AnalyticsEvent[]): number =>
  Math.round(sumValue(events) / 3600 * 10) / 10

export const computeMessagesByDay = (sent: AnalyticsEvent[], received: AnalyticsEvent[]): DayValue[] => {
  const sentDays = byDay(sent)
  const recvDays = byDay(received)
  const allDays = new Set([...sentDays.keys(), ...recvDays.keys()])
  return [...allDays].sort().map((day) => ({
    day,
    value: sentDays.get(day)?.length ?? 0,
    value2: recvDays.get(day)?.length ?? 0,
  }))
}

export const computeTotalInputWords = (events: AnalyticsEvent[]): number => sumValue(events)
export const computeTotalOutputWords = (events: AnalyticsEvent[]): number => sumValue(events)

export const computeTokensByDay = (events: AnalyticsEvent[]): DayValue[] => {
  const days = byDay(events)
  return [...days.entries()].map(([day, evts]) => ({
    day, value: sumValue(evts),
  })).sort((a, b) => a.day.localeCompare(b.day))
}

export const computeTotalTokens = (events: AnalyticsEvent[]): number => sumValue(events)

export const computeDiffStatsByDay = (events: AnalyticsEvent[]): DayValue[] => {
  const days = byDay(events)
  return [...days.entries()].map(([day, evts]) => ({
    day,
    value: sumValue(evts),
    value2: evts.reduce((s, e) => s + (e.value2 ?? 0), 0),
  })).sort((a, b) => a.day.localeCompare(b.day))
}

export const computeModelPopularity = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeModeUsage = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeSlashCommandUsage = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeToolCallBreakdown = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeEditedFiles = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeProjectStats = (
  threadEvents: AnalyticsEvent[],
  messageEvents: AnalyticsEvent[],
): { project: string; threads: number; messages: number }[] => {
  const threads = new Map<string, Set<string>>()
  const messages = new Map<string, number>()
  for (const e of threadEvents) {
    if (!e.project) continue
    let set = threads.get(e.project)
    if (!set) { set = new Set(); threads.set(e.project, set) }
    if (e.thread) set.add(e.thread)
  }
  for (const e of messageEvents) {
    if (!e.project) continue
    messages.set(e.project, (messages.get(e.project) ?? 0) + 1)
  }
  const allProjects = new Set([...threads.keys(), ...messages.keys()])
  return [...allProjects].map((project) => ({
    project,
    threads: threads.get(project)?.size ?? 0,
    messages: messages.get(project) ?? 0,
  })).sort((a, b) => b.messages - a.messages)
}

export const computeMcpUsage = (events: AnalyticsEvent[]): Record<string, number> =>
  countBy(events, 'detail')

export const computeTotalMessages = (sent: AnalyticsEvent[], received: AnalyticsEvent[]): number =>
  sent.length + received.length

export const computeTotalDiffAdditions = (events: AnalyticsEvent[]): number => sumValue(events)

export const computeTotalDiffDeletions = (events: AnalyticsEvent[]): number =>
  events.reduce((s, e) => s + (e.value2 ?? 0), 0)

export const computeTotalFilesEdited = (events: AnalyticsEvent[]): number =>
  new Set(events.map((e) => e.detail).filter(Boolean)).size

export const computeTotalToolCalls = (events: AnalyticsEvent[]): number => events.length
