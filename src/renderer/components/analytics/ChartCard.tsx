import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  readonly title: string
  readonly children: ReactNode
  readonly actions?: ReactNode
  readonly className?: string
}

export const ChartCard = ({ title, children, actions, className }: ChartCardProps) => (
  <div className={cn('rounded-xl border border-border/40 bg-card p-4', className)}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h3>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
    <div>{children}</div>
  </div>
)
