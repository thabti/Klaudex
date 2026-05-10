import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { SlashCommandChart } from './SlashCommandChart'

/**
 * TASK-049 — Smoke tests for SlashCommandChart (TASK-033).
 *
 * No props — reads `useAnalyticsStore.events` directly and filters to
 * `kind === 'slash_cmd'`.
 */

const slashEv = (detail: string): AnalyticsEvent => ({
  ts: Date.now(),
  kind: 'slash_cmd',
  detail,
})

beforeEach(() => {
  useAnalyticsStore.setState({ events: [], isLoaded: true })
})

describe('SlashCommandChart', () => {
  it('renders the empty state with no events (smoke)', () => {
    useAnalyticsStore.setState({ events: [] })
    render(<SlashCommandChart />)
    expect(
      screen.getByRole('heading', { name: /slash commands by mode/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no slash command data yet/i)).toBeInTheDocument()
  })

  it('ignores non-slash events and stays in empty state', () => {
    useAnalyticsStore.setState({
      events: [{ ts: Date.now(), kind: 'message_sent' }],
    })
    render(<SlashCommandChart />)
    expect(screen.getByText(/no slash command data yet/i)).toBeInTheDocument()
  })

  it('renders rows + mode pills when populated', () => {
    useAnalyticsStore.setState({
      events: [
        slashEv('plan:plan'),
        slashEv('plan:plan'),
        slashEv('clear:command'),
        slashEv('clear:command'),
        slashEv('clear:command'),
      ],
    })
    render(<SlashCommandChart />)
    // Sorted desc by total: clear (3) > plan (2).
    expect(screen.getByText('clear')).toBeInTheDocument()
    expect(screen.getByText('plan')).toBeInTheDocument()
    // Mode pills.
    expect(screen.getByText(/command 3/)).toBeInTheDocument()
    expect(screen.getByText(/plan 2/)).toBeInTheDocument()
    expect(screen.queryByText(/no slash command data yet/i)).not.toBeInTheDocument()
  })
})
