import { useCallback } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUpdateStore } from '@/stores/updateStore'

export const RestartPromptDialog = () => {
  const isReady = useUpdateStore((s) => s.status === 'ready')
  const updateInfo = useUpdateStore((s) => s.updateInfo)
  const triggerRestart = useUpdateStore((s) => s.triggerRestart)

  const handleRestart = useCallback(() => {
    triggerRestart?.()
  }, [triggerRestart])

  const handleDismiss = useCallback(() => {
    useUpdateStore.getState().reset()
  }, [])

  return (
    <Dialog open={isReady} onOpenChange={(open) => { if (!open) handleDismiss() }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconRefresh className="size-5 text-primary" aria-hidden />
            Update ready
          </DialogTitle>
          <DialogDescription>
            {updateInfo?.version
              ? `Klaudex v${updateInfo.version} has been downloaded. Restart to apply the update.`
              : 'A new version has been downloaded. Restart to apply the update.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Later
          </Button>
          <Button size="sm" onClick={handleRestart}>
            Restart now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
