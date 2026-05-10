import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useModifierKeys } from './useModifierKeys'

/**
 * Tests for `useModifierKeys` (TASK-048).
 *
 * SUT: src/renderer/hooks/useModifierKeys.ts
 * - Listens with `capture: true` on `keydown` / `keyup`
 * - Listens on `blur` (no capture) to clear all modifier flags
 *   (prevents "stuck Cmd" after Cmd+Tab leaves the window without keyup).
 * - Removes all 3 listeners on unmount.
 */

const dispatchKey = (type: 'keydown' | 'keyup', key: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }))
}

describe('useModifierKeys', () => {
  it('initial state has all four flags false', () => {
    const { result } = renderHook(() => useModifierKeys())
    expect(result.current).toEqual({ shift: false, cmd: false, ctrl: false, alt: false })
  })

  it('keydown Shift sets shift=true; keyup Shift clears it', () => {
    const { result } = renderHook(() => useModifierKeys())

    act(() => { dispatchKey('keydown', 'Shift') })
    expect(result.current.shift).toBe(true)
    expect(result.current.cmd).toBe(false)

    act(() => { dispatchKey('keyup', 'Shift') })
    expect(result.current.shift).toBe(false)
  })

  it('keydown Meta sets cmd=true (Mac Cmd key)', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => { dispatchKey('keydown', 'Meta') })
    expect(result.current.cmd).toBe(true)
    act(() => { dispatchKey('keyup', 'Meta') })
    expect(result.current.cmd).toBe(false)
  })

  it('alternative cmd key names (OS, Command) also flip the cmd flag', () => {
    const { result } = renderHook(() => useModifierKeys())

    act(() => { dispatchKey('keydown', 'OS') })
    expect(result.current.cmd).toBe(true)
    act(() => { dispatchKey('keyup', 'OS') })
    expect(result.current.cmd).toBe(false)

    act(() => { dispatchKey('keydown', 'Command') })
    expect(result.current.cmd).toBe(true)
    act(() => { dispatchKey('keyup', 'Command') })
    expect(result.current.cmd).toBe(false)
  })

  it('keydown Control + Alt update ctrl/alt flags', () => {
    const { result } = renderHook(() => useModifierKeys())

    act(() => { dispatchKey('keydown', 'Control') })
    expect(result.current.ctrl).toBe(true)

    act(() => { dispatchKey('keydown', 'Alt') })
    expect(result.current.alt).toBe(true)

    act(() => {
      dispatchKey('keyup', 'Control')
      dispatchKey('keyup', 'Alt')
    })
    expect(result.current.ctrl).toBe(false)
    expect(result.current.alt).toBe(false)
  })

  it('non-modifier keys do not flip any flag', () => {
    const { result } = renderHook(() => useModifierKeys())
    act(() => {
      dispatchKey('keydown', 'a')
      dispatchKey('keydown', 'Enter')
      dispatchKey('keydown', 'Escape')
    })
    expect(result.current).toEqual({ shift: false, cmd: false, ctrl: false, alt: false })
  })

  it('window blur clears all flags (prevents stuck-key bug)', () => {
    const { result } = renderHook(() => useModifierKeys())

    // Hold Shift + Cmd
    act(() => {
      dispatchKey('keydown', 'Shift')
      dispatchKey('keydown', 'Meta')
    })
    expect(result.current.shift).toBe(true)
    expect(result.current.cmd).toBe(true)

    // Window loses focus (e.g. Cmd+Tab) — keyup may never fire.
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current).toEqual({ shift: false, cmd: false, ctrl: false, alt: false })
  })

  it('removes all three window listeners on unmount', () => {
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
