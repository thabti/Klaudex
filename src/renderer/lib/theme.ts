import type { ThemeMode } from '@/types'

const THEME_KEY = 'klaudex-theme'

/** Resolve 'system' to the actual dark/light/claude value based on OS preference. */
export const getResolvedTheme = (mode: ThemeMode): 'dark' | 'light' | 'claude' => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

/** Read the persisted theme from localStorage (falls back to 'claude'). */
export const readPersistedTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system' || stored === 'claude') return stored
  } catch { /* ignore */ }
  return 'claude'
}

/** Persist theme choice to localStorage for instant access before React boots. */
export const persistTheme = (mode: ThemeMode): void => {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* ignore */ }
}

/**
 * Apply the theme to the document. Sets the `dark` or `claude` class on
 * <html> (mutually exclusive — only one is active at a time), adjusts
 * color-scheme, and updates the body background for the splash screen.
 * Suppresses transitions briefly to avoid a flash.
 */
export const applyTheme = (mode: ThemeMode): void => {
  const resolved = getResolvedTheme(mode)
  const root = document.documentElement

  // Suppress transitions during theme switch
  root.classList.add('no-transitions')

  // Reset both theme classes; re-add the active one. Mutually exclusive.
  root.classList.remove('dark', 'claude')
  if (resolved === 'dark') {
    root.classList.add('dark')
    document.body.style.backgroundColor = '#0a0a0a'
  } else if (resolved === 'claude') {
    root.classList.add('claude')
    document.body.style.backgroundColor = '#0a0a0a'
  } else {
    document.body.style.backgroundColor = '#ffffff'
  }

  // Re-enable transitions after a frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('no-transitions')
    })
  })
}

/** Subscribe to OS theme changes. Returns an unsubscribe function. */
export const listenSystemTheme = (onChange: () => void): (() => void) => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
