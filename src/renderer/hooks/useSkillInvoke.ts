import { useCallback } from 'react'
import type { ClaudeSkill } from '@/types'
import { useSkillsPaletteStore } from '@/stores/skillsPaletteStore'

/**
 * useSkillInvoke
 *
 * Returns a stable callback that dispatches a Claude skill invocation by
 * emitting the project's existing `splash-insert` CustomEvent on `document`.
 * That event is listened for by the chat input (see
 * `ChatInput.tsx`), which inserts the slash command text into the composer.
 *
 * The hook is fire-and-forget and uses `useSkillsPaletteStore.getState()` so
 * it never subscribes to the store — it must not re-run when palette state
 * changes. The palette is always closed after invocation, regardless of
 * whether the dispatch succeeded.
 *
 * Failure handling:
 * - If `document.dispatchEvent` throws or `document` is unusable (SSR-like
 *   environment, unusual DOM state), the hook falls back to writing
 *   `skill.bodyExcerpt ?? skill.name` to the clipboard.
 * - If the clipboard write also fails, the rejection is swallowed with a
 *   `console.warn` so the call site never sees an exception.
 */
export const useSkillInvoke = (): ((skill: ClaudeSkill) => void) => {
  return useCallback((skill: ClaudeSkill) => {
    const payload = `/${skill.name}`
    let dispatched = false

    try {
      if (typeof document !== 'undefined' && document?.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('splash-insert', { detail: payload }))
        dispatched = true
      }
    } catch (error) {
      console.warn('useSkillInvoke: splash-insert dispatch failed', error)
    }

    if (!dispatched) {
      try {
        const fallback = skill.bodyExcerpt ?? skill.name
        const clipboard =
          typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        const writeResult = clipboard?.writeText(fallback)
        if (writeResult && typeof writeResult.then === 'function') {
          writeResult.catch((error: unknown) => {
            console.warn('useSkillInvoke: clipboard fallback failed', error)
          })
        }
      } catch (error) {
        console.warn('useSkillInvoke: clipboard fallback threw', error)
      }
    }

    try {
      useSkillsPaletteStore.getState().close()
    } catch (error) {
      console.warn('useSkillInvoke: palette close failed', error)
    }
  }, [])
}
