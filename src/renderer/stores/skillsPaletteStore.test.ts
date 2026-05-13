import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSkillsPaletteStore } from './skillsPaletteStore'

beforeEach(() => {
  // Reset to initial state before every test so cases are isolated.
  useSkillsPaletteStore.setState({ isOpen: false, query: '', selectedIndex: 0 })
})

describe('skillsPaletteStore', () => {
  describe('basic actions', () => {
    it('open() sets isOpen to true', () => {
      expect(useSkillsPaletteStore.getState().isOpen).toBe(false)
      useSkillsPaletteStore.getState().open()
      expect(useSkillsPaletteStore.getState().isOpen).toBe(true)
    })

    it('close() resets isOpen, query, and selectedIndex', () => {
      useSkillsPaletteStore.setState({ isOpen: true, query: 'foo', selectedIndex: 3 })
      useSkillsPaletteStore.getState().close()
      const s = useSkillsPaletteStore.getState()
      expect(s.isOpen).toBe(false)
      expect(s.query).toBe('')
      expect(s.selectedIndex).toBe(0)
    })

    it('toggle() flips isOpen and resets when closing', () => {
      // First toggle: open
      useSkillsPaletteStore.getState().toggle()
      expect(useSkillsPaletteStore.getState().isOpen).toBe(true)

      // Simulate user typing & navigating
      useSkillsPaletteStore.setState({ query: 'bar', selectedIndex: 2 })

      // Second toggle: close + reset
      useSkillsPaletteStore.getState().toggle()
      const s = useSkillsPaletteStore.getState()
      expect(s.isOpen).toBe(false)
      expect(s.query).toBe('')
      expect(s.selectedIndex).toBe(0)
    })

    it('setQuery updates query', () => {
      useSkillsPaletteStore.getState().setQuery('foo')
      expect(useSkillsPaletteStore.getState().query).toBe('foo')
    })

    it('setSelectedIndex updates selectedIndex', () => {
      useSkillsPaletteStore.getState().setSelectedIndex(3)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(3)
    })
  })

  describe('coupling', () => {
    it('setQuery resets selectedIndex to 0 when query changes', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 5 })
      useSkillsPaletteStore.getState().setQuery('foo')
      expect(useSkillsPaletteStore.getState().query).toBe('foo')
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(0)
    })

    it('setQuery does NOT reset selectedIndex when query is unchanged', () => {
      // Initial query is '', so calling setQuery('') is a no-op via bail-out.
      useSkillsPaletteStore.setState({ selectedIndex: 5 })
      useSkillsPaletteStore.getState().setQuery('')
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(5)
    })
  })

  describe('moveSelection clamping', () => {
    it('moveSelection(1, 5) increments from 0 to 1', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 0 })
      useSkillsPaletteStore.getState().moveSelection(1, 5)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(1)
    })

    it('moveSelection(-1, 5) at 0 stays at 0', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 0 })
      useSkillsPaletteStore.getState().moveSelection(-1, 5)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(0)
    })

    it('moveSelection(1, 5) at 4 stays at 4 (last index)', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 4 })
      useSkillsPaletteStore.getState().moveSelection(1, 5)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(4)
    })

    it('moveSelection(1, 0) on empty list stays at 0', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 0 })
      useSkillsPaletteStore.getState().moveSelection(1, 0)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(0)
    })

    it('moveSelection(-1, 0) on empty list stays at 0', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 0 })
      useSkillsPaletteStore.getState().moveSelection(-1, 0)
      expect(useSkillsPaletteStore.getState().selectedIndex).toBe(0)
    })
  })

  describe('bail-out guards', () => {
    it('open() called twice does not trigger a second setState', () => {
      const listener = vi.fn()
      const unsub = useSkillsPaletteStore.subscribe(listener)
      useSkillsPaletteStore.getState().open() // 1 call
      useSkillsPaletteStore.getState().open() // 0 additional calls (bail-out)
      expect(listener).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('setSelectedIndex with unchanged value does not trigger setState', () => {
      useSkillsPaletteStore.setState({ selectedIndex: 2 })
      const listener = vi.fn()
      const unsub = useSkillsPaletteStore.subscribe(listener)
      useSkillsPaletteStore.getState().setSelectedIndex(2)
      expect(listener).toHaveBeenCalledTimes(0)
      unsub()
    })

    it('setQuery with unchanged query does not trigger setState', () => {
      useSkillsPaletteStore.setState({ query: 'hello' })
      const listener = vi.fn()
      const unsub = useSkillsPaletteStore.subscribe(listener)
      useSkillsPaletteStore.getState().setQuery('hello')
      expect(listener).toHaveBeenCalledTimes(0)
      unsub()
    })
  })
})
