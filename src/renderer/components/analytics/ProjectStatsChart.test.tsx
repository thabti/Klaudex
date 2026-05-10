import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { ProjectStatsChart } from './ProjectStatsChart'

/**
 * TASK-049 — Smoke tests for ProjectStatsChart (TASK-032).
 *
 * No props — reads `useAnalyticsStore.events` directly. Tests seed
 * `useAnalyticsStore.setState({ events })` before rendering.
 */

const threadEv = (project: string, thread: string, ts = Date.now()): AnalyticsEvent => ({
  ts,
  kind: 'thread_created',
  project,
  thread,
})

const messageEv = (project: string, ts = Date.now()): AnalyticsEvent => ({
  ts,
  kind: 'message_sent',
  project,
})

beforeEach(() => {
  useAnalyticsStore.setState({ events: [], isLoaded: true })
})

describe('ProjectStatsChart', () => {
  it('renders the empty state when no events (smoke)', () => {
    useAnalyticsStore.setState({ events: [] })
    render(<ProjectStatsChart />)
    expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument()
    expect(screen.getByText(/no project data yet/i)).toBeInTheDocument()
  })

  it('renders one entry per project with thread/message bars when populated', () => {
    useAnalyticsStore.setState({
      events: [
        threadEv('/Users/me/proj-alpha', 't1'),
        threadEv('/Users/me/proj-alpha', 't2'),
        messageEv('/Users/me/proj-alpha'),
        threadEv('/Users/me/proj-beta', 'tx'),
      ],
    })
    render(<ProjectStatsChart />)
    // Trailing-segment label is shown for each project.
    expect(screen.getByText('proj-alpha')).toBeInTheDocument()
    expect(screen.getByText('proj-beta')).toBeInTheDocument()
    // Each project has Threads + Messages rows.
    expect(screen.getAllByRole('progressbar', { name: 'Threads' }).length).toBe(2)
    expect(screen.getAllByRole('progressbar', { name: 'Messages' }).length).toBe(2)
    expect(screen.queryByText(/no project data yet/i)).not.toBeInTheDocument()
  })
})
