import { useCallback, useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconClockHour4,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconSparkles,
} from '@tabler/icons-react'
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
import { useUpdateStore } from '@/stores/updateStore'
import { useUpdateChecker } from '@/hooks/useUpdateChecker'
import { ipc } from '@/lib/ipc'

interface UpdateAvailableDialogProps {
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

const SNOOZE_KEY = 'klaudex-update-snoozed-until'
const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * Snooze the update prompt for 24h. Persisted in localStorage so the snooze
 * survives an app reload. The setter and getter both swallow errors (private
 * browsing, quota exceeded, etc.) and just degrade to "no snooze active".
 */
const snoozeFor24h = (): void => {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch (err) {
    console.warn('[update-dialog] Failed to persist snooze:', err)
  }
}

/** Read the snoozed-until timestamp; returns null when absent or storage fails. */
export const getUpdateSnoozeUntil = (): number | null => {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** True iff the snooze window is still active. */
export const isUpdateSnoozed = (): boolean => {
  const until = getUpdateSnoozeUntil()
  return until !== null && until > Date.now()
}

export const UpdateAvailableDialog = ({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: UpdateAvailableDialogProps = {}) => {
  // Drive the actual updater plugin via the existing hook (it already wraps
  // `import('@tauri-apps/plugin-updater')` lazily, sets store status, and
  // streams progress chunks). The hook also auto-checks on mount, so we
  // only consume its imperative actions here.
  const { downloadAndInstall, restart } = useUpdateChecker()
  const status = useUpdateStore((s) => s.status)
  const updateInfo = useUpdateStore((s) => s.updateInfo)
  const progress = useUpdateStore((s) => s.progress)
  const storeError = useUpdateStore((s) => s.error)
  const setError = useUpdateStore((s) => s.setError)
  const [isRestarting, setIsRestarting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Self-contained mode: auto-open when update available and not snoozed
  const isAvailable = status === 'available' && updateInfo !== null && !isUpdateSnoozed()
  const isDownloading = status === 'downloading'
  const isReady = status === 'ready'
  const selfOpen = isAvailable || isDownloading || isReady
  const open = controlledOpen ?? selfOpen
  const onOpenChange = controlledOnOpenChange ?? (() => {})
  const downloadPercent = progress?.total
    ? Math.round((progress.downloaded / progress.total) * 100)
    : null
  const error = localError ?? (status === 'error' ? storeError : null)

  const handleSnooze = useCallback(() => {
    if (isDownloading || isRestarting) return
    snoozeFor24h()
    onOpenChange(false)
  }, [isDownloading, isRestarting, onOpenChange])

  const handleUpdate = useCallback(async () => {
    setLocalError(null)
    try {
      await downloadAndInstall()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    }
  }, [downloadAndInstall])

  const handleRetry = useCallback(() => {
    setLocalError(null)
    setError(null)
    void handleUpdate()
  }, [setError, handleUpdate])

  const handleRestart = useCallback(async () => {
    if (isRestarting) return
    setIsRestarting(true)
    try {
      await restart()
      // After install, ask the backend to flush state and relaunch the
      // window. `relaunch()` (used inside `restart()`) tears down the
      // process; this is a belt-and-suspenders fallback if it ever returns.
      ipc.requestRelaunch().catch(() => {})
    } catch (err) {
      setIsRestarting(false)
      setLocalError(err instanceof Error ? err.message : String(err))
    }
  }, [isRestarting, restart])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return
      // Treat closing the dialog the same as "Remind me later" — but only
      // when no install is in flight (the close button is hidden during
      // download, but Escape can still fire).
      if (isDownloading || isRestarting) return
      handleSnooze()
    },
    [isDownloading, isRestarting, handleSnooze],
  )

  const markdownNotes = useMemo(() => {
    const body = updateInfo?.body?.trim()
    if (!body) return null
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <h2 className="mt-0 mb-2 text-sm font-semibold text-foreground" {...props} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h3 className="mt-3 mb-1.5 text-[13px] font-semibold text-foreground" {...props} />
          ),
          h3: ({ node: _node, ...props }) => (
            <h4 className="mt-2 mb-1 text-[13px] font-semibold text-foreground" {...props} />
          ),
          p: ({ node: _node, ...props }) => (
            <p className="my-1.5 text-[12px] leading-relaxed text-foreground/80" {...props} />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul className="my-1.5 space-y-1 pl-1" {...props} />
          ),
          li: ({ node: _node, children, ...props }) => (
            <li className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/80" {...props}>
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/40" aria-hidden />
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
            <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    )
  }, [updateInfo?.body])

  const title = isReady
    ? 'Update ready'
    : `Klaudex v${updateInfo?.version ?? ''} available`

  const description = isReady
    ? 'The update has been downloaded. Restart to apply.'
    : isDownloading
      ? downloadPercent !== null
        ? `Downloading update… ${downloadPercent}%`
        : 'Downloading update…'
      : 'A new version is ready to install.'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[60] max-w-sm"
        overlayClassName="z-[60]"
        showCloseButton={!isDownloading && !isRestarting}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {isReady ? (
              <IconRefresh className="size-5 text-primary" aria-hidden />
            ) : (
              <IconSparkles className="size-5 text-primary" aria-hidden />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {markdownNotes && !isDownloading && (
          <div className="max-h-56 overflow-y-auto px-6 pb-2">{markdownNotes}</div>
        )}

        {isDownloading && (
          <div className="px-6 pb-2">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={downloadPercent ?? 0}
              aria-label="Download progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${downloadPercent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div
            className="mx-6 mb-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
            role="alert"
          >
            <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="break-all">{error}</span>
          </div>
        )}

        <DialogFooter>
          {isReady ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleSnooze} disabled={isRestarting}>
                <IconClockHour4 className="size-4" aria-hidden />
                Later
              </Button>
              <Button size="sm" onClick={handleRestart} disabled={isRestarting}>
                {isRestarting ? (
                  <>
                    <IconLoader2 className="size-4 animate-spin" aria-hidden />
                    Restarting…
                  </>
                ) : (
                  <>
                    <IconRefresh className="size-4" aria-hidden />
                    Restart now
                  </>
                )}
              </Button>
            </>
          ) : isDownloading ? (
            <Button variant="ghost" size="sm" disabled>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              Downloading…
            </Button>
          ) : error ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleSnooze}>
                <IconClockHour4 className="size-4" aria-hidden />
                Remind me later
              </Button>
              <Button size="sm" onClick={handleRetry}>
                <IconRefresh className="size-4" aria-hidden />
                Retry
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleSnooze}>
                <IconClockHour4 className="size-4" aria-hidden />
                Remind me later
              </Button>
              <Button size="sm" onClick={() => void handleUpdate()}>
                <IconDownload className="size-4" aria-hidden />
                Update now
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateAvailableDialog
