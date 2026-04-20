import { memo } from 'react'
import { IconBolt } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import type { ClaudeCommand } from '@/types'
import { type ViewerState, formatName, SourceDot } from './claude-config-helpers'

export const SkillRow = memo(function SkillRow({ skill, onOpen }: { skill: ClaudeCommand; onOpen: (v: ViewerState) => void }) {
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => skill.filePath && onOpen({ filePath: skill.filePath, title: formatName(skill.name) })}
      onKeyDown={(e) => e.key === 'Enter' && skill.filePath && onOpen({ filePath: skill.filePath, title: formatName(skill.name) })}
      className={cn(
        'flex h-6 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-[11px] cursor-pointer',
        'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
      )}
    >
      <IconBolt className="size-3 shrink-0 text-amber-600 dark:text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{formatName(skill.name)}</span>
      <SourceDot source={skill.source} />
    </li>
  )
})
