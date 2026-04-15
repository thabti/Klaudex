import { memo, useMemo } from 'react'
import ChatMarkdown from './ChatMarkdown'
import { ThinkingDisplay } from './ThinkingDisplay'
import { isPlanHandoff, PlanHandoffCard } from './PlanHandoffCard'
import { TaskCompletionCard, parseReport, stripReport } from './TaskCompletionCard'
import type { AssistantTextRow as AssistantTextRowData } from '@/lib/timeline'

export const AssistantTextRow = memo(function AssistantTextRow({ row }: { row: AssistantTextRowData }) {
  const showHandoff = !row.isStreaming && isPlanHandoff(row.content)
  const hasReport = useMemo(() => (!row.isStreaming ? parseReport(row.content) : null), [row.isStreaming, row.content])
  const displayContent = useMemo(() => (hasReport ? stripReport(row.content) : row.content), [hasReport, row.content])
  // Only render the card here when there's no changed-files row to host it
  const showReportCard = hasReport && !row.hasChangedFiles

  return (
    <div data-testid="assistant-text-row" className={row.squashed ? 'pb-1.5' : 'pb-4'} data-timeline-row-kind="assistant-text">
      {row.thinking && (
        <ThinkingDisplay text={row.thinking} isActive={row.isStreaming} />
      )}
      {displayContent ? (
        <ChatMarkdown text={displayContent} isStreaming={row.isStreaming} />
      ) : null}
      {showReportCard && <TaskCompletionCard report={hasReport} />}
      {showHandoff && <PlanHandoffCard />}
    </div>
  )
})
