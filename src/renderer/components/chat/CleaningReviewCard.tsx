import { memo, useState, useCallback } from 'react'
import { IconStar, IconStarFilled, IconSparkles, IconCalendar } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CleaningReviewCardProps {
  /** Cleaner's display name */
  readonly cleanerName: string
  /** Cleaning service date (ISO string or display string) */
  readonly date: string
  /** Unique cleaning session ID */
  readonly cleaningId: string
  /** Service type label */
  readonly serviceType?: string
  /** Cleaner avatar URL (falls back to initials) */
  readonly avatarUrl?: string
  /** Pre-selected rating (0 = unrated) */
  readonly initialRating?: number
  /** Called when user submits a rating */
  readonly onRate?: (rating: number) => void
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_STARS = 5 as const
const STAR_LABELS = [
  'Terrible',
  'Poor',
  'Okay',
  'Good',
  'Excellent',
] as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const formatCleaningId = (id: string): string =>
  id.length > 8 ? `#${id.slice(0, 8)}` : `#${id}`

/* ------------------------------------------------------------------ */
/*  Star button                                                        */
/* ------------------------------------------------------------------ */

interface StarButtonProps {
  readonly index: number
  readonly isFilled: boolean
  readonly isHovered: boolean
  readonly label: string
  readonly onSelect: (index: number) => void
  readonly onHover: (index: number) => void
  readonly onLeave: () => void
  readonly isSubmitted: boolean
}

const StarButton = memo(function StarButton({
  index,
  isFilled,
  isHovered,
  label,
  onSelect,
  onHover,
  onLeave,
  isSubmitted,
}: StarButtonProps) {
  const handleClick = useCallback(() => onSelect(index), [onSelect, index])
  const handleMouseEnter = useCallback(() => onHover(index), [onHover, index])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(index)
    }
  }, [onSelect, index])

  const Icon = isFilled ? IconStarFilled : IconStar

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      onKeyDown={handleKeyDown}
      disabled={isSubmitted}
      className={cn(
        'rounded-sm p-0.5 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        isSubmitted
          ? 'cursor-default'
          : 'cursor-pointer hover:scale-110 active:scale-95',
        isFilled
          ? 'text-amber-400 dark:text-amber-300'
          : isHovered
            ? 'text-amber-300/70 dark:text-amber-400/50'
            : 'text-muted-foreground/30',
      )}
      aria-label={`Rate ${index + 1} out of ${MAX_STARS}: ${label}`}
      role="radio"
      aria-checked={isFilled}
      tabIndex={0}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
})

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CleaningReviewCard = memo(function CleaningReviewCard({
  cleanerName,
  date,
  cleaningId,
  serviceType = 'Home Cleaning',
  avatarUrl,
  initialRating = 0,
  onRate,
}: CleaningReviewCardProps) {
  const [rating, setRating] = useState(initialRating)
  const [hoveredStar, setHoveredStar] = useState(-1)
  const [isSubmitted, setIsSubmitted] = useState(initialRating > 0)

  const displayRating = hoveredStar >= 0 ? hoveredStar + 1 : rating
  const ratingLabel = displayRating > 0 ? STAR_LABELS[displayRating - 1] : null

  const handleSelectStar = useCallback((index: number) => {
    if (isSubmitted) return
    const newRating = index + 1
    setRating(newRating)
    setIsSubmitted(true)
    onRate?.(newRating)
  }, [isSubmitted, onRate])

  const handleHoverStar = useCallback((index: number) => {
    if (isSubmitted) return
    setHoveredStar(index)
  }, [isSubmitted])

  const handleLeaveStar = useCallback(() => {
    setHoveredStar(-1)
  }, [])

  const initials = getInitials(cleanerName)

  return (
    <article
      className={cn(
        'group/card relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200',
        !isSubmitted && 'hover:border-border hover:shadow-sm',
        isSubmitted && 'border-amber-400/20 dark:border-amber-300/15',
      )}
      aria-label={`Rate your cleaning by ${cleanerName}`}
      data-testid="cleaning-review-card"
    >
      {/* Subtle gradient accent on submitted */}
      {isSubmitted && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-transparent"
          aria-hidden
        />
      )}

      <div className="relative flex items-start gap-3 p-3.5">
        {/* Avatar */}
        <div className="shrink-0" aria-hidden>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-10 rounded-full object-cover ring-2 ring-border/40"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-[13px] font-semibold text-primary-foreground ring-2 ring-primary/20">
              {initials}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Top row: question + metadata */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold leading-tight text-foreground">
                How was your {serviceType.toLowerCase()}?
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                Rate {cleanerName}
              </p>
            </div>

            {/* Rating label badge */}
            <div
              className={cn(
                'shrink-0 transition-all duration-200',
                ratingLabel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
              )}
              aria-live="polite"
            >
              {ratingLabel && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  isSubmitted
                    ? 'bg-amber-400/15 text-amber-600 dark:bg-amber-300/10 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {isSubmitted && <IconSparkles className="size-3" aria-hidden />}
                  {ratingLabel}
                </span>
              )}
            </div>
          </div>

          {/* Stars */}
          <div
            className="mt-2 flex items-center gap-0.5"
            role="radiogroup"
            aria-label={`Rating for cleaning by ${cleanerName}`}
          >
            {Array.from({ length: MAX_STARS }, (_, i) => {
              const isFilled = i < displayRating
              const isHovered = hoveredStar >= 0 && i <= hoveredStar && !isSubmitted
              return (
                <StarButton
                  key={i}
                  index={i}
                  isFilled={isFilled}
                  isHovered={isHovered}
                  label={STAR_LABELS[i]}
                  onSelect={handleSelectStar}
                  onHover={handleHoverStar}
                  onLeave={handleLeaveStar}
                  isSubmitted={isSubmitted}
                />
              )
            })}
          </div>

          {/* Metadata row: date + cleaning ID */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="size-3" aria-hidden />
              <time dateTime={date}>{date}</time>
            </span>
            <span aria-hidden className="text-border">·</span>
            <span
              className="font-mono tracking-tight"
              aria-label={`Cleaning ID: ${cleaningId}`}
            >
              {formatCleaningId(cleaningId)}
            </span>
          </div>
        </div>
      </div>

      {/* Thank you message on submit */}
      {isSubmitted && (
        <div
          className="border-t border-border/40 bg-muted/30 px-3.5 py-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-[12px] text-muted-foreground">
            Thanks for your feedback!
          </p>
        </div>
      )}
    </article>
  )
})
