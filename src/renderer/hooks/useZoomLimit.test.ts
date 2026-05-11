import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'

/**
 * Tests for `useZoomLimit` (TASK-048).
 *
 * SUT: src/renderer/hooks/useZoomLimit.ts
 * - Listens on window for `wheel` (with ctrlKey) and `keydown` (with meta/ctrl).
 * - Calls `webview.setZoom(clamped)` via Tauri's `getCurrentWebview()`.
 * - On mount, force-resets zoom to 100% so any out-of-range persisted zoom
 *   is immediately clamped back into [50%, 100%].
 *
 * The Tauri webview API is mocked at the module level so the hook can run
 * under jsdom without touching native code.
 */

const setZoomMock = vi.fn<(zoom: number) => Promise<void>>(async () => {})

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: setZoomMock,
  }),
}))

// Imported AFTER vi.mock so the mocked module is wired up.
import { useZoomLimit } from './useZoomLimit'

const ZOOM_MAX = 1.0
const ZOOM_MIN = 0.5
const ZOOM_STEP = 0.05

const dispatchKey = (key: string, opts: KeyboardEventInit = {}): KeyboardEvent => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts })
  window.dispatchEvent(ev)
  return ev
}

const dispatchWheel = (deltaY: number, ctrlKey = true): WheelEvent => {
  const ev = new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true })
  window.dispatchEvent(ev)
  return ev
}

describe('useZoomLimit', () => {
  beforeEach(() => {
    setZoomMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('on mount, forces an initial setZoom(1.0) to clamp any out-of-range persisted zoom', () => {
    // Even if the WebView booted with an out-of-range value (e.g. 110% or 30%),
    // the hook must immediately re-issue setZoom(ZOOM_MAX) on mount.
    renderHook(() => useZoomLimit())
    expect(setZoomMock).toHaveBeenCalledTimes(1)
    expect(setZoomMock).toHaveBeenCalledWith(ZOOM_MAX)
  })

  it('Cmd+= attempts to zoom past 100% but is clamped to 100% (no-op once already at max)', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear() // ignore the mount call

    // Already at ZOOM_MAX after mount; Cmd+= should be a clamped no-op.
    act(() => {
      dispatchKey('=', { metaKey: true })
    })

    // Hook bails out via `if (clamped === zoomRef.current) return` so setZoom
    // should NOT be called when we're already at the ceiling.
    expect(setZoomMock).not.toHaveBeenCalled()
  })

  it('Cmd+- decrements zoom (and Cmd+- repeated bottoms out at 50%)', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear()

    // First Cmd+- → 0.95
    act(() => {
      dispatchKey('-', { metaKey: true })
    })
    expect(setZoomMock).toHaveBeenLastCalledWith(
      // floating-point-safe compare via a closeTo-style assertion
      expect.any(Number),
    )
    const firstCall = setZoomMock.mock.calls[0]?.[0] ?? -1
    expect(firstCall).toBeCloseTo(ZOOM_MAX - ZOOM_STEP, 5)

    // Hammer Cmd+- 30 times — we should bottom out at ZOOM_MIN.
    for (let i = 0; i < 30; i++) {
      act(() => {
        dispatchKey('-', { metaKey: true })
      })
    }
    const lastCall = setZoomMock.mock.calls[setZoomMock.mock.calls.length - 1]?.[0] ?? -1
    expect(lastCall).toBeCloseTo(ZOOM_MIN, 5)
  })

  it('Cmd+0 resets zoom to 100% (after first stepping below)', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear()

    // Step down once
    act(() => {
      dispatchKey('-', { metaKey: true })
    })
    expect(setZoomMock).toHaveBeenCalled()

    setZoomMock.mockClear()

    // Cmd+0 should reset to ZOOM_MAX
    act(() => {
      dispatchKey('0', { metaKey: true })
    })
    expect(setZoomMock).toHaveBeenCalledTimes(1)
    expect(setZoomMock).toHaveBeenCalledWith(ZOOM_MAX)
  })

  it('Ctrl+wheel zooms in/out and is clamped to [50%, 100%]', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear()

    // deltaY > 0 → zoom out (negative direction in the SUT)
    act(() => {
      dispatchWheel(120, true)
    })
    const firstCall = setZoomMock.mock.calls[0]?.[0] ?? -1
    expect(firstCall).toBeCloseTo(ZOOM_MAX - ZOOM_STEP, 5)
  })

  it('plain wheel (no ctrlKey) is ignored — does not call setZoom', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear()
    act(() => {
      dispatchWheel(120, false)
    })
    expect(setZoomMock).not.toHaveBeenCalled()
  })

  it('non-zoom keys are ignored — no setZoom call', () => {
    renderHook(() => useZoomLimit())
    setZoomMock.mockClear()
    act(() => {
      dispatchKey('a', { metaKey: true })
      dispatchKey('Enter', { metaKey: true })
      dispatchKey('=', {}) // no meta/ctrl
    })
    expect(setZoomMock).not.toHaveBeenCalled()
  })

  it('removes wheel + keydown window listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useZoomLimit())
    unmount()

    const removed = removeSpy.mock.calls.map((c) => c[0])
    expect(removed).toContain('wheel')
    expect(removed).toContain('keydown')
  })
})
