import { cn } from '@/lib/utils'

interface HorizontalBarSectionProps {
  readonly label: string
  readonly value: number
  readonly total: number
  readonly className?: string
}

const formatPercent = (ratio: number): string => {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%'
  if (ratio >= 1) return '100%'
  const pct = ratio * 100
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`
}

export const HorizontalBarSection = ({
  label,
  value,
  total,
  className,
}: HorizontalBarSectionProps) => {
  const hasData = total > 0 && Number.isFinite(total) && Number.isFinite(value)
  const safeValue = hasData ? Math.max(0, Math.min(value, total)) : 0
  const ratio = hasData ? safeValue / total : 0
  const widthPercent = hasData ? Math.max(0, Math.min(100, ratio * 100)) : 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] text-muted-foreground">{label}</span>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">
          {hasData ? (
            <>
              {safeValue.toLocaleString()}
              <span className="ml-1.5 text-muted-foreground/70">{formatPercent(ratio)}</span>
            </>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </span>
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40"
        role="progressbar"
        aria-label={label}
        aria-valuenow={hasData ? safeValue : 0}
        aria-valuemin={0}
        aria-valuemax={hasData ? total : 0}
      >
        {hasData ? (
          <div
            className="h-full rounded-full bg-foreground/80 transition-[width] duration-300 ease-out"
            style={{ width: `${widthPercent}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}
