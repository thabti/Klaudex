import { memo } from 'react'
import { IconCircleDot, IconCircleDashed } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ClaudeMemoryFile } from '@/types'
import { type ViewerState, formatName, SourceDot } from './claude-config-helpers'

export const SteeringRow = memo(function SteeringRow({ rule, onOpen }: { rule: ClaudeMemoryFile; onOpen: (v: ViewerState) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li
          role="button"
          tabIndex={0}
          onClick={() => rule.filePath && onOpen({ filePath: rule.filePath, title: formatName(rule.name) })}
          onKeyDown={(e) => e.key === 'Enter' && rule.filePath && onOpen({ filePath: rule.filePath, title: formatName(rule.name) })}
          className={cn(
            'flex h-6 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-[11px] cursor-pointer',
            'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
          )}
        >
          {rule.alwaysApply
            ? <IconCircleDot className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" aria-hidden />
            : <IconCircleDashed className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{formatName(rule.name)}</span>
          {rule.alwaysApply && <span className="shrink-0 text-[9px] text-emerald-600/60 dark:text-emerald-400/60">on</span>}
          <SourceDot source={rule.source} />
        </li>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[220px]">
        <p className="text-[11px] font-medium">{formatName(rule.name)}</p>
        {rule.excerpt && <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{rule.excerpt}</p>}
        <p className="mt-1 text-[9px] text-muted-foreground font-mono">{(rule.filePath ?? '').replace(/^\/Users\/[^/]+/, '~')}</p>
      </TooltipContent>
    </Tooltip>
  )
})
