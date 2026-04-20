import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { PanelShell } from './PanelShell'
import { formatTokens } from './UsagePanel'
import type { AgentTask, ToolCall } from '@/types'

/** Format cost as USD */
const formatCost = (cost: number): string => {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

/** Format duration from ms to human-readable */
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

interface TaskStats {
  readonly userMessages: number
  readonly assistantMessages: number
  readonly systemMessages: number
  readonly turns: number
  readonly toolCalls: number
  readonly toolCallsByKind: Record<string, number>
  readonly duration: number
  readonly tokensPerTurn: number
  readonly cacheHitRate: number
  readonly costPerTurn: number
}

/** Derive stats from a single task */
const computeTaskStats = (task: AgentTask): TaskStats => {
  const msgs = task.messages
  const userMessages = msgs.filter((m) => m.role === 'user').length
  const assistantMessages = msgs.filter((m) => m.role === 'assistant').length
  const systemMessages = msgs.filter((m) => m.role === 'system').length
  const turns = Math.min(userMessages, assistantMessages)
  const allToolCalls: ToolCall[] = msgs.flatMap((m) => m.toolCalls ?? [])
  const toolCalls = allToolCalls.length
  const toolCallsByKind: Record<string, number> = {}
  for (const tc of allToolCalls) {
    const kind = tc.kind ?? 'other'
    toolCallsByKind[kind] = (toolCallsByKind[kind] ?? 0) + 1
  }
  const cu = task.contextUsage
  const tokensPerTurn = turns > 0 && cu ? Math.round(cu.used / turns) : 0
  const inputTokens = cu?.inputTokens ?? 0
  const cacheReadTokens = cu?.cacheReadTokens ?? 0
  const totalInput = inputTokens + cacheReadTokens
  const cacheHitRate = totalInput > 0 ? (cacheReadTokens / totalInput) * 100 : 0
  const costPerTurn = turns > 0 && task.totalCost ? task.totalCost / turns : 0
  const created = new Date(task.createdAt).getTime()
  const lastMsg = msgs.length > 0 ? new Date(msgs[msgs.length - 1].timestamp).getTime() : created
  const duration = lastMsg - created
  return { userMessages, assistantMessages, systemMessages, turns, toolCalls, toolCallsByKind, duration, tokensPerTurn, cacheHitRate, costPerTurn }
}

/** Single stat row */
const StatRow = memo(function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[12px] font-medium tabular-nums text-foreground">{value}</span>
        {sub && <span className="text-[10px] tabular-nums text-muted-foreground/70">{sub}</span>}
      </div>
    </div>
  )
})

/** Tool kind badge */
const KindBadge = memo(function KindBadge({ kind, count }: { kind: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
      <span className="font-medium text-foreground/80">{count}</span>
      {kind}
    </span>
  )
})

