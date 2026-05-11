import { memo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useResizeHandle } from '@/hooks/useResizeHandle'

interface SplitDividerProps {
  readonly containerWidth: number
  readonly ratio: number
  readonly onRatioChange: (ratio: number) => void
  readonly onReset: () => void
}

const MIN_PANEL_PX = 400

export const SplitDivider = memo(function SplitDivider({
  containerWidth,
  ratio,
  onRatioChange,
  onReset,
}: SplitDividerProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleResize = useCallback((px: number) => {
    if (containerWidth <= 0) return
    onRatioChange(px / containerWidth)
  }, [containerWidth, onRatioChange])

  const currentPx = Math.round(ratio * containerWidth)

  const onMouseDown = useResizeHandle({
    axis: 'horizontal',
    size: currentPx,
    onResize: handleResize,
    min: MIN_PANEL_PX,
    max: containerWidth - MIN_PANEL_PX,
    onDragStart: () => setIsDragging(true),
    onDragEnd: () => setIsDragging(false),
  })

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split panels"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onRatioChange(ratio - 0.05) }
        if (e.key === 'ArrowRight') { e.preventDefault(); onRatioChange(ratio + 0.05) }
        if (e.key === 'Enter') { e.preventDefault(); onReset() }
      }}
      className={cn(
        'group relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center',
        'before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[""]',
        'focus-visible:outline-none',
      )}
    >
      {/* The visible 1px line */}
      <div
        className={cn(
          'absolute inset-y-0 w-px transition-colors duration-100',
          isDragging ? 'bg-primary/50' : 'bg-border group-hover:bg-muted-foreground/25',
        )}
      />
      {/* Tiny pill grip — appears on hover, centered */}
      <div
        className={cn(
          'relative z-10 rounded-full transition-all duration-150',
          isDragging
            ? 'h-8 w-1 bg-primary/60'
            : 'h-6 w-0.5 bg-transparent group-hover:h-8 group-hover:w-1 group-hover:bg-muted-foreground/30',
        )}
      />
    </div>
  )
})
