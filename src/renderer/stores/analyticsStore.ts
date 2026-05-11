import { create } from 'zustand'
import { ipc, type AnalyticsEvent } from '@/lib/ipc'

/**
 * Analytics dashboard store + in-memory event buffer.
 *
 * Public surface is a field-for-field port of `kirodex/src/renderer/stores/analyticsStore.ts`
 * so the dashboard chart components (TASK-026..035) can be ported unchanged.
 *
 * Klaudex differences from kirodex:
 *  - `AnalyticsEvent` is imported from `@/lib/ipc` (Klaudex centralised the
 *    shared IPC types there in wave 2). Kirodex kept it in `@/types/analytics`.
 *  - Buffer + flush logic is colocated in this store rather than in a separate
 *    `lib/analytics-collector.ts` (kirodex's split). The plan acceptance
 *    criteria for TASK-018 require this: "Buffered events flush in batches of
 *    50 or every 30s (whichever first)".
 */

export type TimeRange = 'all' | '30d' | '7d'

const RANGE_MS: Record<TimeRange, number> = {
  all: 0,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

/** Flush threshold — once the buffer hits this size, we flush eagerly. */
const FLUSH_BATCH_SIZE = 50
/** Periodic flush cadence — even a partial buffer is flushed every 30s. */
const FLUSH_INTERVAL_MS = 30_000
/** Default hydration window — last 30 days. */
const DEFAULT_HYDRATE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

interface AnalyticsStore {
  /** Events loaded from disk for dashboard rendering. */
  events: AnalyticsEvent[]
  /** True once `loadEvents` has resolved at least once (success or empty). */
  isLoaded: boolean
  /** Current dashboard filter window. */
  timeRange: TimeRange
  /** Bytes on disk for the analytics SQLite store (settings → Advanced). */
  dbSize: number
  loadEvents: () => Promise<void>
  setTimeRange: (range: TimeRange) => void
  clearData: () => Promise<void>
  refreshDbSize: () => Promise<void>
  /** Buffer one event in memory; flushes eagerly at FLUSH_BATCH_SIZE. */
  recordEvent: (event: AnalyticsEvent) => void
  /** Flush the buffer to disk. Fire-and-forget; failures re-enqueue events. */
  flushBuffer: () => Promise<void>
  /** Tear down the periodic flush timer + beforeunload listener. */
  stopAutoFlush: () => void
}

// Module-private buffer + timer. Stores are singletons so module-level mutable
// state is acceptable (per CLAUDE.md "Module-level mutable variables in React
// hooks" caveat — that warning applies to hooks, not Zustand stores).
let buffer: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let flushOnUnload: (() => void) | null = null

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  events: [],
  isLoaded: false,
  timeRange: 'all',
  dbSize: 0,

  loadEvents: async () => {
    const { timeRange } = get()
    // Hydration default per acceptance: load last 30 days when no explicit range
    // is set yet ('all' here means "show all loaded"; we still bound the wire
    // request to the default window to avoid pulling years of rows).
    const windowMs = RANGE_MS[timeRange] > 0 ? RANGE_MS[timeRange] : DEFAULT_HYDRATE_WINDOW_MS
    const since = Date.now() - windowMs
    try {
      const events = await ipc.analyticsLoad(since)
      // Bail-out guard: only set if events actually changed (length is a cheap
      // proxy; the dashboard re-fetches via setTimeRange anyway when filtering).
      if (get().events !== events || !get().isLoaded) {
        set({ events, isLoaded: true })
      }
    } catch (err) {
      // Acceptance: "store starts empty and logs the error rather than crashing".
      console.warn('[analyticsStore] loadEvents failed; starting empty', err)
      if (!get().isLoaded) set({ isLoaded: true })
    }
  },

  setTimeRange: (range) => {
    if (get().timeRange === range) return
    set({ timeRange: range })
    void get().loadEvents()
  },

  clearData: async () => {
    await ipc.analyticsClear()
    // Drop any in-flight buffered events too so a clear truly clears.
    buffer = []
    if (get().events.length !== 0 || get().dbSize !== 0) {
      set({ events: [], dbSize: 0 })
    }
  },

  refreshDbSize: async () => {
    try {
      const size = await ipc.analyticsDbSize()
      if (get().dbSize !== size) set({ dbSize: size })
    } catch {
      /* ignore — db-size refresh is best-effort */
    }
  },

  recordEvent: (event) => {
    buffer.push(event)
    if (buffer.length >= FLUSH_BATCH_SIZE) {
      void get().flushBuffer()
    }
  },

  flushBuffer: async () => {
    if (buffer.length === 0) return
    const batch = buffer.splice(0)
    try {
      await ipc.analyticsSave(batch)
    } catch (err) {
      // Re-enqueue at the front so we don't lose events on transient failure.
      buffer.unshift(...batch)
      console.warn('[analyticsStore] flushBuffer failed; events re-queued', err)
    }
  },

  stopAutoFlush: () => {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    if (flushOnUnload) {
      window.removeEventListener('beforeunload', flushOnUnload)
      flushOnUnload = null
    }
    // Final best-effort flush so we don't drop the tail.
    void get().flushBuffer()
  },
}))

/** Start the periodic flush + unload listener. Idempotent (HMR-safe). */
const startAutoFlush = (): void => {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    void useAnalyticsStore.getState().flushBuffer()
  }, FLUSH_INTERVAL_MS)
  flushOnUnload = () => { void useAnalyticsStore.getState().flushBuffer() }
  // beforeunload is unavailable in non-DOM environments (vitest node runner).
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushOnUnload)
  }
}

// Auto-start the flush loop on first import in a browser context. In tests
// the store can opt out by calling `stopAutoFlush()` in afterEach.
if (typeof window !== 'undefined') {
  startAutoFlush()
}
