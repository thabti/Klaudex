import { describe, it, expect, beforeEach } from 'vitest'
import { useDebugStore } from './debugStore'

beforeEach(() => {
  useDebugStore.setState({ entries: [], isOpen: false, filter: { search: '', category: 'all', errorsOnly: false } })
})

describe('debugStore', () => {
  it('starts with empty entries', () => {
    expect(useDebugStore.getState().entries).toEqual([])
  })

  it('starts closed', () => {
    expect(useDebugStore.getState().isOpen).toBe(false)
  })

  it('clear empties entries', () => {
    useDebugStore.setState({ entries: [{ id: 1, timestamp: '', direction: 'in', category: 'notification', type: 'test', taskId: null, summary: '', payload: null, isError: false }] })
    useDebugStore.getState().clear()
    expect(useDebugStore.getState().entries).toEqual([])
  })

  it('toggleOpen toggles', () => {
    useDebugStore.getState().toggleOpen()
    expect(useDebugStore.getState().isOpen).toBe(true)
    useDebugStore.getState().toggleOpen()
    expect(useDebugStore.getState().isOpen).toBe(false)
  })

  it('setOpen sets value', () => {
    useDebugStore.getState().setOpen(true)
    expect(useDebugStore.getState().isOpen).toBe(true)
    useDebugStore.getState().setOpen(false)
    expect(useDebugStore.getState().isOpen).toBe(false)
  })

  it('setFilter merges partial', () => {
    useDebugStore.getState().setFilter({ search: 'test' })
    expect(useDebugStore.getState().filter.search).toBe('test')
    expect(useDebugStore.getState().filter.category).toBe('all')

    useDebugStore.getState().setFilter({ category: 'error', errorsOnly: true })
    expect(useDebugStore.getState().filter.search).toBe('test')
    expect(useDebugStore.getState().filter.category).toBe('error')
    expect(useDebugStore.getState().filter.errorsOnly).toBe(true)
  })
})
