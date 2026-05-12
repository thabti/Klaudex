import { memo, useCallback } from 'react'
import { IconShield, IconCheck, IconX } from '@tabler/icons-react'
import { ipc } from '@/lib/ipc'

interface PermissionOption {
  optionId: string
  name: string
  kind: string
}

interface PermissionCardProps {
  taskId: string
  requestId: string
  toolName: string
  description: string
  input?: Record<string, unknown>
  decisionReason?: string
  options: PermissionOption[]
}

const formatToolName = (raw: string): string => {
  if (!raw || raw === 'unknown') return 'a tool'
  return raw.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

const extractCommandPreview = (input?: Record<string, unknown>): string | null => {
  if (!input) return null
  const command = input.command ?? input.cmd ?? input.path ?? input.file_path ?? input.filePath
  return typeof command === 'string' ? command : null
}

export const PermissionCard = memo(function PermissionCard({
  taskId, requestId, toolName, description, input, decisionReason, options,
}: PermissionCardProps) {
  const displayName = formatToolName(toolName)
  const commandPreview = extractCommandPreview(input)

  const handleAllow = useCallback(() => {
    const allowOpt = options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always')
    ipc.allowPermission(taskId, requestId, allowOpt?.optionId).catch(() => {})
  }, [taskId, requestId, options])

  const handleDeny = useCallback(() => {
    const denyOpt = options.find((o) => o.kind === 'reject_once' || o.kind === 'reject_always')
    ipc.denyPermission(taskId, requestId, denyOpt?.optionId).catch(() => {})
  }, [taskId, requestId, options])

  return (
    <div
      data-testid="permission-card"
      className="my-3 overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.04] to-transparent"
    >
      <div className="flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/[0.06] px-4 py-2">
        <IconShield className="size-4 text-amber-500 dark:text-amber-400" aria-hidden />
        <span className="text-[12px] font-semibold tracking-wide text-amber-600 dark:text-amber-400">
          Permission Request
        </span>
      </div>

      <div className="px-4 py-3">
        <p className="text-[13px] text-foreground">
          <span className="font-medium">{displayName}</span>
          {description && <span className="text-muted-foreground"> — {description}</span>}
        </p>

        {commandPreview && (
          <code className="mt-2 block rounded-lg bg-muted/60 px-3 py-2 font-mono text-[12px] text-foreground/90">
            {commandPreview}
          </code>
        )}

        {decisionReason && (
          <p className="mt-2 text-[12px] text-muted-foreground italic">{decisionReason}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-amber-500/10 bg-amber-500/[0.02] px-4 py-2.5">
        <button
          type="button"
          onClick={handleDeny}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          aria-label="Deny permission"
          tabIndex={0}
        >
          <IconX className="size-3.5" aria-hidden />
          Deny
        </button>
        <button
          type="button"
          onClick={handleAllow}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          aria-label="Allow permission"
          tabIndex={0}
        >
          <IconCheck className="size-3.5" aria-hidden />
          Allow
        </button>
      </div>
    </div>
  )
})
