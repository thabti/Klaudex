import { useEffect, useState } from 'react'

export interface ModifierKeys {
  shift: boolean
  cmd: boolean
  ctrl: boolean
  alt: boolean
}

/**
 * Tracks the live held-state of the four modifier keys (Shift / Cmd / Ctrl / Alt).
 *
 * - Listens on `window` with `capture: true` so it observes events before any
 *   focused input/textarea swallows them via stopPropagation.
 * - Clears all flags on `blur` to prevent a "stuck Cmd" after Cmd+Tab leaves
 *   the window without firing a keyup.
 * - Listeners are removed on unmount.
 */
export const useModifierKeys = (): ModifierKeys => {
  const [shift, setShift] = useState(false)
  const [cmd, setCmd] = useState(false)
  const [ctrl, setCtrl] = useState(false)
  const [alt, setAlt] = useState(false)

  useEffect(() => {
    const isCmdKey = (key: string): boolean =>
      key === 'Meta' || key === 'OS' || key === 'Command'

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') setShift(true)
      if (isCmdKey(e.key)) setCmd(true)
      if (e.key === 'Control') setCtrl(true)
      if (e.key === 'Alt') setAlt(true)
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') setShift(false)
      if (isCmdKey(e.key)) setCmd(false)
      if (e.key === 'Control') setCtrl(false)
      if (e.key === 'Alt') setAlt(false)
    }

    const handleBlur = (): void => {
      setShift(false)
      setCmd(false)
      setCtrl(false)
      setAlt(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return { shift, cmd, ctrl, alt }
}
