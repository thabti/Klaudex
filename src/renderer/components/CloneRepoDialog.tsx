import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconAlertTriangle,
  IconFolder,
  IconGitFork,
  IconKey,
  IconLoader2,
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
import { Input } from '@/components/ui/input'
import { ipc, type GitCloneProgress } from '@/lib/ipc'

interface CloneRepoDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /**
   * Fired after a successful clone with the absolute path of the cloned repo.
   * Consumers (e.g. onboarding — TASK-039) hook this to switch the active
   * workspace; this dialog itself stays presentational.
   */
  readonly onSuccess?: (clonedPath: string) => void
}

/** Accept HTTPS, SSH (`git@host:org/repo.git`), and `ssh://` git URLs. */
const GIT_URL_PATTERN =
  /^(https?:\/\/.+\.git|https?:\/\/github\.com\/.+\/.+|git@.+:.+\/.+\.git|git@.+:.+\/.+|ssh:\/\/.+)$/

/** Extract a repo name from a git URL for the default folder name. */
const extractRepoName = (url: string): string => {
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '')
  const lastSegment = cleaned.split('/').pop() ?? cleaned.split(':').pop() ?? ''
  return lastSegment || 'repo'
}

/** Shorten the user's home directory for display only — the full path is sent to Rust. */
const toDisplayPath = (p: string): string => p.replace(/^\/Users\/[^/]+/, '~')

export const CloneRepoDialog = ({ open, onOpenChange, onSuccess }: CloneRepoDialogProps) => {
  const [url, setUrl] = useState('')
  const [targetDir, setTargetDir] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [sshKeyPath, setSshKeyPath] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<GitCloneProgress | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Focus the URL input when the dialog opens. When it closes, only the
  // *transient* state (progress, error, in-flight flag) is cleared — URL,
  // target, and SSH key are preserved so a user who hits "retry" after a
  // failure doesn't have to re-type them. The form fully resets only when
  // the consumer remounts the dialog.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => urlInputRef.current?.focus(), 100)
      return () => window.clearTimeout(id)
    }
    setError(null)
    setProgress(null)
    setIsCloning(false)
    return undefined
  }, [open])

  // Auto-update target dir when URL changes and a parent dir is set.
  useEffect(() => {
    if (!parentDir || !url.trim()) return
    const repoName = extractRepoName(url.trim())
    setTargetDir(`${parentDir}/${repoName}`)
  }, [url, parentDir])

  // Subscribe to progress events whenever the dialog is open. We unsub on
  // close (or unmount) so we don't keep mutating state for a clone the user
  // already walked away from. NOTE: the wave-2 Rust surface does NOT expose
  // `git_clone_cancel`, so closing the dialog mid-clone leaves the clone
  // running in the background — it will simply finish (or fail) without UI.
  useEffect(() => {
    if (!open) return undefined
    const unsubscribe = ipc.onGitCloneProgress((p) => setProgress(p))
    return () => unsubscribe()
  }, [open])

  const isValidUrl = url.trim().length > 0 && GIT_URL_PATTERN.test(url.trim())
  const canClone = isValidUrl && targetDir.trim().length > 0 && !isCloning

  const handleClose = useCallback(() => {
    if (isCloning) return
    onOpenChange(false)
  }, [isCloning, onOpenChange])

  const handlePickFolder = useCallback(async () => {
    const folder = await ipc.pickFolder()
    if (!folder) return
    setParentDir(folder)
    const repoName = url.trim() ? extractRepoName(url.trim()) : ''
    setTargetDir(repoName ? `${folder}/${repoName}` : folder)
    setError(null)
  }, [url])

  const handlePickSshKey = useCallback(async () => {
    // Reuse pickFolder for now — Klaudex's wave-2 surface doesn't yet expose
    // a generic file-picker IPC. Users can paste a path manually if needed;
    // this lets them at least browse to the parent directory of their key.
    const path = await ipc.pickFolder()
    if (!path) return
    setSshKeyPath(path)
    setError(null)
  }, [])

  const handleClone = useCallback(async () => {
    if (!canClone) return
    setIsCloning(true)
    setError(null)
    setProgress(null)
    const target = targetDir.trim()
    try {
      await ipc.gitClone(url.trim(), target, sshKeyPath.trim() || undefined)
      ipc.addRecentProject(target).catch(() => {})
      onSuccess?.(target)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setIsCloning(false)
    }
  }, [canClone, url, targetDir, sshKeyPath, onSuccess, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canClone) {
        e.preventDefault()
        void handleClone()
      }
    },
    [canClone, handleClone],
  )

  const displayPath = toDisplayPath(targetDir)
  const displaySshKey = toDisplayPath(sshKeyPath)
  const progressPercent =
    progress && progress.totalObjects > 0
      ? Math.min(100, Math.round((progress.receivedObjects / progress.totalObjects) * 100))
      : null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={!isCloning}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconGitFork className="size-5 text-primary" aria-hidden />
            Clone repository
          </DialogTitle>
          <DialogDescription>
            Paste an HTTPS or SSH URL and pick a destination folder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6 pb-2" onKeyDown={handleKeyDown}>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="clone-url"
              className="text-[12px] font-medium text-muted-foreground"
            >
              Repository URL
            </label>
            <Input
              ref={urlInputRef}
              id="clone-url"
              type="url"
              placeholder="https://github.com/user/repo.git"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              disabled={isCloning}
              aria-label="Repository URL"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="clone-path"
              className="text-[12px] font-medium text-muted-foreground"
            >
              Clone to
            </label>
            <div className="flex gap-2">
              <Input
                id="clone-path"
                type="text"
                placeholder="Pick a folder…"
                value={displayPath}
                onChange={(e) => {
                  setTargetDir(e.target.value)
                  setParentDir('')
                  setError(null)
                }}
                disabled={isCloning}
                aria-label="Target directory"
                className="flex-1"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handlePickFolder}
                disabled={isCloning}
                aria-label="Browse for folder"
                tabIndex={0}
              >
                <IconFolder className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="clone-ssh-key"
              className="text-[12px] font-medium text-muted-foreground"
            >
              SSH key path <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input
                id="clone-ssh-key"
                type="text"
                placeholder="~/.ssh/id_ed25519"
                value={displaySshKey}
                onChange={(e) => {
                  setSshKeyPath(e.target.value)
                  setError(null)
                }}
                disabled={isCloning}
                aria-label="SSH key path"
                className="flex-1"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handlePickSshKey}
                disabled={isCloning}
                aria-label="Browse for SSH key"
                tabIndex={0}
              >
                <IconKey className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          {isCloning && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>
                  {progress
                    ? `${progress.receivedObjects.toLocaleString()} / ${progress.totalObjects.toLocaleString()} objects`
                    : 'Starting clone…'}
                </span>
                {progressPercent !== null && <span>{progressPercent}%</span>}
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent ?? 0}
                aria-label="Clone progress"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${progressPercent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
              role="alert"
            >
              <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="break-all">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isCloning}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleClone} disabled={!canClone}>
            {isCloning ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                Cloning…
              </>
            ) : (
              'Clone'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CloneRepoDialog
