import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useTaskStore } from '@/stores/taskStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { TokensChart } from './TokensChart'

/**
 * TASK-049 — Smoke tests for TokensChart (TASK-034).
 *
 * No props — reads `useAnalyticsStore.events` (kind: 'token_usage') for the
 * by-day series and `useTaskStore.tasks` (contextUsage + totalCost) for the
 * live headline total.
 */

const tokenEv = (ts: number, value: number): AnalyticsEvent => ({
  ts,
  kind: 'token_usage',
  value,
})

beforeEach(() => {
  useAnalyticsStore.setState({ events: [], isLoaded: true })
  useTaskStore.setState({ tasks: {} })
})

describe('TokensChart', () => {
  it('renders the empty state with no events and no live tokens (smoke)', () => {
    render(<TokensChart />)
    expect(screen.getByRole('heading', { name: /token usage/i })).toBeInTheDocument()
    expect(screen.getByText(/no token data yet/i)).toBeInTheDocument()
    // Total tokens shows the em-dash placeholder.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows "no token history yet" when live total is present but events are empty', () => {
    useTaskStore.setState({
      tasks: {
        // Minimal task shape — TokensChart only reads `contextUsage` and `totalCost`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        't1': { contextUsage: { used: 1234, size: 200_000 } } as any,
      },
    })
    render(<TokensChart />)
    expect(screen.getByText(/no token history yet/i)).toBeInTheDocument()
    // Headline shows formatted live total (1234 → 1.2K).
    expect(screen.getByText('1.2K')).toBeInTheDocument()
  })

  it('renders the SVG sparkline + cost line when populated', () => {
    const baseTs = new Date(2026, 3, 1).getTime()
    useAnalyticsStore.setState({
      events: [
        tokenEv(baseTs, 5_000),
        tokenEv(baseTs + 86_400_000, 12_000),
      ],
    })
    useTaskStore.setState({
      tasks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        't1': {
          contextUsage: {
            used: 0,
            size: 200_000,
            inputTokens: 5_000,
            outputTokens: 7_000,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
          },
          totalCost: 1.23,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    })
    render(<TokensChart />)
    // SVG with the aria-label is rendered.
    expect(screen.getByRole('img', { name: /token usage over time/i })).toBeInTheDocument()
    // Live total = 12_000 → "12.0K".
    expect(screen.getByText('12.0K')).toBeInTheDocument()
    // Cost line.
    expect(screen.getByText('Est. cost')).toBeInTheDocument()
    expect(screen.getByText('~$1.23')).toBeInTheDocument()
    expect(screen.queryByText(/no token data yet/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no token history yet/i)).not.toBeInTheDocument()
  })
})
