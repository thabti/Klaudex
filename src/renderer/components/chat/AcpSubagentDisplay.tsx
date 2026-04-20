import { memo, useState, useEffect, useRef, useMemo } from 'react'
import {
  IconChevronDown, IconChevronRight, IconUsers, IconRobot,
  IconCircleCheck, IconLoader2, IconClock, IconX, IconBrain,
} from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import type { SubagentInfo, SubagentStatus } from '@/types'

const AUTO_COLLAPSE_DELAY_MS = 2000

const ROLE_LABELS: Record<string, string> = {
  default: 'Default',
  plan: 'Planner',
  guide: 'Guide',
  research: 'Research',
  kiro_default: 'Default',
  kiro_planner: 'Planner',
  kiro_guide: 'Guide',
} as const

const getRoleLabel = (role: string): string =>
  ROLE_LABELS[role] ?? role

const STATUS_ICON: Record<SubagentStatus, React.ReactNode> = {
  pending: <IconClock className="size-3.5 text-muted-foreground/60" />,
  running: <IconLoader2 className="size-3.5 animate-spin text-primary" />,
  completed: <IconCircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
  failed: <IconX className="size-3.5 text-red-600 dark:text-red-400" />,
}

const STATUS_LABEL_CLASS: Record<SubagentStatus, string> = {
  pending: 'text-muted-foreground/60',
  running: 'text-primary',
  completed: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
}

export const AcpSubagentDisplay = memo(function AcpSubagentDisplay() {
  const taskId = useTaskStore((s) => s.selectedTaskId)
  const subagents = useTaskStore((s) => (taskId ? s.liveSubagents[taskId] : undefined)) ?? []
  const [expanded, setExpanded] = useState(true)
  const userToggledRef = useRef(false)

  const { completedCount, isAllDone } = useMemo(() => {
    const completed = subagents.filter((a) => a.status === 'completed' || a.status === 'failed').length
    return { completedCount: completed, isAllDone: subagents.length > 0 && completed === subagents.length }
  }, [subagents])

  // Auto-collapse after all agents complete (unless user manually toggled)
  useEffect(() => {
    if (!isAllDone || !expanded || userToggledRef.current) return
    const timer = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isAllDone, expanded])

  if (subagents.length === 0) return null

  const headerDescription = subagents[0]?.description ?? 'Parallel agents'
  const progressPct = subagents.length > 0 ? (completedCount / subagents.length) * 100 : 0

  const handleToggle = () => {
    userToggledRef.current = true
    setExpanded((prev) => !prev)
  }

  return (
    <div data-testid="acp-subagent-display" className="rounded-lg border border-border/60 bg-card/60">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls="acp-subagent-panel"
        aria-label={expanded ? 'Collapse subagent details' : 'Expand subagent details'}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/5"
      >
        {expanded
          ? <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" />
          : <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />}
        <IconUsers className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
        <span className="flex-1 truncate text-[13px] font-medium text-muted-foreground">
          {headerDescription}
        </span>
        <span
          className="text-[11px] tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {isAllDone
            ? <span className="flex items-center gap-1">
                <IconCircleCheck className="size-3 animate-in zoom-in-50 duration-200 text-emerald-600 dark:text-emerald-400" />
                all done
              </span>
            : `${completedCount}/${subagents.length}`}
        </span>
      </button>

      {/* Progress bar */}
      <div className="px-3.5">
        <div
          className="h-0.5 w-full overflow-hidden rounded-full bg-violet-600/20"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemax={subagents.length}
          aria-label="Subagent progress"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${isAllDone ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-violet-600 dark:bg-violet-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div
          id="acp-subagent-panel"
          role="region"
          aria-label="Subagent details"
          className="animate-in fade-in-0 slide-in-from-top-1 duration-150 max-h-[280px] overflow-y-auto border-t border-border/50 px-3 py-2"
        >
          {subagents.map((agent, i) => (
            <AgentCard key={agent.name || i} agent={agent} isDimmed={!isAllDone && (agent.status === 'completed' || agent.status === 'failed')} />
          ))}
        </div>
      )}
    </div>
  )
})

interface AgentCardProps {
  readonly agent: SubagentInfo
  readonly isDimmed: boolean
}

const AgentCard = memo(function AgentCard({ agent, isDimmed }: AgentCardProps) {
  return (
    <div
      data-testid={`acp-agent-${agent.name || i}`}
      className={`flex items-start gap-2 px-1.5 py-1 transition-opacity duration-300 ${isDimmed ? 'opacity-50' : ''}`}
    >
      <div className="mt-0.5 shrink-0">
        {STATUS_ICON[agent.status]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <IconRobot className="size-3 shrink-0 text-muted-foreground/50" />
          <span className="text-[13px] font-medium leading-[1.6] text-foreground/85">
            {agent.name}
          </span>
          {agent.role && (
            <span className="hidden rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              {getRoleLabel(agent.role)}
            </span>
          )}
          <span className={`text-[10px] ${STATUS_LABEL_CLASS[agent.status]}`}>
            {agent.status}
          </span>
        </div>
        {agent.subName && (
          <span className="text-[11px] text-muted-foreground/70">{agent.subName}</span>
        )}
        {agent.currentToolCall && (
          <span className="flex items-center gap-1 text-[11px] text-primary/80">
            <IconLoader2 className="size-2.5 animate-spin" />
            <span className="max-w-[200px] truncate">{agent.currentToolCall}</span>
          </span>
        )}
        {agent.isThinking && !agent.currentToolCall && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <IconBrain className="size-2.5 animate-pulse" />
            Thinking…
          </span>
        )}
        {agent.dependsOn && agent.dependsOn.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <IconClock className="size-2.5" />
            <span className="truncate">after {agent.dependsOn.join(', ')}</span>
          </span>
        )}
      </div>
    </div>
  )
})
