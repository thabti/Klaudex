import { describe, it, expect } from 'vitest'
import { collapseToolCalls, deriveCollapseKey, getGroupCount } from './tool-call-collapsing'
import type { ToolCall } from '@/types'

const makeToolCall = (overrides: Partial<ToolCall> = {}): ToolCall => ({
  toolCallId: `tc-${Math.random().toString(36).slice(2)}`,
  title: 'Edit file',
  status: 'completed',
  ...overrides,
})

describe('deriveCollapseKey', () => {
  it('returns null for in_progress tool calls', () => {
    const tc = makeToolCall({ status: 'in_progress', kind: 'edit' })
    expect(deriveCollapseKey(tc)).toBeNull()
  })

  it('returns null for pending tool calls', () => {
    const tc = makeToolCall({ status: 'pending', kind: 'edit' })
    expect(deriveCollapseKey(tc)).toBeNull()
  })

  it('returns key based on kind and file path from locations', () => {
    const tc = makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] })
    expect(deriveCollapseKey(tc)).toBe('edit:src/foo.ts')
  })

  it('returns key based on kind and file path from content', () => {
    const tc = makeToolCall({ kind: 'edit', content: [{ type: 'content', path: 'src/bar.ts' }] })
    expect(deriveCollapseKey(tc)).toBe('edit:src/bar.ts')
  })

  it('returns key based on kind and title when no file path', () => {
    const tc = makeToolCall({ kind: 'read', title: 'Read directory' })
    expect(deriveCollapseKey(tc)).toBe('read:read directory')
  })

  it('normalizes trailing "completed" in title', () => {
    const tc = makeToolCall({ kind: 'edit', title: 'Edit file completed' })
    expect(deriveCollapseKey(tc)).toBe('edit:edit file')
  })

  it('returns null when no kind and no title', () => {
    const tc = makeToolCall({ kind: undefined, title: '' })
    expect(deriveCollapseKey(tc)).toBeNull()
  })
})

describe('collapseToolCalls', () => {
  it('returns empty array for empty input', () => {
    expect(collapseToolCalls([])).toEqual([])
  })

  it('does not collapse in_progress tool calls', () => {
    const calls = [
      makeToolCall({ status: 'in_progress', kind: 'edit', locations: [{ path: 'src/a.ts' }] }),
      makeToolCall({ status: 'in_progress', kind: 'edit', locations: [{ path: 'src/a.ts' }] }),
    ]
    const groups = collapseToolCalls(calls)
    expect(groups.length).toBe(2)
  })

  it('collapses consecutive completed calls with same key', () => {
    const calls = [
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] }),
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] }),
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] }),
    ]
    const groups = collapseToolCalls(calls)
    expect(groups.length).toBe(1)
    expect(groups[0].calls.length).toBe(3)
    expect(groups[0].representative).toBe(calls[2]) // latest
  })

  it('does not collapse non-adjacent calls with same key', () => {
    const calls = [
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] }),
      makeToolCall({ kind: 'read', locations: [{ path: 'src/bar.ts' }] }),
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/foo.ts' }] }),
    ]
    const groups = collapseToolCalls(calls)
    expect(groups.length).toBe(3)
  })

  it('separates groups by different file paths', () => {
    const calls = [
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/a.ts' }] }),
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/a.ts' }] }),
      makeToolCall({ kind: 'edit', locations: [{ path: 'src/b.ts' }] }),
    ]
    const groups = collapseToolCalls(calls)
    expect(groups.length).toBe(2)
    expect(groups[0].calls.length).toBe(2)
    expect(groups[1].calls.length).toBe(1)
  })
})

describe('getGroupCount', () => {
  it('returns null for single-item group', () => {
    const group = { representative: makeToolCall(), calls: [makeToolCall()], key: 'k' }
    expect(getGroupCount(group)).toBeNull()
  })

  it('returns count for multi-item group', () => {
    const calls = [makeToolCall(), makeToolCall(), makeToolCall()]
    const group = { representative: calls[2], calls, key: 'k' }
    expect(getGroupCount(group)).toBe(3)
  })
})
