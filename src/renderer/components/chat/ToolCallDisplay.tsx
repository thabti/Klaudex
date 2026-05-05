import { memo, useState, useMemo } from 'react'
import {
  IconChevronDown, IconChevronRight, IconCheck, IconLoader2, IconX, IconBolt,
} from '@tabler/icons-react'
import type { ToolCall } from '@/types'
import { ToolCallEntry } from './ToolCallEntry'
import { isTaskListToolCall } from './TaskListDisplay'
import { SubagentDisplay, isSubagentToolCall } from './SubagentDisplay'

const MAX_VISIBLE_DEFAULT = 6

interface ToolCallDisplayProps {
  toolCalls: ToolCall[]
  /**
   * When true, the calls are rendered in their inline-with-prose context
   * (one or two tool entries between paragraphs). The aggregate header and
   * truncation chrome are dropped because they make a single tool call feel
   * like a heavyweight section break.
   */
  inline?: boolean
}

export const ToolCallDisplay = memo(function ToolCallDisplay({ toolCalls, inline = false }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  if (!toolCalls.length) return null

  const { completedCount, runningCount, failedCount } = useMemo(() => {
    let completed = 0, running = 0, failed = 0
    for (const tc of toolCalls) {
      if (tc.status === 'completed') completed++
      else if (tc.status === 'in_progress') running++
      else if (tc.status === 'failed') failed++
    }
    return { completedCount: completed, runningCount: running, failedCount: failed }
  }, [toolCalls])

  const hasSubagent = useMemo(() => toolCalls.some(isSubagentToolCall), [toolCalls])

  // Inline layout: render each tool entry directly, no aggregate header.
  // Specialized renderings (subagents) still appear when present.
  // Task-list tool calls are intentionally NOT rendered as a card here —
  // the StickyTaskList component above the chat input owns that card so
  // multi-step task updates (create → add → complete) don't spawn a new
  // card per inline tool group.
  if (inline) {
    // Skip task-list tool entries entirely in inline mode — the sticky
    // task list above the chat input is the canonical view. If a group
    // contains only task-list calls, render nothing.
    const visibleInline = toolCalls.filter((tc) => !isTaskListToolCall(tc))
    if (visibleInline.length === 0 && !hasSubagent) return null
    return (
      <div data-testid="tool-call-display" data-inline="true" className="space-y-1">
        {visibleInline.map((tc) => (
          <ToolCallEntry key={tc.toolCallId} toolCall={tc} />
        ))}
        {hasSubagent && (
          <div className="pt-1">
            <SubagentDisplay allToolCalls={toolCalls} />
          </div>
        )}
      </div>
    )
  }

  const visibleCalls = showAll ? toolCalls : toolCalls.slice(0, MAX_VISIBLE_DEFAULT)
  const hasMore = toolCalls.length > MAX_VISIBLE_DEFAULT

  return (
    <div data-testid="tool-call-display" className="rounded-lg border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-accent/5"
      >
        {expanded ? (
          <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" />
        ) : (
          <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
        <IconBolt className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-[13px] font-medium text-muted-foreground">
          Tool calls
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          ({toolCalls.length})
        </span>

        <div className="flex-1" />
        {runningCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-primary">
            <IconLoader2 className="size-3 animate-spin" />
            {runningCount}
          </span>
        )}
        {failedCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
            <IconX className="size-3" />
            {failedCount}
          </span>
        )}
        {completedCount > 0 && runningCount === 0 && failedCount === 0 && (
          <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 py-1">
          {visibleCalls.map((tc) => (
            <ToolCallEntry key={tc.toolCallId} toolCall={tc} />
          ))}
          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-muted-foreground/80"
            >
              +{toolCalls.length - MAX_VISIBLE_DEFAULT} more
            </button>
          )}
        </div>
      )}

      {hasSubagent && (
        <div className={expanded ? 'px-1.5 pb-1.5' : 'border-t border-border/50 px-1.5 py-1.5'}>
          <SubagentDisplay allToolCalls={toolCalls} />
        </div>
      )}
    </div>
  )
})
