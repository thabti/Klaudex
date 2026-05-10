import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { MessagesChart } from './MessagesChart'

/**
 * TASK-049 — Smoke tests for MessagesChart (TASK-029).
 *
 * Prop signature: `{ sent: AnalyticsEvent[], received: AnalyticsEvent[] }`.
 * Reads no store.
 */

const sentEv = (ts: number, words: number): AnalyticsEvent => ({
  ts,
  kind: 'message_sent',
  value: words,
})

const recvEv = (ts: number, words: number): AnalyticsEvent => ({
  ts,
  kind: 'message_received',
  value: words,
})

describe('MessagesChart', () => {
  it('renders the empty state with no events (smoke)', () => {
    render(<MessagesChart sent={[]} received={[]} />)
    expect(screen.getByRole('heading', { name: /messages & words/i })).toBeInTheDocument()
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument()
    // Headline stats render zeros.
    const allZero = screen.getAllByText('0')
    expect(allZero.length).toBeGreaterThanOrEqual(3)
  })

  it('renders bars and aggregate counts when populated', () => {
    const baseTs = new Date(2026, 3, 1, 12, 0, 0).getTime()
    const sent = [sentEv(baseTs, 100), sentEv(baseTs + 1000, 50)]
    const received = [recvEv(baseTs, 200)]
    render(<MessagesChart sent={sent} received={received} />)
    // Total messages: 2 sent + 1 received = 3.
    expect(screen.getByText('3')).toBeInTheDocument()
    // Input words 150, output words 200.
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.queryByText(/no messages yet/i)).not.toBeInTheDocument()
    // Legend dots present.
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Received')).toBeInTheDocument()
  })
})
