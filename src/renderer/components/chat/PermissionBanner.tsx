import { memo, useMemo } from 'react'
import { IconShieldExclamation, IconCheck, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface PermissionOption {
  optionId: string
  name: string
  kind: string
}

interface PermissionBannerProps {
  taskId: string
  toolName: string
  description: string
  options: PermissionOption[]
  onSelect: (optionId: string) => void
}

function formatToolName(raw: string): string {
  if (!raw || raw === 'unknown') return 'a tool'
  return raw
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
}

const KIND_STYLES: Record<string, string> = {
  allow_once: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
  allow_always: 'bg-emerald-500/5 text-emerald-600/80 hover:bg-emerald-500/15 dark:text-emerald-400/80',
  reject_once: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
  reject_always: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive/80',
}

const KIND_ICONS: Record<string, typeof IconCheck | null> = {
  allow_once: IconCheck,
  allow_always: IconCheck,
  reject_once: IconX,
  reject_always: IconX,
}

export const PermissionBanner = memo(function PermissionBanner({
  toolName, description: _description, options, onSelect,
}: PermissionBannerProps) {
  const displayName = formatToolName(toolName)

  const ORDER = ['allow_once', 'allow_always', 'reject_once', 'reject_always']
  const sorted = useMemo(() => [...options].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)), [options])

  return (
    <div data-testid="permission-banner" className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-2 sm:px-6 lg:max-w-4xl xl:max-w-5xl">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
        <IconShieldExclamation className="size-5 shrink-0 text-amber-500 dark:text-amber-400" />
        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          <span className="font-medium">Claude</span>
          <span className="text-muted-foreground"> wants to use </span>
          <span className="font-medium">{displayName}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Permission actions">
          {sorted.map((opt) => {
            const Icon = KIND_ICONS[opt.kind]
            return (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => onSelect(opt.optionId)}
                aria-label={`${opt.name} ${displayName}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                  KIND_STYLES[opt.kind] ?? 'text-muted-foreground hover:bg-accent',
                )}
              >
                {Icon && <Icon className="size-3" aria-hidden />}
                {opt.name}
              </button>
            )
          })}
          {sorted.length === 0 && (
            <>
              <button
                type="button"
                onClick={() => onSelect('__allow__')}
                aria-label={`Allow ${displayName}`}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <IconCheck className="size-3" aria-hidden /> Allow
              </button>
              <button
                type="button"
                onClick={() => onSelect('__deny__')}
                aria-label={`Deny ${displayName}`}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <IconX className="size-3" aria-hidden /> Deny
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
