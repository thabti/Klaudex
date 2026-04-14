import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowDown } from '@tabler/icons-react'
import type { TaskMessage, ToolCall } from '@/types'
import { deriveTimeline, type TimelineRow } from '@/lib/timeline'
import {
  UserMessageRow,
  SystemMessageRow,
  AssistantTextRow,
  WorkGroupRow,
  WorkingRow,
  ChangedFilesSummary,
} from './TimelineRows'

const AUTO_SCROLL_THRESHOLD = 150

interface MessageListProps {
  messages: TaskMessage[]
  streamingChunk?: string
  liveToolCalls?: ToolCall[]
  liveThinking?: string
  isRunning?: boolean
}

export const MessageList = memo(function MessageList({
  messages,
  streamingChunk,
  liveToolCalls,
  liveThinking,
  isRunning,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const isNearBottomRef = useRef(true)

  const timelineRows = useMemo(
    () => deriveTimeline(messages, streamingChunk, liveToolCalls, liveThinking, isRunning),
    [messages, streamingChunk, liveToolCalls, liveThinking, isRunning],
  )

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [])

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      const nearBottom = distFromBottom < AUTO_SCROLL_THRESHOLD
      isNearBottomRef.current = nearBottom
      setShowScrollBtn(!nearBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-scroll when new content arrives and user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [timelineRows, streamingChunk, liveToolCalls, liveThinking, scrollToBottom])

  if (!timelineRows.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-[15px]">Send a message to start the conversation.</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={parentRef} data-testid="message-list" className="h-full overflow-auto overscroll-y-contain px-0 pt-4 pb-6 sm:pt-6 sm:pb-8">
        {timelineRows.map((row) => (
          <div key={row.id} data-timeline-row-kind={row.kind}>
            <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-auto overflow-y-hidden px-5 sm:px-8 lg:max-w-4xl xl:max-w-5xl">
              <TimelineRowRenderer row={row} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          data-testid="scroll-to-bottom-button"
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-lg transition-colors hover:border-primary hover:text-foreground"
        >
          <IconArrowDown className="size-3" />
          Scroll to bottom
        </button>
      )}
    </div>
  )
})

// ── Row dispatcher ────────────────────────────────────────────

const TimelineRowRenderer = memo(function TimelineRowRenderer({ row }: { row: TimelineRow }) {
  switch (row.kind) {
    case 'user-message':
      return <UserMessageRow row={row} />
    case 'system-message':
      return <SystemMessageRow row={row} />
    case 'assistant-text':
      return <AssistantTextRow row={row} />
    case 'work':
      return <WorkGroupRow row={row} />
    case 'working':
      return <WorkingRow />
    case 'changed-files':
      return <ChangedFilesSummary row={row} />
  }
})
