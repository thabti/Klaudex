import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * TASK-049 — Smoke tests for AnalyticsDashboard (TASK-036).
 *
 * The dashboard mounts → calls `loadEvents()` → eventually hydrates from disk.
 * In the empty-data case the component renders an "No analytics data yet"
 * card. In the populated case it renders the 9-card chart grid (8 implemented
 * charts + the "Mode usage" placeholder for TASK-031, which is deferred).
 *
 * Mocking strategy: stub `@/lib/ipc` so `analyticsLoad` resolves with whatever
 * the test wants, then seed `useAnalyticsStore.setState({ isLoaded: true,
 * events: [...] })` BEFORE rendering so the dashboard skips the "Loading..."
 * branch and renders immediately.
 */

vi.mock('@/lib/ipc', () => ({
  ipc: {
    analyticsLoad: vi.fn().mockResolvedValue([]),
    analyticsClear: vi.fn().mockResolvedValue(undefined),
    analyticsSave: vi.fn().mockResolvedValue(undefined),
    analyticsDbSize: vi.fn().mockResolvedValue(0),
  },
}))

import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AnalyticsEvent } from '@/lib/ipc'
import { AnalyticsDashboard } from './AnalyticsDashboard'

const tokenEv = (ts: number, value: number): AnalyticsEvent => ({
  ts,
  kind: 'token_usage',
  value,
})
const sessionEv = (ts: number): AnalyticsEvent => ({ ts, kind: 'session', value: 60 })
const sentEv = (ts: number): AnalyticsEvent => ({ ts, kind: 'message_sent', value: 10 })
const recvEv = (ts: number): AnalyticsEvent => ({ ts, kind: 'message_received', value: 12 })
const diffEv = (ts: number, a: number, d: number): AnalyticsEvent => ({
  ts,
  kind: 'diff_stats',
  value: a,
  value2: d,
})
const fileEv = (ts: number, p: string): AnalyticsEvent => ({ ts, kind: 'file_edited', detail: p })
const modelEv = (ts: number, id: string): AnalyticsEvent => ({ ts, kind: 'model_used', detail: id })
const slashEv = (ts: number, detail: string): AnalyticsEvent => ({ ts, kind: 'slash_cmd', detail })
const toolEv = (ts: number, name: string): AnalyticsEvent => ({ ts, kind: 'tool_call', detail: name })
const threadEv = (ts: number, project: string, thread: string): AnalyticsEvent => ({
  ts,
  kind: 'thread_created',
  project,
  thread,
})

beforeEach(() => {
  useAnalyticsStore.setState({ events: [], isLoaded: true, timeRange: 'all', dbSize: 0 })
  useTaskStore.setState({ tasks: {} })
  useSettingsStore.setState({
    availableModels: [
      { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: null },
    ],
  })
})

describe('AnalyticsDashboard', () => {
  it('renders the header (Analytics title + range tabs) on every render', () => {
    render(<AnalyticsDashboard />)
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to chat/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /all time/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /7 days/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /30 days/i })).toBeInTheDocument()
  })

  it('failure-case: empty analytics data still renders the empty-state card', () => {
    // Plan acceptance: "dashboard with all-empty data still renders the empty state".
    useAnalyticsStore.setState({ events: [], isLoaded: true })
    render(<AnalyticsDashboard />)
    expect(screen.getByText(/no analytics data yet/i)).toBeInTheDocument()
    expect(screen.getByText(/start chatting to populate your usage stats/i)).toBeInTheDocument()
    // None of the chart headings should be present in the empty state.
    expect(screen.queryByRole('heading', { name: /coding hours/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /messages & words/i })).not.toBeInTheDocument()
  })

  it('shows a "Loading analytics..." indicator while not yet loaded', () => {
    useAnalyticsStore.setState({ isLoaded: false, events: [] })
    render(<AnalyticsDashboard />)
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument()
  })

  it('renders all 9 chart cards (8 charts + Mode usage placeholder) when populated', () => {
    const ts = new Date(2026, 3, 1, 14, 0, 0).getTime()
    useAnalyticsStore.setState({
      isLoaded: true,
      events: [
        sessionEv(ts),
        sentEv(ts),
        recvEv(ts),
        diffEv(ts, 5, 2),
        fileEv(ts, '/repo/a.ts'),
        modelEv(ts, 'claude-sonnet-4-6'),
        slashEv(ts, 'plan:plan'),
        toolEv(ts, 'read'),
        threadEv(ts, '/repo/proj', 'thread-1'),
        tokenEv(ts, 1_000),
      ],
    })
    useTaskStore.setState({
      tasks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        't1': { contextUsage: { used: 5_000, size: 200_000 } } as any,
      },
    })
    render(<AnalyticsDashboard />)
    // 9 chart headings: 8 implemented + Mode usage placeholder.
    expect(screen.getByRole('heading', { name: /coding hours/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /messages & words/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /token usage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /code changes/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /model popularity/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mode usage/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /slash commands by mode/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tool calls/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument()
    // The empty-state copy must NOT appear when populated.
    expect(screen.queryByText(/no analytics data yet/i)).not.toBeInTheDocument()
  })
})
