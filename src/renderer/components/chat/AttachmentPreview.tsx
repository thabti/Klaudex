import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { IconX, IconFileText, IconFileCode, IconFile, IconPhoto, IconClipboard, IconExternalLink } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { ipc } from '@/lib/ipc'
import type { Attachment } from '@/types'

const EXT_ICON_MAP: Record<string, typeof IconFile> = {
  ts: IconFileCode, tsx: IconFileCode, js: IconFileCode, jsx: IconFileCode,
  py: IconFileCode, rs: IconFileCode, go: IconFileCode, rb: IconFileCode,
  json: IconFileCode, yaml: IconFileCode, yml: IconFileCode, toml: IconFileCode,
  md: IconFileText, txt: IconFileText, csv: IconFileText, log: IconFileText,
}

const TYPE_ICON_MAP: Record<string, typeof IconFile> = {
  image: IconPhoto,
  text: IconClipboard,
  binary: IconFile,
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface AttachmentPreviewProps {
  readonly attachments: readonly Attachment[]
  readonly onRemove: (id: string) => void
}

export const AttachmentPreview = memo(function AttachmentPreview({
  attachments,
  onRemove,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) return null

  return (
    <>
      {attachments.map((a) => (
        <AttachmentPill key={a.id} attachment={a} onRemove={onRemove} />
      ))}
    </>
  )
})

// ── Inline preview popover ───────────────────────────────────────

const PreviewPopover = memo(function PreviewPopover({
  attachment,
  onClose,
  onOpenExternal,
}: {
  attachment: Attachment
  onClose: () => void
  onOpenExternal: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isImage = attachment.type === 'image' && attachment.preview
  const hasText = !!attachment.textContent

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl shadow-black/30 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
    >
      {/* Preview content */}
      {isImage && (
        <div className="bg-black/20 p-2">
          <img
            src={attachment.preview}
            alt={attachment.name}
            className="max-h-48 w-full rounded-lg object-contain"
          />
        </div>
      )}
      {hasText && (
        <div className="max-h-40 overflow-auto bg-black/10 p-3">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/70">
            {attachment.textContent!.slice(0, 2000)}
            {attachment.textContent!.length > 2000 && (
              <span className="text-foreground/30">…</span>
            )}
          </pre>
        </div>
      )}
      {!isImage && !hasText && (
        <div className="flex items-center justify-center py-6 text-[11px] text-foreground/30">
          No preview available
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-foreground/70">{attachment.name}</p>
          <p className="text-[10px] text-foreground/30">{formatSize(attachment.size)}</p>
        </div>
        {attachment.path && (
          <button
            type="button"
            onClick={onOpenExternal}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-foreground/40 transition-colors hover:bg-muted/30 hover:text-foreground/70"
          >
            <IconExternalLink className="size-3" />
            Open
          </button>
        )}
      </div>
    </div>
  )
})

// ── Pill ─────────────────────────────────────────────────────────

const AttachmentPill = memo(function AttachmentPill({
  attachment,
  onRemove,
}: {
  readonly attachment: Attachment
  readonly onRemove: (id: string) => void
}) {
  const [showPreview, setShowPreview] = useState(false)

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove(attachment.id)
  }, [attachment.id, onRemove])

  const handleOpenExternal = useCallback(() => {
    if (attachment.path) ipc.openUrl(attachment.path)
    setShowPreview(false)
  }, [attachment.path])

  const handleClick = useCallback(() => {
    setShowPreview((v) => !v)
  }, [])

  const ext = attachment.name.split('.').pop()?.toLowerCase() ?? ''
  const Icon = EXT_ICON_MAP[ext] ?? TYPE_ICON_MAP[attachment.type] ?? IconFile
  const isImage = attachment.type === 'image' && attachment.preview

  return (
    <div className="relative">
      <div
        className={cn(
          'group inline-flex h-[26px] cursor-pointer items-center gap-1 rounded-md border border-border/50 bg-muted/20 pl-1.5 pr-1 transition-colors hover:bg-muted/30',
          showPreview && 'border-primary/40 bg-primary/5',
        )}
        role="listitem"
        aria-label={`${attachment.type}: ${attachment.name}`}
        onClick={handleClick}
      >
        {isImage ? (
          <img
            src={attachment.preview}
            alt={attachment.name}
            className="size-4 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <Icon className="size-3 shrink-0 text-foreground/30" aria-hidden />
        )}
        <span className="max-w-[140px] truncate text-[11px] text-foreground/70">
          {attachment.name}
        </span>
        <span className="text-[10px] text-foreground/25">
          {formatSize(attachment.size)}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Remove ${attachment.name}`}
          className="flex size-4 items-center justify-center rounded text-foreground/20 transition-colors hover:bg-foreground/10 hover:text-foreground/50"
        >
          <IconX className="size-2.5" aria-hidden />
        </button>
      </div>

      {showPreview && (
        <PreviewPopover
          attachment={attachment}
          onClose={() => setShowPreview(false)}
          onOpenExternal={handleOpenExternal}
        />
      )}
    </div>
  )
})
