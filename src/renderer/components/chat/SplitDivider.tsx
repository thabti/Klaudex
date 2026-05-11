import { memo, useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * SplitDivider — draggable vertical divider between two split panels.
 *
 * Drives a fractional ratio (0..1) representing the left panel's share of
 * the parent's width. Clamped to [MIN_RATIO, MAX_RATIO] so neither panel can
 * collapse below 30% or grow past 70%. Double-click resets to 0.5.
 *
 * The component is layout-agnostic: it owns no width measurement of its own
 * and instead reads the bounding rect of its parent on drag start. That keeps
 * it usable in any flex container without prop plumbing of `containerWidth`.
 */

interface SplitDividerProps {
  readonly ratio: number
  readonly onRatioChange: (ratio: number) => void
  readonly onReset?: () => void
}

const MIN_RATIO = 0.3
const MAX_RATIO = 0.7
const KEYBOARD_STEP = 0.05

const clampRatio = (value: number): number => Math.max(MIN_RATIO, Math.min(MAX_RATIO, value))

export const SplitDivider = memo(function SplitDivider({
  ratio,
  onRatioChange,
  onReset,
}: SplitDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null)
  const rafIdRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset()
      return
    }
    onRatioChange(0.5)
  }, [onRatioChange, onReset])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const parent = dividerRef.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    if (rect.width <= 0) return

    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.body.style.pointerEvents = 'none'
    ;(event.target as HTMLElement).style.pointerEvents = 'auto'

    const handleMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        const raw = (ev.clientX - rect.left) / rect.width
        // Clamp early — even if the user drags well past either edge, the
        // ratio stays at MIN_RATIO/MAX_RATIO so panels don't collapse and the
        // drag handle remains visible at the clamped boundary.
        onRatioChange(clampRatio(raw))
      })
    }
    const handleUp = () => {
      cancelAnimationFrame(rafIdRef.current)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.body.style.pointerEvents = ''
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      setIsDragging(false)
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [onRatioChange])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onRatioChange(clampRatio(ratio - KEYBOARD_STEP))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onRatioChange(clampRatio(ratio + KEYBOARD_STEP))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      handleReset()
    }
  }, [ratio, onRatioChange, handleReset])

  return (
    <div
      ref={dividerRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize split panels"
      aria-valuemin={Math.round(MIN_RATIO * 100)}
      aria-valuemax={Math.round(MAX_RATIO * 100)}
      aria-valuenow={Math.round(clampRatio(ratio) * 100)}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleReset}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center',
        'before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[""]',
        'focus-visible:outline-none',
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 w-px transition-colors duration-100',
          isDragging ? 'bg-primary/50' : 'bg-border group-hover:bg-muted-foreground/25',
        )}
      />
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
