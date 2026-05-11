import { memo, useState } from 'react'
import {
  IconChevronDown, IconChevronRight, IconCheck, IconLoader2, IconX,
  IconFilePencil, IconTerminal2, IconGitCompare, IconPlayerStop,
} from '@tabler/icons-react'
import { createPatch } from 'diff'
import type { ToolCall } from '@/types'
import { cn } from '@/lib/utils'
import { useDiffStore } from '@/stores/diffStore'
import { useTaskStore } from '@/stores/taskStore'
import { ipc } from '@/lib/ipc'
import { InlineDiff } from './InlineDiff'
import { getToolIcon, getToolColor, getFileExtColor } from './tool-call-utils'
import { ReadOutput } from './ReadOutput'
import { isFetchToolCall, getFetchMeta, shortenUrl, formatBytes, formatDuration } from './fetch-display'
import { getToolDetail, formatToolDuration } from './tool-call-detail'

/** Colored file badge pill */
const FileBadge = memo(function FileBadge({ path }: { path: string }) {
  const shortPath = path.split('/').slice(-2).join('/')
  const dotColor = getFileExtColor(path)
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/70">
      <span className={cn('size-1.5 shrink-0 rounded-full', dotColor)} aria-hidden />
      {shortPath}
    </span>
  )
})

/** Status icon — filled circle checkmark for completed, spinner for running, X for failed, stop for cancelled */
const StatusIcon = memo(function StatusIcon({ status }: { status?: string }) {
  if (status === 'in_progress') {
    return <IconLoader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
  }
  if (status === 'failed') {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-red-500/15">
        <IconX className="size-2.5 text-red-500" />
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
        <IconPlayerStop className="size-2.5 text-orange-500" />
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
        <IconCheck className="size-2.5 text-emerald-500" strokeWidth={3} />
      </span>
    )
  }
  return null
})

export const ToolCallEntry = memo(function ToolCallEntry({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const [fileDiff, setFileDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const Icon = getToolIcon(toolCall.kind, toolCall.title)
  const colors = getToolColor(toolCall.kind, toolCall.title)
  const isRunning = toolCall.status === 'in_progress'
  const isFailed = toolCall.status === 'failed'
  const isCompleted = toolCall.status === 'completed'
  const isCancelled = toolCall.status === 'cancelled'

  const firstPath = toolCall.locations?.[0]?.path
  const isEditOp = toolCall.kind === 'edit' || toolCall.kind === 'delete' || toolCall.kind === 'move'
  const isFetchOp = isFetchToolCall(toolCall)
  const fetchMeta = isFetchOp ? getFetchMeta(toolCall) : null

  const toolDetail = !isFetchOp ? getToolDetail(toolCall) : null

  const hasContent = !!(
    toolCall.content?.length ||
    toolCall.rawInput !== undefined ||
    toolCall.rawOutput !== undefined
  )

  const isClickable = isEditOp || hasContent

  const fetchDiffIfNeeded = () => {
    if (!isEditOp || !isCompleted || !firstPath || fileDiff !== null || diffLoading) return
    const taskId = useTaskStore.getState().selectedTaskId
    if (!taskId) return
    setDiffLoading(true)
    ipc.gitDiffFile(taskId, firstPath).then((diff) => {
      if (diff) {
        setFileDiff(diff)
      } else {
        const diffContent = toolCall.content?.find((c) => c.type === 'diff')
        if (diffContent && (diffContent.oldText != null || diffContent.newText != null)) {
          const generated = createPatch(firstPath, diffContent.oldText ?? '', diffContent.newText ?? '')
          setFileDiff(generated)
        } else {
          setFileDiff('')
        }
      }
      setDiffLoading(false)
    }).catch(() => {
      setFileDiff('')
      setDiffLoading(false)
    })
  }

  const handleClick = () => {
    if (!isClickable) return
    setExpanded((v) => !v)
    if (!expanded) fetchDiffIfNeeded()
  }

  const handleOpenDiff = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!firstPath) return
    useDiffStore.getState().openToFile(firstPath)
  }

  const hasDiff = fileDiff !== null && fileDiff.length > 0

  // Build right-side metadata
  const rightMeta = buildRightMeta(fetchMeta, toolDetail, null)

  return (
    <div data-testid="tool-call-entry" className="group/entry">
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-left transition-colors',
          isClickable ? 'hover:bg-accent/50 cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Chevron */}
        {isClickable ? (
          expanded
            ? <IconChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
            : <IconChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Colored tool icon */}
        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', colors.bg)}>
          <Icon className={cn('size-3', colors.icon)} />
        </span>

        {/* Title + file badge */}
        <span className="min-w-0 flex-1 flex items-center gap-1.5 truncate">
          <span className={cn(
            'truncate font-medium',
            isRunning ? 'text-foreground' : 'text-foreground/80',
          )}>
            {toolCall.title}
          </span>

          {/* File badge */}
          {firstPath && <FileBadge path={firstPath} />}

          {/* Fetch URL */}
          {fetchMeta?.url && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                void ipc.openUrl(fetchMeta.url!)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.stopPropagation()
                e.preventDefault()
                void ipc.openUrl(fetchMeta.url!)
              }}
              title={fetchMeta.url}
              className="truncate font-mono text-[11px] text-primary/80 underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
            >
              {shortenUrl(fetchMeta.url)}
            </span>
          )}
        </span>

        {/* Right metadata */}
        {rightMeta && (
          <span className="hidden sm:inline shrink-0 tabular-nums text-[10px] text-muted-foreground/70">
            {rightMeta}
          </span>
        )}

        {/* Cancelled label */}
        {isCancelled && (
          <span className="shrink-0 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-500">
            Cancelled
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {isEditOp && isCompleted && firstPath && (
          <span className="hidden shrink-0 items-center gap-0.5 group-hover/entry:flex">
            <button
              type="button"
              onClick={handleOpenDiff}
              className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="View diff"
            >
              <IconGitCompare className="size-3" />
            </button>
          </span>
        )}

        {/* Loading indicator */}
        {diffLoading && <IconLoader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />}

        {/* Status icon */}
        <StatusIcon status={toolCall.status} />
      </button>

      {expanded && hasDiff && <InlineDiff diffText={fileDiff} />}

      {expanded && hasContent && toolCall.kind === 'read' && (
        <ReadOutput rawInput={toolCall.rawInput} rawOutput={toolCall.rawOutput} />
      )}

      {expanded && hasContent && toolCall.kind !== 'read' && (
        <div className="ml-8 mr-2 mb-2 mt-1 min-w-0 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-[12px] space-y-2">
          {toolCall.content?.map((item, i) => (
            <div key={i}>
              {item.type === 'diff' && item.path && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                    <IconFilePencil className="size-3" />
                    <FileBadge path={item.path} />
                  </p>
                  {item.newText && (
                    <pre className="max-h-48 overflow-auto rounded-md bg-background/80 p-2 font-mono text-[11px] leading-[1.6] text-foreground/70">
                      {item.newText.slice(0, 2000)}{item.newText.length > 2000 ? '\n...(truncated)' : ''}
                    </pre>
                  )}
                </div>
              )}
              {item.type === 'terminal' && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IconTerminal2 className="size-3" />
                  <span className="font-mono text-[11px]">Terminal: {item.terminalId}</span>
                </div>
              )}
              {item.type === 'content' && item.text && (
                <pre className="max-h-48 overflow-auto rounded-md bg-background/80 p-2 font-mono text-[11px] leading-[1.6]">
                  {item.text.slice(0, 2000)}{item.text.length > 2000 ? '\n...(truncated)' : ''}
                </pre>
              )}
            </div>
          ))}

          <RawInputOutput rawInput={toolCall.rawInput} rawOutput={toolCall.rawOutput} filePath={firstPath} />
        </div>
      )}
    </div>
  )
})

