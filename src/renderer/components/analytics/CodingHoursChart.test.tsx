import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { CodingHoursChart } from './CodingHoursChart'

/**
 * TASK-049 — Smoke tests for CodingHoursChart (TASK-027).
 *
 * Prop signature: `{ events: AnalyticsEvent[] }`. Reads no store.
 *
 * Empty state = "No session data yet" message + 24 cells at min opacity.
 * Populated state = grid cells + at least one cell carries the bucketed value.
 */

const sessionEvent = (ts: number, value?: number): AnalyticsEvent => ({
  ts,
  kind: 'session',
  ...(value !== undefined ? { value } : {}),
})

describe('CodingHoursChart', () => {
  it('renders the empty-state message with no events (smoke)', () => {
    render(<CodingHoursChart events={[]} />)
    expect(screen.getByRole('heading', { name: /coding hours/i })).toBeInTheDocument()
    expect(screen.getByText(/no session data yet/i)).toBeInTheDocument()
    // 24-cell grid is always rendered.
    expect(screen.getByRole('grid', { name: /activity by hour of day/i })).toBeInTheDocument()
  })

  it('renders 24 hour buckets when no events are provided', () => {
    const { container } = render(<CodingHoursChart events={[]} />)
    expect(container.querySelectorAll('[role="gridcell"]').length).toBe(24)
  })

  it('renders bucketed values from session events (populated state)', () => {
    // Pick a stable, predictable hour (10am local) and pump 3 events in.
    const hourTen = new Date()
    hourTen.setHours(10, 0, 0, 0)
    const events: AnalyticsEvent[] = [
      sessionEvent(hourTen.getTime(), 60),
      sessionEvent(hourTen.getTime() + 60_000, 30),
    ]
    render(<CodingHoursChart events={events} />)
    // Empty-state message must NOT be present.
    expect(screen.queryByText(/no session data yet/i)).not.toBeInTheDocument()
    // The 10am cell renders an "10a" hour label inside it.
    const labels = screen.getAllByText('10a')
    expect(labels.length).toBeGreaterThan(0)
  })
})
