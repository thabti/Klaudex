import { memo, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ClaudeAgent } from '@/types'
import {
  type ViewerState, formatName, getAgentRole, getStackLabel,
  getRoleIcon, STACK_META, SourceDot,
} from './claude-config-helpers'

export const AgentRow = memo(function AgentRow({ agent, onOpen }: { agent: ClaudeAgent; onOpen: (v: ViewerState) => void }) {
  const { icon: RoleIcon, color } = getRoleIcon(agent.name)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li
          role="button"
          tabIndex={0}
          onClick={() => agent.filePath && onOpen({ filePath: agent.filePath, title: formatName(agent.name) })}
          onKeyDown={(e) => e.key === 'Enter' && agent.filePath && onOpen({ filePath: agent.filePath, title: formatName(agent.name) })}
          className={cn(
            'flex h-7 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-xs cursor-pointer',
            'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
          )}
        >
          <RoleIcon className={cn('size-3 shrink-0', color)} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{getAgentRole(agent.name)}</span>
          <SourceDot source={agent.source} />
        </li>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px]">
        <p className="text-[11px] font-medium">{formatName(agent.name)}</p>
        {agent.description && <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{agent.description.slice(0, 160)}</p>}
        <p className="mt-1 text-[9px] text-muted-foreground font-mono">{(agent.filePath ?? '').replace(/^\/Users\/[^/]+/, '~')}</p>
      </TooltipContent>
    </Tooltip>
  )
})

export const AgentStackGroup = memo(function AgentStackGroup({ stack, agents, onOpen }: {
  stack: string; agents: ClaudeAgent[]; onOpen: (v: ViewerState) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = STACK_META[stack] ?? STACK_META.custom
  const StackIcon = meta.icon

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} className={cn(
        'flex w-full h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-xs text-left',
        'text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors',
        'outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
      )}>
        <IconChevronRight className={cn('size-2.5 shrink-0 text-muted-foreground/70 transition-transform duration-150', open && 'rotate-90')} aria-hidden />
        <StackIcon className={cn('size-3.5 shrink-0', meta.color)} aria-hidden />
        <span className="flex-1 truncate font-medium text-left">{getStackLabel(stack)}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{agents.length}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-px py-px pl-3">
          {agents.map((agent) => <AgentRow key={`${agent.source}-${agent.name}`} agent={agent} onOpen={onOpen} />)}
        </ul>
      )}
    </li>
  )
})
