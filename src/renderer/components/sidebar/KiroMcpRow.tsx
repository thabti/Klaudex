import { memo } from 'react'
import { IconCircle } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { KiroMcpServer } from '@/types'
import { type ViewerState } from './kiro-config-helpers'

export const McpRow = memo(function McpRow({ server, onOpen }: { server: KiroMcpServer; onOpen: (v: ViewerState) => void }) {
  const dotClass = !server.enabled
    ? 'fill-muted-foreground text-muted-foreground'
    : server.status === 'error' || server.status === 'needs-auth'
      ? 'fill-red-500 text-red-500'
      : 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li
          role="button"
          tabIndex={0}
          onClick={() => server.filePath && onOpen({ filePath: server.filePath, title: `MCP: ${server.name}` })}
          onKeyDown={(e) => e.key === 'Enter' && server.filePath && onOpen({ filePath: server.filePath, title: `MCP: ${server.name}` })}
          className={cn(
            'flex h-6 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-[11px] cursor-pointer',
            'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
          )}
        >
          <IconCircle className={cn('size-2 shrink-0', dotClass)} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{server.name}</span>
          <span className="shrink-0 text-[9px] text-muted-foreground">{server.transport}</span>
        </li>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[220px]">
        <p className="text-[11px] font-medium">{server.name}</p>
        {(server.status === 'error' || server.status === 'needs-auth') && (
          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
            {server.status === 'needs-auth' ? 'Auth required' : 'Failed to connect'}
          </p>
        )}
        {server.error && (
          <p className="mt-0.5 text-[9px] text-muted-foreground font-mono truncate">{server.error}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
})
