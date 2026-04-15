import { memo, useMemo, useCallback } from 'react'
import { IconFile, IconPlus, IconMinus } from '@tabler/icons-react'
import { useDiffStore } from '@/stores/diffStore'

interface KirodexReport {
  status: 'done' | 'partial' | 'blocked'
  summary: string
  filesChanged?: string[]
  linesAdded?: number
  linesRemoved?: number
}

const REPORT_REGEX = /```kirodex-report\s*\n([\s\S]*?)\n```/
const JSON_FENCE_REGEX = /```json\s*\n([\s\S]*?)\n```/
const BARE_JSON_REGEX = /\{[\s\S]*"status"\s*:\s*"(?:done|partial|blocked)"[\s\S]*"summary"\s*:\s*"[^"]+?"[\s\S]*\}/

const VALID_STATUSES = new Set(['done', 'partial', 'blocked'])

/** Validate that a parsed object is a KirodexReport. */
const isValidReport = (obj: unknown): obj is KirodexReport => {
  if (typeof obj !== 'object' || obj === null) return false
  const r = obj as Record<string, unknown>
  return typeof r.status === 'string' && VALID_STATUSES.has(r.status) && typeof r.summary === 'string' && r.summary.length > 0
}

/** Extract a completion report from message text. Checks kirodex-report fences, json fences, and bare JSON. */
export const parseReport = (text: string): KirodexReport | null => {
  // 1. kirodex-report fence (highest priority)
  const fencedMatch = REPORT_REGEX.exec(text)
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1])
      if (isValidReport(parsed)) return parsed
    } catch { /* fall through */ }
  }
  // 2. json fence containing a report
  const jsonFenceMatch = JSON_FENCE_REGEX.exec(text)
  if (jsonFenceMatch) {
    try {
      const parsed = JSON.parse(jsonFenceMatch[1])
      if (isValidReport(parsed)) return parsed
    } catch { /* fall through */ }
  }
  // 3. bare JSON object at the end of the message
  const bareMatch = BARE_JSON_REGEX.exec(text)
  if (bareMatch) {
    try {
      const parsed = JSON.parse(bareMatch[0])
      if (isValidReport(parsed)) return parsed
    } catch { /* fall through */ }
  }
  return null
}

/** Strip the report block from message text so ChatMarkdown doesn't render it. */
export const stripReport = (text: string): string => {
  let result = text
  if (REPORT_REGEX.test(result)) return result.replace(REPORT_REGEX, '').trimEnd()
  if (JSON_FENCE_REGEX.test(result)) {
    // Only strip if the json fence contains a valid report
    const match = JSON_FENCE_REGEX.exec(result)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (isValidReport(parsed)) return result.replace(JSON_FENCE_REGEX, '').trimEnd()
      } catch { /* fall through */ }
    }
  }
  if (BARE_JSON_REGEX.test(result)) {
    const match = BARE_JSON_REGEX.exec(result)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (isValidReport(parsed)) {
          result = result.replace(match[0], '').trimEnd()
          return result
        }
      } catch { /* fall through */ }
    }
  }
  return result
}

const STATUS_LABEL: Record<string, string> = {
  done: 'Done',
  partial: 'Partial',
  blocked: 'Blocked',
} as const

export const TaskCompletionCard = memo(function TaskCompletionCard({ report }: { report: KirodexReport }) {
  const label = STATUS_LABEL[report.status] ?? 'Done'
  const hasStats = (report.linesAdded ?? 0) > 0 || (report.linesRemoved ?? 0) > 0
  const files = useMemo(() => report.filesChanged?.slice(0, 10) ?? [], [report.filesChanged])
  const hasMoreFiles = (report.filesChanged?.length ?? 0) > 10

  const handleFileClick = useCallback((path: string) => {
    useDiffStore.getState().openToFile(path)
  }, [])

  return (
    <div
      className="mt-3 pt-3 border-t border-border/40"
      data-testid="task-completion-card"
      role="status"
      aria-label={`Task ${label}: ${report.summary}`}
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/90">{label}</span>
        <span className="mx-1.5 text-border">·</span>
        {report.summary}
      </p>

      {hasStats && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          {(report.linesAdded ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600/70 dark:text-emerald-400/70">
              <IconPlus className="size-3" aria-hidden />
              {report.linesAdded}
            </span>
          )}
          {(report.linesAdded ?? 0) > 0 && (report.linesRemoved ?? 0) > 0 && (
            <span className="mx-1 text-muted-foreground">/</span>
          )}
          {(report.linesRemoved ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-red-600/70 dark:text-red-400/70">
              <IconMinus className="size-3" aria-hidden />
              {report.linesRemoved}
            </span>
          )}
        </p>
      )}

      {files.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {files.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleFileClick(f)}
              className="flex w-full items-center gap-1.5 rounded py-0.5 text-left text-[12px] text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              <IconFile className="size-3 shrink-0" aria-hidden />
              <span className="truncate font-mono">{f}</span>
            </button>
          ))}
          {hasMoreFiles && (
            <p className="text-[11px] text-muted-foreground pl-[18px]">
              +{(report.filesChanged?.length ?? 0) - 10} more
            </p>
          )}
        </div>
      )}
    </div>
  )
})
