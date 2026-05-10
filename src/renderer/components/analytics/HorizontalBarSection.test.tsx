import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HorizontalBarSection } from './HorizontalBarSection'

/**
 * TASK-049 — Smoke tests for HorizontalBarSection primitive (TASK-026).
 *
 * Empty state = total of 0 (renders an em-dash placeholder, no bar fill).
 * Populated state = renders the value, percent label, and a filled bar.
 */
describe('HorizontalBarSection', () => {
  it('renders an em-dash placeholder when total is 0 (empty state)', () => {
    render(<HorizontalBarSection label="Sonnet" value={0} total={0} />)
    expect(screen.getByText('Sonnet')).toBeInTheDocument()
    // Em-dash placeholder for "no data".
    expect(screen.getByText('—')).toBeInTheDocument()
    // Progressbar is still present but with valuemax=0.
    const bar = screen.getByRole('progressbar', { name: 'Sonnet' })
    expect(bar).toHaveAttribute('aria-valuemax', '0')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders value + percent label + filled bar when populated', () => {
    render(<HorizontalBarSection label="Opus" value={3} total={10} />)
    expect(screen.getByText('Opus')).toBeInTheDocument()
    // Comma/locale-formatted value.
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Opus' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '10')
  })

  it('clamps value into [0, total] range (failure case: out-of-range value)', () => {
    render(<HorizontalBarSection label="Clamped" value={42} total={10} />)
    // value 42 > total 10 → clamped to 10 → 100%.
    expect(screen.getByText('100%')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Clamped' })
    expect(bar).toHaveAttribute('aria-valuenow', '10')
  })

  it('renders <1% for sub-percent ratios', () => {
    render(<HorizontalBarSection label="Tiny" value={1} total={1000} />)
    expect(screen.getByText('<1%')).toBeInTheDocument()
  })
})
