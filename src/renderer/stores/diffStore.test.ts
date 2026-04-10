import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    getTaskDiff: vi.fn().mockResolvedValue('+added\n-removed\ndiff --git a/f b/f\n+line\n-old'),
    gitStage: vi.fn().mockResolvedValue(undefined),
    gitRevert: vi.fn().mockResolvedValue(undefined),
  },
}))

import { useDiffStore } from './diffStore'

beforeEach(() => {
  useDiffStore.setState({ isOpen: false, diff: '', stats: { additions: 0, deletions: 0, fileCount: 0 }, loading: false, selectedFiles: new Set(), focusFile: null })
})

describe('diffStore', () => {
  it('starts closed with empty diff', () => {
    const s = useDiffStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.diff).toBe('')
    expect(s.stats).toEqual({ additions: 0, deletions: 0, fileCount: 0 })
  })

  it('toggleOpen toggles', () => {
    useDiffStore.getState().toggleOpen()
    expect(useDiffStore.getState().isOpen).toBe(true)
    useDiffStore.getState().toggleOpen()
    expect(useDiffStore.getState().isOpen).toBe(false)
  })

  it('setOpen sets value', () => {
    useDiffStore.getState().setOpen(true)
    expect(useDiffStore.getState().isOpen).toBe(true)
  })

  it('clear resets diff and stats', () => {
    useDiffStore.setState({ diff: 'some diff', stats: { additions: 5, deletions: 3, fileCount: 2 }, selectedFiles: new Set(['a.ts']) })
    useDiffStore.getState().clear()
    expect(useDiffStore.getState().diff).toBe('')
    expect(useDiffStore.getState().stats).toEqual({ additions: 0, deletions: 0, fileCount: 0 })
    expect(useDiffStore.getState().selectedFiles.size).toBe(0)
  })

  it('toggleFileSelection adds and removes', () => {
    useDiffStore.getState().toggleFileSelection('a.ts')
    expect(useDiffStore.getState().selectedFiles.has('a.ts')).toBe(true)
    useDiffStore.getState().toggleFileSelection('a.ts')
    expect(useDiffStore.getState().selectedFiles.has('a.ts')).toBe(false)
  })

  it('clearSelection empties set', () => {
    useDiffStore.setState({ selectedFiles: new Set(['a.ts', 'b.ts']) })
    useDiffStore.getState().clearSelection()
    expect(useDiffStore.getState().selectedFiles.size).toBe(0)
  })

  it('openToFile sets isOpen and focusFile', () => {
    useDiffStore.getState().openToFile('src/main.ts')
    expect(useDiffStore.getState().isOpen).toBe(true)
    expect(useDiffStore.getState().focusFile).toBe('src/main.ts')
  })

  it('fetchDiff loads diff and computes stats', async () => {
    await useDiffStore.getState().fetchDiff('task-1')
    const s = useDiffStore.getState()
    expect(s.diff).toContain('+added')
    expect(s.stats.additions).toBeGreaterThan(0)
    expect(s.stats.deletions).toBeGreaterThan(0)
    expect(s.stats.fileCount).toBe(1)
    expect(s.loading).toBe(false)
  })
})
