import { memo, useState, useEffect, useRef, useMemo, useCallback, type ComponentType, type SVGProps, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  IconChevronDown, IconChevronRight, IconUsers,
  IconCircleCheck, IconLoader2, IconClock, IconX, IconBrain,
} from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { getSubagentRoleColor, getSubagentRoleIcon } from '@/lib/subagent-style'
import type { SubagentInfo, SubagentStatus } from '@/types'

/** Tabler icons render an SVG and accept SVG props (notably `className`). The
 * `subagent-style` helper returns a generic `ComponentType` for type purity,
 * so we narrow it at the consumer boundary. */
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

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

/**
 * Per-agent elapsed-time hook.
 *
 * Returns a formatted `MM:SS` string when `startedAt` is set, ticking once per
 * second while `isActive` is true. When `isActive` becomes false the interval
 * is torn down (cleanup in the effect's return) but the last formatted value
 * remains visible until the agent re-enters a running state or unmounts.
 *
 * Returns `null` if `startedAt` is undefined so the caller can omit the
 * element entirely (no `00:00` placeholder for agents that never started).
 */
const useElapsedTime = (startedAt: number | undefined, isActive: boolean): string | null => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isActive || startedAt == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive, startedAt])
  if (startedAt == null) return null
  const elapsedMs = Math.max(0, now - startedAt)
  const mm = Math.floor(elapsedMs / 60000)
  const ss = Math.floor((elapsedMs % 60000) / 1000)
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

interface TreeNode {
  readonly agent: SubagentInfo
  readonly children: TreeNode[]
  depth: number
}

/**
 * Build a tree of subagents based on the optional `parent` field.
 * - Falls back to a flat list (all roots at depth 0) when no agent has a parent.
 * - Detects circular parent references via a visited-set per chain walk; on
 *   detection, logs a warning and returns the flat fallback.
 * - Agents whose `parent` does not resolve to another agent's name become roots.
 */