// ── Right-side metadata builder ──────────────────────────────────

function buildRightMeta(
  fetchMeta: ReturnType<typeof getFetchMeta> | null,
  toolDetail: ReturnType<typeof getToolDetail> | null,
  shortPath: string | null,
): string | null {
  if (fetchMeta) {
    const parts = [
      fetchMeta.bytes != null ? formatBytes(fetchMeta.bytes) : null,
      fetchMeta.durationMs != null ? formatDuration(fetchMeta.durationMs) : null,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (toolDetail) {
    const parts = [
      toolDetail.durationMs != null && toolDetail.durationMs >= 200
        ? formatToolDuration(toolDetail.durationMs)
        : null,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  return null
}

// ── Smarter rendering for rawInput / rawOutput ───────────────────

const parseRaw = (raw: unknown): Record<string, unknown> | null => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed } catch { /* not JSON */ }
  }
  return null
}

const isSimpleMessage = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < 200 && !trimmed.includes('\n')) return trimmed
  return null
}

const RawInputOutput = memo(function RawInputOutput({
  rawInput,
  rawOutput,
  filePath,
}: {
  rawInput?: unknown
  rawOutput?: unknown
  filePath?: string | null
}) {
  if (rawInput === undefined && rawOutput === undefined) return null

  const inputObj = rawInput !== undefined ? parseRaw(rawInput) : null
  const hasStrReplace = inputObj && typeof inputObj.oldStr === 'string' && typeof inputObj.newStr === 'string'

  if (hasStrReplace) {
    const oldStr = inputObj.oldStr as string
    const newStr = inputObj.newStr as string
    const path = (inputObj.path as string) ?? filePath ?? 'file'
    const diffText = createPatch(path, oldStr, newStr, '', '', { context: 3 })
    const simpleOut = rawOutput !== undefined ? isSimpleMessage(rawOutput) : null

    return (
      <>
        <InlineDiff diffText={diffText} />
        {simpleOut && (
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-500">
            <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500/15">
              <IconCheck className="size-2" strokeWidth={3} />
            </span>
            {simpleOut}
          </p>
        )}
        {rawOutput !== undefined && !simpleOut && (
          <FallbackRaw label="Output" raw={rawOutput} />
        )}
      </>
    )
  }

  return (
    <>
      {rawInput !== undefined && <FallbackRaw label="Input" raw={rawInput} />}
      {rawOutput !== undefined && (() => {
        const simpleOut = isSimpleMessage(rawOutput)
        if (simpleOut) {
          return (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-500">
              <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500/15">
                <IconCheck className="size-2" strokeWidth={3} />
              </span>
              {simpleOut}
            </p>
          )
        }
        return <FallbackRaw label="Output" raw={rawOutput} />
      })()}
    </>
  )
})

const FallbackRaw = memo(function FallbackRaw({ label, raw }: { label: string; raw: unknown }) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2) ?? ''
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <pre className="max-h-32 overflow-auto rounded-md bg-background/80 p-2 font-mono text-[11px] leading-[1.6] text-foreground/70">
        {text.slice(0, 1500)}{text.length > 1500 ? '\n…(truncated)' : ''}
      </pre>
    </div>
  )
})
