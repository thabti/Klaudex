import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconLoader2,
  IconReload,
} from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ipc } from '@/lib/ipc'
import type { ClaudeMemoryFile } from '@/types'

interface MemoryFileEditorProps {
  /** When `null`, the dialog is closed; when a file is provided, it opens. */
  readonly file: ClaudeMemoryFile | null
  readonly onOpenChange: (open: boolean) => void
}

/** Best-effort match between a watcher payload path and the file we're editing.
 *
 * The Rust watcher (`commands/claude_watcher.rs`) reports either the file
 * itself or a parent directory (e.g. `~/.claude/`) depending on the platform's
 * notify backend. Path normalization across macOS APFS, symlinks, and `/var`
 * vs `/private/var` is brittle, so we use bidirectional substring matching:
 * either path being a substring of the other counts as a hit. The cost of an
 * occasional false-positive reload-when-not-dirty is one extra disk read; the
 * cost of a missed match would be silent stale UI, which is worse.
 */
const pathsMatch = (filePath: string, payloadPath: string): boolean => {
  if (!filePath || !payloadPath) return false
  if (filePath === payloadPath) return true
  return filePath.includes(payloadPath) || payloadPath.includes(filePath)
}

/**
 * Modal editor for a `CLAUDE.md` (or other `ClaudeMemoryFile`) document.
 *
 * Lifecycle:
 *  - Opens when `file` transitions from `null` to a value. The body is
 *    pre-populated from `file.body` if present (the parser may or may not
 *    populate it depending on file size); otherwise we lazily read from disk.
 *  - Save calls `ipc.writeTextFile`. On success we close. On failure we keep
 *    the body so the user can retry, and surface an inline banner.
 *  - Reload re-reads from disk. If the local body is dirty the user is
 *    prompted via `window.confirm` before discarding.
 *  - Subscribes to `onClaudeConfigChanged` for the editor's lifetime. If the
 *    payload's path matches the open file and the local body is *clean*, we
 *    auto-reload. If dirty, we show a "file changed externally" banner with
 *    explicit reload-or-keep choices.
 *  - The watcher listener is cleaned up on unmount per CLAUDE.md's "IPC event
 *    cleanup" learning.
 */
export const MemoryFileEditor = ({ file, onOpenChange }: MemoryFileEditorProps) => {
  const [body, setBody] = useState<string>('')
  const [originalBody, setOriginalBody] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** True when the on-disk file was changed by another process and the local
   * body is dirty, so we cannot auto-reload without losing the user's work. */
  const [externalChange, setExternalChange] = useState(false)

  // Latest dirty flag accessible from the watcher callback without re-creating
  // the listener on every keystroke. The listener is set up exactly once per
  // open file (see effect below).
  const isDirty = body !== originalBody
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // Track the currently-open file path inside the watcher closure. We intentionally
  // ref-capture it so the listener effect can depend only on `file?.filePath`
  // and not on the file object identity.
  const filePathRef = useRef<string | null>(file?.filePath ?? null)
  filePathRef.current = file?.filePath ?? null

  /** Read fresh contents from disk. Resets dirty state to clean. */
  const loadFromDisk = useCallback(async (path: string): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const contents = await ipc.readTextFile(path)
      const next = contents ?? ''
      setBody(next)
      setOriginalBody(next)
      setExternalChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // When `file` changes (becomes non-null), seed the editor with its body.
  // Prefer the parser-provided `body` if present, otherwise pull from disk.
  // The `ClaudeMemoryFile` type in this repo currently only exposes `excerpt`,
  // not a full `body` field, so the fall-through to disk is the common path —
  // but we still check for a `body` field defensively in case the Rust struct
  // gets extended later (the spec's prop description mentions `body?`).
  useEffect(() => {
    if (!file) {
      // Reset transient state when closing.
      setBody('')
      setOriginalBody('')
      setError(null)
      setExternalChange(false)
      setIsSaving(false)
      setIsLoading(false)
      return
    }
    const maybeBody = (file as { body?: string }).body
    if (typeof maybeBody === 'string' && maybeBody.length > 0) {
      setBody(maybeBody)
      setOriginalBody(maybeBody)
      setError(null)
      setExternalChange(false)
      return
    }
    void loadFromDisk(file.filePath)
  }, [file, loadFromDisk])

  // External-edit hot-reload. The watcher fires on `~/.claude/**` changes.
  // We re-read silently when the user isn't mid-edit; otherwise we show a
  // conflict banner and let them choose.
  useEffect(() => {
    if (!file) return undefined
    const unlisten = ipc.onClaudeConfigChanged((payload) => {
      const currentPath = filePathRef.current
      if (!currentPath) return
      if (!pathsMatch(currentPath, payload.path)) return
      if (isDirtyRef.current) {
        setExternalChange(true)
        return
      }
      void loadFromDisk(currentPath)
    })
    return () => {
      unlisten()
    }
  }, [file, loadFromDisk])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isSaving) return
      onOpenChange(nextOpen)
    },
    [isSaving, onOpenChange],
  )

  const handleSave = useCallback(async (): Promise<void> => {
    if (!file) return
    setIsSaving(true)
    setError(null)
    try {
      await ipc.writeTextFile(file.filePath, body)
      // Snapshot what we just wrote so a subsequent watcher event for our
      // own write doesn't get treated as an external change.
      setOriginalBody(body)
      setExternalChange(false)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }, [body, file, onOpenChange])

  const handleReload = useCallback(async (): Promise<void> => {
    if (!file) return
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Reload from disk and discard them?',
      )
      if (!confirmed) return
    }
    await loadFromDisk(file.filePath)
  }, [file, isDirty, loadFromDisk])

  /** External-change banner action: take the disk version, drop local edits. */
  const handleAcceptExternal = useCallback(async (): Promise<void> => {
    if (!file) return
    await loadFromDisk(file.filePath)
  }, [file, loadFromDisk])

  /** External-change banner action: keep local edits, dismiss the warning.
   * Saving will overwrite the on-disk version. */
  const handleKeepLocal = useCallback((): void => {
    setExternalChange(false)
  }, [])

  const open = file !== null
  const displayPath = file?.filePath ?? ''
  const scopeLabel = file?.source === 'global' ? 'Global' : 'Project'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] w-[min(92vw,720px)] max-w-none flex-col gap-0 p-0"
      >
        <DialogHeader className="border-b">
          <DialogTitle className="truncate">{file?.name ?? 'Memory file'}</DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {scopeLabel} · {displayPath}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 break-words">{error}</div>
            </div>
          )}

          {externalChange && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            >
              <div className="flex items-start gap-2">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  This file changed on disk while you were editing.
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pl-6">
                <Button size="sm" variant="outline" onClick={handleAcceptExternal}>
                  Reload and discard changes
                </Button>
                <Button size="sm" variant="ghost" onClick={handleKeepLocal}>
                  Keep my changes
                </Button>
              </div>
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isLoading || isSaving}
            spellCheck={false}
            placeholder={isLoading ? 'Loading…' : ''}
            className="min-h-[320px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-60"
            aria-label={`Edit ${file?.name ?? 'memory file'}`}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isDirty ? 'Unsaved changes' : 'Saved'}</span>
            <span>{body.length.toLocaleString()} chars</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleReload}
            disabled={isLoading || isSaving}
          >
            <IconReload className="size-4" aria-hidden />
            Reload
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || !isDirty}
          >
            {isSaving ? (
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <IconDeviceFloppy className="size-4" aria-hidden />
            )}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
