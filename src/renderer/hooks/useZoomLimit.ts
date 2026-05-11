import { useEffect, useRef } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0
const ZOOM_DEFAULT = 0.9
const ZOOM_STEP = 0.1
const ZOOM_STORAGE_KEY = 'klaudex-zoom-level'

const clampZoom = (value: number): number =>
  Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100

// localStorage throws in private browsing, incognito, and quota-exceeded
// contexts — keep zoom usable even when persistence is unavailable.
const readStoredZoom = (): string | null => {
  try {
    return localStorage.getItem(ZOOM_STORAGE_KEY)
  } catch {
    return null
  }
}

const writeStoredZoom = (value: number): void => {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(value))
  } catch (e) {
    console.warn('[useZoomLimit] failed to persist zoom level', e)
  }
}

/**
 * Manages webview zoom level with Cmd+/Cmd- keyboard shortcuts and
 * Ctrl+wheel (trackpad pinch). Persists zoom level across sessions.
 */
export const useZoomLimit = (): void => {
  const zoomRef = useRef(ZOOM_DEFAULT)

  useEffect(() => {
    const webview = getCurrentWebview()

    // Restore persisted zoom level or fall back to the default
    const stored = readStoredZoom()
    const initial = stored ? clampZoom(parseFloat(stored)) : ZOOM_DEFAULT
    zoomRef.current = initial
    webview.setZoom(initial)

    const applyZoom = (next: number): void => {
      const clamped = clampZoom(next)
      if (clamped === zoomRef.current) return
      zoomRef.current = clamped
      webview.setZoom(clamped)
      writeStoredZoom(clamped)
    }

    // Re-clamp on mount: Tauri's webview JS API does not expose a getter
    // for the current zoom, so reset to ZOOM_MAX (100%) which is the
    // expected default and guarantees we start inside [ZOOM_MIN, ZOOM_MAX].
    zoomRef.current = ZOOM_MAX
    void webview.setZoom(ZOOM_MAX)

    const handleWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      applyZoom(zoomRef.current + direction)
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        e.stopPropagation()
        applyZoom(zoomRef.current + ZOOM_STEP)
      } else if (e.key === '-') {
        e.preventDefault()
        e.stopPropagation()
        applyZoom(zoomRef.current - ZOOM_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        e.stopPropagation()
        applyZoom(ZOOM_DEFAULT)
      }
    }

    // Use capture phase so zoom shortcuts are handled BEFORE other keydown listeners
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])
}
