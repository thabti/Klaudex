import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTaskStore } from '@/stores/taskStore'

/**
 * PanelContext — tracks which thread is shown in each split panel
 * (left/right), which panel is currently active, and the fractional
 * width ratio of the left panel in split mode.
 *
 * Setting an unknown thread ID via setPanelThread falls back to the
 * previous valid value (validated against the live taskStore tasks map).
 *
 * The ratio is clamped to [MIN_RATIO, MAX_RATIO] (mirrors SplitDivider's
 * clamp) and persisted to localStorage so the user's preferred split
 * width survives reloads. localStorage access is wrapped in try/catch so
 * private-mode / quota-exceeded contexts degrade gracefully to in-memory
 * state.
 */

export type PanelKey = 'left' | 'right'

export interface PanelState {
  threadId: string | null
}

export interface PanelContextValue {
  panels: {
    left: PanelState
    right: PanelState
  }
  activePanel: PanelKey
  setActivePanel: (panel: PanelKey) => void
  setPanelThread: (panel: PanelKey, threadId: string | null) => void
  /** Fractional width of the left panel in split mode, in [MIN_RATIO, MAX_RATIO]. */
  ratio: number
  /** Updates the split ratio. Input is clamped to [MIN_RATIO, MAX_RATIO]. */
  setRatio: (ratio: number) => void
}

const RATIO_STORAGE_KEY = 'klaudex.split.ratio'
const DEFAULT_RATIO = 0.5
const MIN_RATIO = 0.3
const MAX_RATIO = 0.7

const clampRatio = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return DEFAULT_RATIO
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, value))
}

const loadPersistedRatio = (): number => {
  try {
    const raw = localStorage.getItem(RATIO_STORAGE_KEY)
    if (raw === null) return DEFAULT_RATIO
    const parsed = Number.parseFloat(raw)
    return clampRatio(parsed)
  } catch {
    return DEFAULT_RATIO
  }
}

const persistRatio = (value: number): void => {
  try {
    localStorage.setItem(RATIO_STORAGE_KEY, String(value))
  } catch (err) {
    console.warn('[PanelContext] failed to persist split ratio', err)
  }
}

const PanelContextInternal = createContext<PanelContextValue | null>(null)

interface PanelProviderProps {
  children: ReactNode
  initialLeftThreadId?: string | null
  initialRightThreadId?: string | null
  initialActivePanel?: PanelKey
}

export const PanelProvider = ({
  children,
  initialLeftThreadId = null,
  initialRightThreadId = null,
  initialActivePanel = 'left',
}: PanelProviderProps) => {
  const [panels, setPanels] = useState<{ left: PanelState; right: PanelState }>(() => ({
    left: { threadId: initialLeftThreadId },
    right: { threadId: initialRightThreadId },
  }))
  const [activePanel, setActivePanelState] = useState<PanelKey>(initialActivePanel)
  const [ratio, setRatioState] = useState<number>(loadPersistedRatio)

  const setActivePanel = useCallback((panel: PanelKey) => {
    setActivePanelState((prev) => (prev === panel ? prev : panel))
  }, [])

  const setRatio = useCallback((next: number) => {
    const clamped = clampRatio(next)
    setRatioState((prev) => {
      if (prev === clamped) return prev
      persistRatio(clamped)
      return clamped
    })
  }, [])

  const setPanelThread = useCallback((panel: PanelKey, threadId: string | null) => {
    setPanels((prev) => {
      // null clears the panel — always allowed
      if (threadId === null) {
        if (prev[panel].threadId === null) return prev
        return { ...prev, [panel]: { threadId: null } }
      }
      // Validate against live taskStore tasks. Unknown thread ID → fall back
      // to previous valid value (do not crash, do not store invalid state).
      const tasks = useTaskStore.getState().tasks
      if (!tasks[threadId]) {
        return prev
      }
      if (prev[panel].threadId === threadId) return prev
      return { ...prev, [panel]: { threadId } }
    })
  }, [])

  const value = useMemo<PanelContextValue>(() => ({
    panels,
    activePanel,
    setActivePanel,
    setPanelThread,
    ratio,
    setRatio,
  }), [panels, activePanel, setActivePanel, setPanelThread, ratio, setRatio])

  return (
    <PanelContextInternal.Provider value={value}>
      {children}
    </PanelContextInternal.Provider>
  )
}

/**
 * Returns the PanelContext value. Throws if used outside <PanelProvider>.
 */
export const usePanelContext = (): PanelContextValue => {
  const ctx = useContext(PanelContextInternal)
  if (ctx === null) {
    throw new Error('usePanelContext must be used within a PanelProvider')
  }
  return ctx
}
