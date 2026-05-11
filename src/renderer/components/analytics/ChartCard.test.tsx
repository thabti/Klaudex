import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChartCard } from './ChartCard'

/**
 * TASK-049 — Smoke tests for ChartCard primitive (TASK-026).
 *
 * The card has no data semantics of its own — it's a layout primitive — so the
 * "empty state" we cover here is "renders title with empty children" and the
 * "populated state" is "renders title + actions + children".
 */
describe('ChartCard', () => {
  it('renders an empty card with just a title (smoke / empty state)', () => {
    render(
      <ChartCard title="Coding hours">
        <div />
      </ChartCard>,
    )
    expect(screen.getByRole('heading', { name: /coding hours/i })).toBeInTheDocument()
  })

  it('renders title + children + actions when populated', () => {
    render(
      <ChartCard
        title="Tokens"
        actions={<button type="button">refresh</button>}
      >
        <span data-testid="content">child content</span>
      </ChartCard>,
    )
    expect(screen.getByRole('heading', { name: /tokens/i })).toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('applies the custom className to the wrapper', () => {
    const { container } = render(
      <ChartCard title="Wide card" className="lg:col-span-2">
        <div />
      </ChartCard>,
    )
    const wrapper = container.firstElementChild as HTMLElement | null
    expect(wrapper?.className).toContain('lg:col-span-2')
  })
})
