import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconPaperclip, IconClipboard, IconX, IconChevronDown } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { SlashCommandPicker } from './SlashCommandPicker'
import { SlashActionPanel } from './SlashPanels'
import { BranchSelector } from './BranchSelector'
import { FileMentionPicker, FileMentionPill } from './FileMentionPicker'
import { AttachmentPreview } from './AttachmentPreview'
import { DragOverlay } from './DragOverlay'
import { ContextRing } from './ContextRing'
import { ModelPicker } from './ModelPicker'
import { PlanToggle } from './PlanToggle'
import { AutoApproveToggle } from './AutoApproveToggle'
import { useChatInput } from '@/hooks/useChatInput'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PastedChunk } from '@/hooks/useChatInput'
import type { Attachment, ProjectFile } from '@/types'

/** Pill-shaped group wrapper for toolbar items */
const ToolbarGroup = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex items-center gap-0.5 rounded-lg bg-muted/50 px-0.5 py-0.5', className)}>
    {children}
  </div>
)

/** Thin dot separator within a group */
const Dot = () => <span className="mx-0.5 size-[3px] shrink-0 rounded-full bg-border" aria-hidden />

/** Detect macOS for keyboard shortcut labels */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl'

/** Max pills before collapsing into a summary */
export const PILLS_COLLAPSE_THRESHOLD = 4

interface PillsRowProps {
  mentionedFiles: readonly ProjectFile[]
  nonImageAttachments: readonly Attachment[]
  pastedChunks: readonly PastedChunk[]
  onRemoveMention: (path: string) => void
  onRemoveAttachment: (id: string) => void
  onRemoveChunk: (id: number) => void
}

export const PillsRow = memo(function PillsRow({ mentionedFiles, nonImageAttachments, pastedChunks, onRemoveMention, onRemoveAttachment, onRemoveChunk }: PillsRowProps) {
  const totalCount = mentionedFiles.length + nonImageAttachments.length + pastedChunks.length
  const [isExpanded, setIsExpanded] = useState(false)
  const isCollapsible = totalCount > PILLS_COLLAPSE_THRESHOLD
  const showAll = !isCollapsible || isExpanded

  const handleToggle = useCallback(() => setIsExpanded((v) => !v), [])

  // Build summary counts for collapsed state
  const summaryParts: string[] = []
  if (mentionedFiles.length > 0) summaryParts.push(`${mentionedFiles.length} file${mentionedFiles.length > 1 ? 's' : ''}`)
  if (nonImageAttachments.length > 0) summaryParts.push(`${nonImageAttachments.length} attachment${nonImageAttachments.length > 1 ? 's' : ''}`)
  if (pastedChunks.length > 0) summaryParts.push(`${pastedChunks.length} pasted`)

  return (
    <div className="flex flex-wrap items-center gap-1 mb-1" data-testid="pills-row">
      {isCollapsible && !isExpanded ? (
        <button
          type="button"
          onClick={handleToggle}
          data-testid="pills-expand-button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted/40 px-2.5 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground/70"
          aria-label={`${totalCount} items attached, click to expand`}
        >
          <IconPaperclip className="size-3.5" aria-hidden />
          <span>{summaryParts.join(', ')}</span>
          <IconChevronDown className="size-3.5" aria-hidden />
        </button>
      ) : (
        <>
          {mentionedFiles.map((f) => (
            <FileMentionPill key={f.path} path={f.path} onRemove={() => onRemoveMention(f.path)} />
          ))}
          {nonImageAttachments.length > 0 && (
            <AttachmentPreview attachments={nonImageAttachments} onRemove={onRemoveAttachment} />
          )}
          {pastedChunks.map((chunk) => (
            <span
              key={chunk.id}
              data-testid="pasted-chunk-pill"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium align-middle bg-muted/40 text-foreground/80"
            >
              <IconClipboard className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              <span className="max-w-[120px] truncate">Pasted #{chunk.id}</span>
              <span className="text-muted-foreground">+{chunk.lines > 1 ? `${chunk.lines}L` : `${chunk.chars}c`}</span>
              <button
                type="button"
                onClick={() => onRemoveChunk(chunk.id)}
                aria-label={`Remove pasted text #${chunk.id}`}
                className="ml-0.5 flex size-4 items-center justify-center rounded text-foreground/25 hover:text-foreground/50"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 1l6 6M7 1l-6 6" /></svg>
              </button>
            </span>
          ))}
          {isCollapsible && (
            <button
              type="button"
              onClick={handleToggle}
              data-testid="pills-collapse-button"
              className="inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[11px] text-foreground/30 transition-colors hover:text-foreground/50"
              aria-label="Collapse attachments"
            >
              <IconChevronDown className="size-3.5 rotate-180" aria-hidden />
              <span>Less</span>
            </button>
          )}
        </>
      )}
    </div>
  )
})