const buildTree = (agents: readonly SubagentInfo[]): TreeNode[] => {
  if (agents.length === 0) return []

  const flatRoots = (): TreeNode[] =>
    agents.map((agent) => ({ agent, children: [], depth: 0 }))

  // If no agent declares a parent, preserve the legacy flat layout exactly.
  const hasAnyParent = agents.some((a) => typeof a.parent === 'string' && a.parent.length > 0)
  if (!hasAnyParent) return flatRoots()

  const byName = new Map<string, SubagentInfo>()
  for (const a of agents) {
    if (a.name) byName.set(a.name, a)
  }

  // Cycle detection: walk the parent chain from each agent. If we ever revisit
  // a name we've already seen on this walk, the graph has a cycle.
  for (const agent of agents) {
    const visited = new Set<string>()
    let cursor: SubagentInfo | undefined = agent
    while (cursor) {
      if (!cursor.name) break
      if (visited.has(cursor.name)) {
        console.warn('Subagent tree cycle detected, falling back to flat')
        return flatRoots()
      }
      visited.add(cursor.name)
      const parentName: string | undefined = cursor.parent
      cursor = parentName ? byName.get(parentName) : undefined
    }
  }

  // Build nodes keyed by name (and a separate list for agents without a name
  // so we don't lose them — they fall through as roots).
  const nodesByName = new Map<string, TreeNode>()
  const unnamedNodes: TreeNode[] = []
  for (const agent of agents) {
    const node: TreeNode = { agent, children: [], depth: 0 }
    if (agent.name) nodesByName.set(agent.name, node)
    else unnamedNodes.push(node)
  }

  const roots: TreeNode[] = []
  for (const agent of agents) {
    const node = agent.name ? nodesByName.get(agent.name) : undefined
    if (!node) {
      // unnamed node — already in unnamedNodes; treat as root
      continue
    }
    const parentNode = agent.parent ? nodesByName.get(agent.parent) : undefined
    if (parentNode && parentNode !== node) {
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Append unnamed agents as roots so they remain visible.
  roots.push(...unnamedNodes)

  // Assign depths via DFS.
  const assignDepth = (node: TreeNode, depth: number): void => {
    node.depth = depth
    for (const child of node.children) assignDepth(child, depth + 1)
  }
  for (const root of roots) assignDepth(root, 0)

  return roots
}

/** Depth-first flatten, preserving the depth field on each node for rendering. */
const flattenTree = (roots: readonly TreeNode[]): TreeNode[] => {
  const out: TreeNode[] = []
  const walk = (node: TreeNode): void => {
    out.push(node)
    for (const child of node.children) walk(child)
  }
  for (const root of roots) walk(root)
  return out
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

  const flatTree = useMemo(() => flattenTree(buildTree(subagents)), [subagents])

  // Auto-collapse after all agents complete (unless user manually toggled)
  useEffect(() => {
    if (!isAllDone || !expanded || userToggledRef.current) return
    const timer = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isAllDone, expanded])

  /**
   * Click-to-focus bridge: locate the first message whose tool calls match
   * the agent's `currentToolCall`, then dispatch a `chat-scroll-to`
   * CustomEvent that `MessageList` listens for. We match against the tool
   * call's `toolCallId` first (when the source is an id) and fall back to
   * `title` (when the source is the human-readable label rendered in the
   * card). Failure modes — missing task, empty `currentToolCall`, or no
   * matching message — are silent no-ops by design (TASK-013 acceptance
   * criteria): the panel must not crash, scroll, or close on misses.
   *
   * Sets `userToggledRef` so the post-completion auto-collapse doesn't fire
   * after a user interaction. Reads task state via `getState()` rather than
   * a hook subscription to avoid extra renders on every chat message.
   */
  const handleAgentClick = useCallback((agent: SubagentInfo): void => {
    userToggledRef.current = true
    const target = agent.currentToolCall
    if (!target) return
    if (!taskId) return
    const task = useTaskStore.getState().tasks[taskId]
    if (!task) return
    const idx = task.messages.findIndex((m) =>
      (m.toolCalls ?? []).some((tc) => tc.toolCallId === target || tc.title === target),
    )
    if (idx < 0) return
    // Match the timeline row id scheme from `deriveTimeline`: grouped layout
    // emits `msg-${i}-work`; inline layout emits `msg-${i}-work-${j}`. The
    // MessageList listener does a prefix fallback so this id resolves in
    // both layouts.
    const messageId = `msg-${idx}-work`
    document.dispatchEvent(new CustomEvent('chat-scroll-to', { detail: { messageId } }))
  }, [taskId])

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
          className="h-0.5 w-full overflow-hidden rounded-full bg-violet-400/20 dark:bg-violet-600/20"
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
          {flatTree.map(({ agent, depth }, i) => {
            const isDimmed = !isAllDone && (agent.status === 'completed' || agent.status === 'failed')
            if (depth === 0) {
              return (
                <AgentCard
                  key={agent.name || `unnamed-${i}`}
                  agent={agent}
                  isDimmed={isDimmed}
                  onClick={handleAgentClick}
                />
              )
            }
            return (
              <div
                key={agent.name || `unnamed-${i}`}
                className="flex items-start"
                style={{ paddingLeft: depth * 12 }}
              >
                <span aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground/40">└ </span>
                <div className="min-w-0 flex-1">
                  <AgentCard agent={agent} isDimmed={isDimmed} onClick={handleAgentClick} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

interface AgentCardProps {
  readonly agent: SubagentInfo
  readonly isDimmed: boolean
  readonly onClick: (agent: SubagentInfo) => void
}

const AgentCard = memo(function AgentCard({ agent, isDimmed, onClick }: AgentCardProps) {
  const role = agent.role ?? 'default'
  const RoleIcon = getSubagentRoleIcon(role) as IconComponent
  const roleStyle = getSubagentRoleColor(role)

  // Track when this agent first entered the `running` state. We intentionally
  // do NOT start the clock on `pending` so queued agents don't accumulate
  // false elapsed time. The ref persists across renders for the lifetime of
  // the card; if the card unmounts and remounts, the clock restarts from the
  // next `running` render — acceptable trade-off vs storing it in global state.
  const startedAtRef = useRef<number | undefined>(undefined)
  if (agent.status === 'running' && startedAtRef.current == null) {
    startedAtRef.current = Date.now()
  }
  const elapsed = useElapsedTime(startedAtRef.current, agent.status === 'running')

  const handleClick = useCallback((): void => {
    onClick(agent)
  }, [onClick, agent])

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(agent)
    }
  }, [onClick, agent])

  return (
    <div
      data-testid={`acp-agent-${agent.name || 'unknown'}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Scroll chat to ${agent.name || 'agent'}'s first tool call`}
      className={`flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 transition-opacity duration-300 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isDimmed ? 'opacity-50' : ''}`}
    >
      <div className="mt-0.5 shrink-0">
        {STATUS_ICON[agent.status]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <RoleIcon className="size-3 shrink-0 text-muted-foreground/50" />
          <span className="text-[13px] font-medium leading-[1.6] text-foreground/85">
            {agent.name}
          </span>
          {agent.role && (
            <span
              className={`hidden rounded px-1.5 py-0.5 text-[10px] ${roleStyle.text} sm:inline`}
              style={{ backgroundColor: roleStyle.bg }}
            >
              {getRoleLabel(agent.role)}
            </span>
          )}
          <span className={`text-[10px] ${STATUS_LABEL_CLASS[agent.status]}`}>
            {agent.status}
          </span>
          {elapsed && (
            <span className="text-[10px] tabular-nums text-muted-foreground/60">{elapsed}</span>
          )}
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
