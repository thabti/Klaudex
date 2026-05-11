import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useModifierKeys } from './useModifierKeys'

/**
 * Tests for `useModifierKeys`.
 *
 * SUT: src/renderer/hooks/useModifierKeys.ts
 * - Returns boolean indicating whether Meta (Cmd) key is held
 * - Uses delayed show (100ms) and instant hide to prevent flicker
 * - Clears on window blur to avoid stuck state
 */

const dispatchKey = (type: 'keydown' | 'keyup', key: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }))
}

describe('useModifierKeys', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initial state is false', () => {
    const { result } = renderHook(() => useModifierKeys())
    expect(result.current).toBe(false)
  })

  it('returns true after Meta keydown + delay', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'Meta') })
    // Not yet visible (delayed show)
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(true)
  })

  it('keyup Meta hides instantly', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'Meta') })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(true)
    act(() => { dispatchKey('keyup', 'Meta') })
    expect(result.current).toBe(false)
  })

  it('alternative cmd key names (OS, Command) also work', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'OS') })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(true)
    act(() => { dispatchKey('keyup', 'OS') })
    expect(result.current).toBe(false)

    act(() => { dispatchKey('keydown', 'Command') })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(true)
    act(() => { dispatchKey('keyup', 'Command') })
    expect(result.current).toBe(false)
  })

  it('quick tap (release before delay) does not show', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'Meta') })
    act(() => { vi.advanceTimersByTime(50) })
    act(() => { dispatchKey('keyup', 'Meta') })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(false)
  })

  it('window blur clears state (prevents stuck-key bug)', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'Meta') })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(true)
    act(() => { window.dispatchEvent(new Event('blur')) })
    expect(result.current).toBe(false)
  })

  it('removes all window listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useModifierKeys())
    unmount()
    const removedTypes = removeSpy.mock.calls.map((c) => c[0])
    expect(removedTypes).toContain('keydown')
    expect(removedTypes).toContain('keyup')
    expect(removedTypes).toContain('blur')
    removeSpy.mockRestore()
  })
})