interface ChatInputProps {
  disabled?: boolean
  disabledReason?: string
  contextUsage?: { used: number; size: number } | null
  messageCount?: number
  isRunning?: boolean
  initialValue?: string
  autoFocus?: boolean
  hasQueuedMessages?: boolean
  onSendMessage: (message: string) => void
  onPause?: () => void
  onDraftChange?: (value: string) => void
  workspace?: string | null
}

export const ChatInput = memo(function ChatInput({ disabled, disabledReason, contextUsage, messageCount = 0, isRunning, initialValue, autoFocus, hasQueuedMessages, onSendMessage, onPause, onDraftChange, workspace }: ChatInputProps) {
  const {
    value, setValue, textareaRef, canSend,
    slashIndex, slashQuery, commands, filteredCmds, showPicker,
    panel, dismissPanel, handleSelectCommand,
    showFilePicker, mentionTrigger, mentionIndex, mentionedFiles,
    handleSelectFile, handleRemoveMention,
    attachments, isDragOver, fileInputRef,
    handleRemoveAttachment, handlePaste, handleFilePickerClick, handleFileInputChange,
    pastedChunks, handleRemoveChunk,
    handleChange, handleSend, handleKeyDown, handleSelect,
  } = useChatInput({ disabled, isRunning, initialValue, onSendMessage, onPause, onDraftChange })

  const currentModeId = useSettingsStore((s) => s.currentModeId)

  const imageAttachments = useMemo(() => attachments.filter((a) => a.type === 'image' && a.preview), [attachments])
  const nonImageAttachments = useMemo(() => attachments.filter((a) => a.type !== 'image' || !a.preview), [attachments])

  // Listen for /upload slash command
  useEffect(() => {
    const h = () => fileInputRef.current?.click()
    document.addEventListener('slash-upload', h)
    return () => document.removeEventListener('slash-upload', h)
  }, [fileInputRef])

  // Auto-focus textarea when requested (e.g. new thread)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus, textareaRef])

  // ── Cmd+L global shortcut to focus the chat input ──
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [textareaRef])

  // ── Scroll shadow: detect when textarea content overflows at top ──
  const [hasScrollShadow, setHasScrollShadow] = useState(false)
  const handleTextareaScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    setHasScrollShadow(e.currentTarget.scrollTop > 0)
  }, [])
  // Reset shadow when value changes and textarea is at top
  const scrollCheckRef = useRef<number>(0)
  useEffect(() => {
    cancelAnimationFrame(scrollCheckRef.current)
    scrollCheckRef.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        setHasScrollShadow(textareaRef.current.scrollTop > 0)
      }
    })
  }, [value, textareaRef])

  const isPlanMode = currentModeId === 'kiro_planner'
  const borderFocus = isPlanMode ? 'focus-within:border-teal-500/60' : 'focus-within:border-blue-500/60'
  const borderIdle = isPlanMode ? 'border-teal-500/25' : 'border-border'
  const buttonBg = isPlanMode ? 'bg-teal-500/90 hover:bg-teal-500' : 'bg-blue-500/90 hover:bg-blue-500'

  const contextRingNode = (contextUsage && contextUsage.size > 0)
    ? <ContextRing used={contextUsage.used} size={contextUsage.size} />
    : messageCount > 0
      ? <ContextRing used={Math.min(messageCount * 3, 95)} size={100} />
      : null

  const placeholderText = disabled
    ? (disabledReason ?? 'Task ended')
    : 'Ask anything, @ to mention files, / for commands — Shift+Enter for newline'

  return (
    <div data-testid="chat-input" className="px-4 pt-1.5 pb-4 sm:px-6 sm:pt-2 sm:pb-5">
      <div className="mx-auto w-full min-w-0 max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        <div className={cn(
          'relative rounded-[20px] border bg-card transition-colors duration-200',
          borderIdle, borderFocus,
          isDragOver && 'border-primary/50',
        )}>
          <DragOverlay visible={isDragOver} />

          {contextRingNode && (
            <div className="absolute top-2.5 right-3 z-20 sm:right-4">
              {contextRingNode}
            </div>
          )}

          <div className="relative px-3 pb-2 pt-3.5 sm:px-4 sm:pt-4" style={{ isolation: 'isolate' }}>
            {showPicker && (
              <SlashCommandPicker
                query={slashQuery}
                commands={commands}
                onSelect={handleSelectCommand}
                onDismiss={() => setValue('')}
                activeIndex={slashIndex}
              />
            )}
            {showFilePicker && (
              <FileMentionPicker
                query={mentionTrigger?.query ?? ''}
                workspace={workspace ?? null}
                onSelect={handleSelectFile}
                onDismiss={() => {}}
                activeIndex={mentionIndex}
              />
            )}
            {panel && <SlashActionPanel panel={panel} onDismiss={dismissPanel} />}
            {/* Inline image previews */}
            {imageAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imageAttachments.map((a) => (
                  <div key={a.id} className="group relative">
                    <img
                      src={a.preview}
                      alt={a.name}
                      className="h-16 w-auto rounded-lg border border-border/40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(a.id)}
                      aria-label={`Remove ${a.name}`}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-background border border-border/60 text-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground/80"
                    >
                      <IconX className="size-3" />
                    </button>
                    <span className="mt-0.5 block max-w-[80px] truncate text-center text-[10px] text-foreground/40">{a.name}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Pills row — mentions, non-image attachments, pasted text */}
            {(mentionedFiles.length > 0 || nonImageAttachments.length > 0 || pastedChunks.length > 0) && (
              <PillsRow
                mentionedFiles={mentionedFiles}
                nonImageAttachments={nonImageAttachments}
                pastedChunks={pastedChunks}
                onRemoveMention={handleRemoveMention}
                onRemoveAttachment={handleRemoveAttachment}
                onRemoveChunk={handleRemoveChunk}
              />
            )}
            {/* Scroll shadow at top of textarea when content overflows */}
            <div
              className={cn(
                'pointer-events-none absolute left-3 right-3 h-6 bg-gradient-to-b from-card to-transparent transition-opacity duration-200 sm:left-4 sm:right-4',
                hasScrollShadow ? 'opacity-100' : 'opacity-0',
              )}
              style={{ top: 'calc(0.875rem)' }}
              aria-hidden
            />
            <textarea
              ref={textareaRef}
              data-testid="chat-textarea"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onPaste={handlePaste}
              onScroll={handleTextareaScroll}
              placeholder={placeholderText}
              disabled={disabled}
              rows={1}
              className={cn(
                'block max-h-[200px] min-h-[70px] w-full resize-none rounded-lg bg-transparent leading-[1.6] text-foreground outline-none placeholder:text-muted-foreground/60',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              style={{ overflow: 'auto', fontFamily: 'inherit', caretColor: 'var(--foreground)' }}
            />
          </div>

          {/* ── Footer toolbar ── */}
          <div className="relative z-10 flex items-center justify-between gap-2 px-3 pb-3 sm:px-4">
            {/* Left: attach + AI controls (mode + model) */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleFilePickerClick}
                    aria-label="Attach files"
                    data-testid="attach-files-button"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-muted-foreground/70"
                  >
                    <IconPaperclip className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">Attach files or images</TooltipContent>
              </Tooltip>
              <ToolbarGroup>
                <PlanToggle />
                <Dot />
                <ModelPicker />
                <Dot />
                <AutoApproveToggle />
              </ToolbarGroup>
            </div>

            {/* Right: git + context + send/pause */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <BranchSelector workspace={workspace ?? null} />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
                tabIndex={-1}
                aria-hidden
              />
              {/* Focus hint */}
              <kbd className="hidden text-[10px] text-muted-foreground/50 sm:inline">{MOD_KEY}L</kbd>
              {isRunning ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onPause}
                      aria-label="Pause agent (Escape)"
                      data-testid="pause-button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-all duration-150 hover:scale-105"
                      style={{ backgroundColor: isPlanMode ? 'rgba(20,184,166,0.9)' : 'rgba(59,130,246,0.9)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <rect x="1.5" y="1" width="3" height="10" rx="1" />
                        <rect x="7.5" y="1" width="3" height="10" rx="1" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    Pause agent <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">Esc</kbd>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSend}
                      aria-label={isRunning ? 'Queue message (Enter)' : 'Send message (Enter)'}
                      data-testid="send-button"
                      className={cn(
                        'relative flex h-8 w-8 items-center justify-center rounded-full text-white transition-all duration-200 ease-out',
                        canSend ? buttonBg : 'bg-muted/60',
                        canSend && 'hover:scale-105',
                        'disabled:pointer-events-none disabled:hover:scale-100',
                      )}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {hasQueuedMessages && (
                        <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-amber-500" aria-label="Messages queued">
                          <span className="size-1.5 rounded-full bg-white" />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[11px]">
                    Send message <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">⏎</kbd>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
