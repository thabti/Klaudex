import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { DiffStatsChart } from './DiffStatsChart'

/**
 * TASK-049 — Smoke tests for DiffStatsChart (TASK-028).
 *
 * Prop signature: `{ diffEvents: AnalyticsEvent[], fileEvents: AnalyticsEvent[] }`.
 * Reads no store.
 */

const day = (y: number, m: number, d: number): number =>
  new Date(y, m - 1, d).getTime()

const diffEv = (ts: number, additions: number, deletions: number): AnalyticsEvent => ({
  ts,
  kind: 'diff_stats',
  value: additions,
  value2: deletions,
})

const fileEv = (ts: number, path: string): AnalyticsEvent => ({
  ts,
  kind: 'file_edited',
  detail: path,
})

describe('DiffStatsChart', () => {
  it('renders the "no diff data" empty state with empty arrays (smoke)', () => {
    render(<DiffStatsChart diffEvents={[]} fileEvents={[]} />)
    expect(screen.getByRole('heading', { name: /code changes/i })).toBeInTheDocument()
    expect(screen.getByText(/no diff data yet/i)).toBeInTheDocument()
    // Headline stats still render with zeros.
    expect(screen.getByText('+0')).toBeInTheDocument()
    expect(screen.getByText('-0')).toBeInTheDocument()
  })

  it('renders aggregate +/- and SVG chart when populated', () => {
    const diffEvents = [
      diffEv(day(2026, 4, 1), 10, 3),
      diffEv(day(2026, 4, 2), 5, 1),
    ]
    const fileEvents = [
      fileEv(day(2026, 4, 1), '/repo/src/a.ts'),
      fileEv(day(2026, 4, 2), '/repo/src/b.ts'),
    ]
    render(<DiffStatsChart diffEvents={diffEvents} fileEvents={fileEvents} />)
    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('-4')).toBeInTheDocument()
    // 2 distinct files edited.
    expect(screen.getByText('2')).toBeInTheDocument()
    // SVG chart with the aria label is rendered (not the empty-state copy).
    expect(screen.getByRole('img', { name: /additions and deletions per day/i })).toBeInTheDocument()
    expect(screen.queryByText(/no diff data yet/i)).not.toBeInTheDocument()
  })

  it('renders dot fallback (not lines) for a single data-point series', () => {
    const diffEvents = [diffEv(day(2026, 4, 1), 7, 2)]
    const { container } = render(
      <DiffStatsChart diffEvents={diffEvents} fileEvents={[]} />,
    )
    // With a single day, the SUT renders <circle> dots instead of <path> lines.
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
  })
})
