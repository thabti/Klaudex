import { describe, it, expect } from 'vitest'
import { computeStableTimelineRows, EMPTY_STABLE_STATE } from './timeline-stability'
import type { TimelineRow } from './timeline'

describe('computeStableTimelineRows', () => {
  it('returns same state when rows are identical', () => {
    const rows: TimelineRow[] = [
      { kind: 'user-message', id: 'msg-0-user', content: 'hello', timestamp: '2024-01-01' },
      { kind: 'assistant-text', id: 'msg-1-text', content: 'hi', timestamp: '2024-01-01' },
    ]

    const first = computeStableTimelineRows(rows, EMPTY_STABLE_STATE)
    const second = computeStableTimelineRows(rows, first)

    // Same references preserved
    expect(second).toBe(first)
    expect(second.result[0]).toBe(first.result[0])
    expect(second.result[1]).toBe(first.result[1])
  })

  it('preserves unchanged row references when a new row is appended', () => {
    const rows: TimelineRow[] = [
      { kind: 'user-message', id: 'msg-0-user', content: 'hello', timestamp: '2024-01-01' },
      { kind: 'assistant-text', id: 'msg-1-text', content: 'hi', timestamp: '2024-01-01' },
    ]

    const first = computeStableTimelineRows(rows, EMPTY_STABLE_STATE)

    const updatedRows: TimelineRow[] = [
      ...rows,
      { kind: 'working', id: 'working', hasStreamingContent: false },
    ]

    const second = computeStableTimelineRows(updatedRows, first)

    // Existing rows keep their references
    expect(second.result[0]).toBe(first.result[0])
    expect(second.result[1]).toBe(first.result[1])
    // New row is added
    expect(second.result.length).toBe(3)
    // Top-level state is different
    expect(second).not.toBe(first)
  })

  it('replaces row reference when content changes', () => {
    const rows: TimelineRow[] = [
      { kind: 'assistant-text', id: 'live-text', content: 'hel', timestamp: '', isStreaming: true },
    ]

    const first = computeStableTimelineRows(rows, EMPTY_STABLE_STATE)

    const updatedRows: TimelineRow[] = [
      { kind: 'assistant-text', id: 'live-text', content: 'hello world', timestamp: '', isStreaming: true },
    ]

    const second = computeStableTimelineRows(updatedRows, first)

    // Row reference is new because content changed
    expect(second.result[0]).not.toBe(first.result[0])
    expect((second.result[0] as any).content).toBe('hello world')
  })

  it('handles working row hasStreamingContent change', () => {
    const rows: TimelineRow[] = [
      { kind: 'working', id: 'working', hasStreamingContent: false },
    ]

    const first = computeStableTimelineRows(rows, EMPTY_STABLE_STATE)

    const updatedRows: TimelineRow[] = [
      { kind: 'working', id: 'working', hasStreamingContent: true },
    ]

    const second = computeStableTimelineRows(updatedRows, first)
    expect(second.result[0]).not.toBe(first.result[0])
  })

  it('handles empty to non-empty transition', () => {
    const first = computeStableTimelineRows([], EMPTY_STABLE_STATE)
    expect(first).toBe(EMPTY_STABLE_STATE)

    const rows: TimelineRow[] = [
      { kind: 'user-message', id: 'msg-0-user', content: 'hi', timestamp: '2024-01-01' },
    ]
    const second = computeStableTimelineRows(rows, first)
    expect(second.result.length).toBe(1)
  })
})
