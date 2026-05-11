import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ToolCallChart } from './ToolCallChart'

/**
 * TASK-049 — Smoke tests for ToolCallChart (TASK-035).
 *
 * No props — reads `useAnalyticsStore.events` directly and filters to
 * `kind === 'tool_call'`.
 */

const toolEv = (toolName: string): AnalyticsEvent => ({
  ts: Date.now(),
  kind: 'tool_call',
  detail: toolName,
})

beforeEach(() => {
  useAnalyticsStore.setState({ events: [], isLoaded: true })
})

describe('ToolCallChart', () => {
  it('renders the empty state with no events (smoke)', () => {
    useAnalyticsStore.setState({ events: [] })
    render(<ToolCallChart />)
    expect(screen.getByRole('heading', { name: /tool calls/i })).toBeInTheDocument()
    expect(screen.getByText(/no tool call data yet/i)).toBeInTheDocument()
    // Total counter renders 0.
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders rows for each tool with totals when populated', () => {
    useAnalyticsStore.setState({
      events: [
        toolEv('read'),
        toolEv('read'),
        toolEv('read'),
        toolEv('write'),
        toolEv('grep'),
      ],
    })
    render(<ToolCallChart />)
    // Total tool calls = 5.
    expect(screen.getByText('5')).toBeInTheDocument()
    // Per-row labels (HorizontalBarSection renders the name).
    expect(screen.getByRole('progressbar', { name: 'read' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'write' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'grep' })).toBeInTheDocument()
    expect(screen.queryByText(/no tool call data yet/i)).not.toBeInTheDocument()
  })
})
