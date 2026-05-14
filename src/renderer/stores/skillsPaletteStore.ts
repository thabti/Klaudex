import { create } from 'zustand'

/**
 * UI state for the Skills Palette modal.
 *
 * Consumers:
 * - `useSkillInvoke` hook — calls `useSkillsPaletteStore.getState().close()`
 * - `SkillsPalette` modal component — reads all state via selectors
 * - `useKeyboardShortcuts` — calls `useSkillsPaletteStore.getState().toggle()`
 *
 * Every setter follows the project's bail-out guard pattern: state is only
 * mutated when the incoming value actually differs from the current value.
 * This prevents unnecessary React re-renders for downstream subscribers
 * (see CLAUDE.md "Zustand store performance patterns").
 */
interface SkillsPaletteStore {
  isOpen: boolean
  query: string
  selectedIndex: number

  open: () => void
  close: () => void
  toggle: () => void
  setQuery: (q: string) => void
  setSelectedIndex: (i: number) => void
  moveSelection: (delta: 1 | -1, listLength: number) => void
}

export const useSkillsPaletteStore = create<SkillsPaletteStore>((set, get) => ({
  isOpen: false,
  query: '',
  selectedIndex: 0,

  open: () => {
    // Bail out if already open — no-op set would still trigger subscribers
    // that select the whole store object.
    if (get().isOpen) return
    set({ isOpen: true })
  },

  close: () => {
    // Bail out if already closed. Resetting query/selectedIndex when already
    // closed would be redundant churn for subscribers.
    if (!get().isOpen) return
    set({ isOpen: false, query: '', selectedIndex: 0 })
  },

  toggle: () => {
    const { isOpen } = get()
    if (isOpen) {
      // Closing via toggle resets query and selectedIndex, matching close().
      set({ isOpen: false, query: '', selectedIndex: 0 })
    } else {
      set({ isOpen: true })
    }
  },

  setQuery: (q) => {
    const current = get().query
    if (q === current) return
    // Resetting selectedIndex to 0 whenever the filter changes keeps the
    // highlighted item as the top result of the new filter. Only reset when
    // selectedIndex is not already 0 to avoid a redundant write.
    const currentSelected = get().selectedIndex
    if (currentSelected === 0) {
      set({ query: q })
    } else {
      set({ query: q, selectedIndex: 0 })
    }
  },

  setSelectedIndex: (i) => {
    if (i === get().selectedIndex) return
    set({ selectedIndex: i })
  },

  moveSelection: (delta, listLength) => {
    const current = get().selectedIndex
    let next: number
    if (listLength <= 0) {
      next = 0
    } else {
      // Clamp to [0, listLength - 1]. -1 at index 0 stays at 0; +1 at the
      // last index stays at the last index.
      const raw = current + delta
      if (raw < 0) next = 0
      else if (raw > listLength - 1) next = listLength - 1
      else next = raw
    }
    if (next === current) return
    set({ selectedIndex: next })
  },
}))