export const StatsPanel = memo(function StatsPanel({ onDismiss }: { onDismiss: () => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const currentModel = useSettingsStore((s) => s.currentModelId)

  const selectedTask = selectedTaskId ? tasks[selectedTaskId] : null
  const cu = selectedTask?.contextUsage

  const stats = useMemo(() => selectedTask ? computeTaskStats(selectedTask) : null, [selectedTask])

  // Aggregate stats across all threads
  const aggregate = useMemo(() => {
    const all = Object.values(tasks).filter((t) => t.messages.length > 0)
    const totalThreads = all.length
    const totalMessages = all.reduce((sum, t) => sum + t.messages.length, 0)
    const totalCost = all.reduce((sum, t) => sum + (t.totalCost ?? 0), 0)
    const totalTokensUsed = all.reduce((sum, t) => sum + (t.contextUsage?.used ?? 0), 0)
    const totalToolCalls = all.reduce((sum, t) => sum + t.messages.flatMap((m) => m.toolCalls ?? []).length, 0)
    return { totalThreads, totalMessages, totalCost, totalTokensUsed, totalToolCalls }
  }, [tasks])

  // Token breakdown
  const inputTokens = cu?.inputTokens ?? 0
  const outputTokens = cu?.outputTokens ?? 0
  const cacheReadTokens = cu?.cacheReadTokens ?? 0
  const cacheCreationTokens = cu?.cacheCreationTokens ?? 0
  const hasBreakdown = inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreationTokens > 0

  // Context bar color
  const contextPct = cu && cu.size > 0 ? (cu.used / cu.size) * 100 : 0
  const barColor = contextPct > 85 ? 'bg-red-400' : contextPct > 60 ? 'bg-amber-400' : 'bg-blue-400'

  // Sorted tool kinds
  const sortedKinds = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.toolCallsByKind).sort((a, b) => b[1] - a[1])
  }, [stats])

  return (
    <PanelShell onDismiss={onDismiss}>
      <div className="max-h-[420px] overflow-y-auto">
        {/* Header */}
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Session Stats</span>
        </div>

        {stats && selectedTask ? (
          <>
            {/* Context bar */}
            {cu && cu.size > 0 && (
              <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Context</span>
                  <span className="text-[12px] font-medium tabular-nums text-foreground">
                    {formatTokens(cu.used)} / {formatTokens(cu.size)}
                    <span className="ml-1 text-[10px] text-muted-foreground">({contextPct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(contextPct, 100)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/70">
                  <span>{currentModel ?? 'unknown'}</span>
                  {selectedTask.totalCost !== undefined && selectedTask.totalCost > 0 && (
                    <span>{formatCost(selectedTask.totalCost)} total</span>
                  )}
                </div>
              </div>
            )}

            {/* Token breakdown */}
            {hasBreakdown && (
              <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">Tokens</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <StatRow label="Input" value={formatTokens(inputTokens)} />
                  <StatRow label="Output" value={formatTokens(outputTokens)} />
                  <StatRow label="Cache read" value={formatTokens(cacheReadTokens)} />
                  <StatRow label="Cache write" value={formatTokens(cacheCreationTokens)} />
                </div>
                {stats.cacheHitRate > 0 && (
                  <div className="mt-1.5 border-t border-border/20 pt-1">
                    <StatRow label="Cache hit rate" value={`${stats.cacheHitRate.toFixed(1)}%`} />
                  </div>
                )}
              </div>
            )}

            {/* Conversation stats */}
            <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">Conversation</div>
              <StatRow label="Duration" value={formatDuration(stats.duration)} />
              <StatRow label="Turns" value={String(stats.turns)} />
              <StatRow label="Messages" value={String(stats.userMessages + stats.assistantMessages + stats.systemMessages)} sub={`${stats.userMessages}u / ${stats.assistantMessages}a / ${stats.systemMessages}s`} />
              {stats.tokensPerTurn > 0 && <StatRow label="Tokens / turn" value={formatTokens(stats.tokensPerTurn)} />}
              {stats.costPerTurn > 0 && <StatRow label="Cost / turn" value={formatCost(stats.costPerTurn)} />}
            </div>

            {/* Tool calls */}
            {stats.toolCalls > 0 && (
              <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-2">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Tool calls</span>
                  <span className="text-[12px] font-medium tabular-nums text-foreground">{stats.toolCalls}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sortedKinds.map(([kind, count]) => (
                    <KindBadge key={kind} kind={kind} count={count} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-3">
            <span className="text-[12px] text-muted-foreground">No thread selected</span>
          </div>
        )}

        {/* Aggregate across all threads */}
        {aggregate.totalThreads > 0 && (
          <div className="mx-3 mb-2 rounded-lg bg-muted/30 px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">All threads</div>
            <StatRow label="Threads" value={String(aggregate.totalThreads)} />
            <StatRow label="Messages" value={String(aggregate.totalMessages)} />
            <StatRow label="Tool calls" value={String(aggregate.totalToolCalls)} />
            <StatRow label="Tokens used" value={formatTokens(aggregate.totalTokensUsed)} />
            {aggregate.totalCost > 0 && <StatRow label="Total cost" value={formatCost(aggregate.totalCost)} />}
          </div>
        )}
      </div>
    </PanelShell>
  )
})
