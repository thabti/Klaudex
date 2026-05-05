import { memo, useMemo } from 'react'
import ChatMarkdown from './ChatMarkdown'
import { ThinkingDisplay } from './ThinkingDisplay'
import { isPlanHandoff, PlanHandoffCard } from './PlanHandoffCard'
import { TaskCompletionCard, parseReport, stripReport, shouldRenderReportCard } from './TaskCompletionCard'
import type { AssistantTextRow as AssistantTextRowData } from '@/lib/timeline'

export const AssistantTextRow = memo(function AssistantTextRow({ row }: { row: AssistantTextRowData }) {
  // Inline-mode middle segments must not parse the content for report/handoff —
  // they hold a slice of prose, not the full message body.
  const isInline = row.isInlineSegment === true
  const showHandoff = !row.isStreaming && !isInline && isPlanHandoff(row.content)
  const report = useMemo(
    () => (!row.isStreaming && !isInline ? parseReport(row.content) : null),
    [row.isStreaming, row.content, isInline],
  )
  const displayContent = useMemo(
    () => (!row.isStreaming && !isInline ? stripReport(row.content) : row.content),
    [row.isStreaming, row.content, isInline],
  )
  const isRichReport = report && shouldRenderReportCard(report)
  // Only render the card here when there's no changed-files row to host it
  const showReportCard = isRichReport && !row.hasChangedFiles

  return (
    <div data-testid="assistant-text-row" className={row.squashed ? 'pb-2.5' : 'pb-4'} data-timeline-row-kind="assistant-text">
      {row.thinking && (
        <ThinkingDisplay text={row.thinking} isActive={row.isStreaming} />
      )}
      {displayContent ? (
        row.isStreaming ? (
          <ChatMarkdown text={displayContent} isStreaming />
        ) : (
          <ChatMarkdown text={displayContent} questionsAnswered={row.questionsAnswered} />
        )
      ) : null}
      {showReportCard && <TaskCompletionCard report={report} />}
      {showHandoff && <PlanHandoffCard />}
    </div>
  )
})
