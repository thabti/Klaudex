import { useCallback, useMemo } from 'react'
import { IconSparkles, IconX } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ChangelogEntry {
  readonly version: string
  /** Markdown release notes. Rendered via react-markdown + remark-gfm. */
  readonly notes: string
}

/**
 * Changelog entries ordered newest-first.
 * The most recent entry whose version > last seen is shown after an update.
 *
 * Use markdown for the `notes` field. Block-level elements (lists, headings, links)
 * are supported via remark-gfm.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.2.0',
    notes: `## Welcome to Klaudex

- Native macOS app for managing **Claude** coding agents via the Agent Client Protocol
- Chat interface with streaming responses, task management, and integrated diff viewer
- First-class git operations and worktree support
- Per-project model selection and slash commands

Thanks for trying Klaudex!`,
  },
] as const

/**
 * Parse a semver string into [major, minor, patch]. Missing parts default to 0.
 * Strips a leading "v" if present.
 */
const parseVersion = (raw: string): [number, number, number] => {
  const v = raw.replace(/^v/i, '')
  const parts = v.split('.').map((p) => Number.parseInt(p, 10))
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

/** Returns the major version number from a semver string. */
export const getMajorVersion = (raw: string): number => parseVersion(raw)[0]

/** True if `a` has a strictly greater major version than `b`. */
export const isNewerMajorVersion = (a: string, b: string): boolean =>
  getMajorVersion(a) > getMajorVersion(b)

/** True if `a` is strictly newer than `b` by full semver comparison. */
export const isNewerVersion = (a: string, b: string): boolean => {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return true
    if (va < vb) return false
  }
  return false
}

/**
 * Find the changelog entry to show for a given version.
 * Prefers an exact-version match, then falls back to the newest entry strictly
 * newer than `lastSeen`.
 */
export const findChangelogEntry = (
  currentVersion: string,
  lastSeen: string | null,
): ChangelogEntry | null => {
  const exact = CHANGELOG.find((e) => e.version === currentVersion)
  if (exact) return exact
  if (!lastSeen) return CHANGELOG[0] ?? null
  return CHANGELOG.find((e) => isNewerVersion(e.version, lastSeen)) ?? null
}

interface WhatsNewDialogProps {
  open: boolean
  /** When null, the dialog falls back to a generic "Updated to vX.Y.Z" message. */
  entry: ChangelogEntry | null
  /** Current app version, used for the generic fallback when `entry` is null. */
  currentVersion: string
  onDismiss: () => void
}

export const WhatsNewDialog = ({ open, entry, currentVersion, onDismiss }: WhatsNewDialogProps) => {
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onDismiss()
    },
    [onDismiss],
  )

  const displayVersion = entry?.version ?? currentVersion
  const hasNotes = !!entry && entry.notes.trim().length > 0

  // Memoize markdown body so re-renders don't re-parse the AST.
  const markdownBody = useMemo(() => {
    if (!hasNotes || !entry) return null
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <h2 className="mt-0 mb-3 text-base font-semibold text-foreground" {...props} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h3 className="mt-4 mb-2 text-sm font-semibold text-foreground" {...props} />
          ),
          h3: ({ node: _node, ...props }) => (
            <h4 className="mt-3 mb-2 text-sm font-semibold text-foreground" {...props} />
          ),
          p: ({ node: _node, ...props }) => (
            <p className="my-2 text-[14px] leading-relaxed text-foreground/80" {...props} />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul className="my-2 space-y-1.5 pl-1" {...props} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol className="my-2 list-decimal space-y-1.5 pl-5" {...props} />
          ),
          li: ({ node: _node, children, ...props }) => (
            <li className="flex items-start gap-2.5 text-[14px] leading-relaxed text-foreground/80" {...props}>
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden />
              <span className="min-w-0 flex-1">{children}</span>
            </li>
          ),
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            />
          ),
          code: ({ node: _node, ...props }) => (
            <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[12px]" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
        }}
      >
        {entry.notes}
      </ReactMarkdown>
    )
  }, [hasNotes, entry])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="flex-row items-start gap-4 p-6 pb-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <IconSparkles size={28} stroke={1.5} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0 pt-0.5">
            <DialogTitle className="text-xl font-semibold">What&apos;s New</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              v{displayVersion}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            aria-label="Close"
          >
            <IconX className="size-4" />
          </button>
        </DialogHeader>

        <div className="px-6 pb-6">
          {markdownBody ?? (
            <p className="text-[14px] leading-relaxed text-foreground/80">
              Updated to v{displayVersion}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button size="lg" onClick={onDismiss}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
