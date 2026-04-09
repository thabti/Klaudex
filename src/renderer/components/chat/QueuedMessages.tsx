import { memo } from 'react'
import { X, CornerDownLeft, Trash2, GripVertical } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface QueuedMessagesProps {
  messages: string[]
  onRemove: (index: number) => void
  onSteer?: (index: number) => void
}

export const QueuedMessages = memo(function QueuedMessages({ messages, onRemove, onSteer }: QueuedMessagesProps) {
  if (messages.length === 0) return null

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl px-4 sm:px-6">
      <div className="flex flex-col gap-1 pb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
          Queued ({messages.length})
        </span>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'group flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5',
              'animate-in slide-in-from-bottom-2 fade-in duration-200',
            )}
          >
            <GripVertical className="size-3 shrink-0 text-muted-foreground/20" />
            <CornerDownLeft className="size-3 shrink-0 text-muted-foreground/30" />
            <span className="flex-1 truncate text-[13px] text-foreground/70">
              {msg}
            </span>
            {onSteer && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSteer(i)}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <CornerDownLeft className="size-3" />
                    Steer
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">Pause agent and send this message</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove queued message ${i + 1}`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px]">Remove</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  )
})
