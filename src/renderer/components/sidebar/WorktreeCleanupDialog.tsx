import { useCallback } from 'react'
import { IconGitBranch } from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/stores/taskStore'

export const WorktreeCleanupDialog = () => {
  const pending = useTaskStore((s) => s.worktreeCleanupPending)
  const resolve = useTaskStore((s) => s.resolveWorktreeCleanup)

  const handleRemove = useCallback(() => {
    resolve(true)
  }, [resolve])

  const handleKeep = useCallback(() => {
    resolve(false)
  }, [resolve])

  return (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) handleKeep() }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconGitBranch className="size-5 text-violet-500" aria-hidden />
            Worktree has uncommitted changes
          </DialogTitle>
          <DialogDescription>
            The worktree at <code className="rounded bg-muted px-1 py-0.5 text-[12px]">{pending?.worktreePath}</code> has uncommitted changes. Remove it anyway?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleKeep}>
            Keep worktree
          </Button>
          <Button variant="destructive" size="sm" onClick={handleRemove}>
            Remove anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
