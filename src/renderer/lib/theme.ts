import type { ThemeMode } from '@/types'

const THEME_KEY = 'klaudex-theme'

/** Resolve 'system' to the actual dark/light value based on OS preference. */
export const getResolvedTheme = (mode: ThemeMode): 'dark' | 'light' => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

/**
 * Read the persisted theme from localStorage (falls back to 'dark', the
 * default Claude orange-on-dark look). Migrates the legacy `'claude'` value
 * (shipped briefly when the orange theme was a separate variant) to `'dark'`
 * silently — both now produce the orange-on-dark surface.
 */
export const readPersistedTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
    if (stored === 'claude') return 'dark'
  } catch { /* ignore */ }
  return 'dark'
}

/** Persist theme choice to localStorage for instant access before React boots. */
export const persistTheme = (mode: ThemeMode): void => {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* ignore */ }
}

/**
 * Apply the theme to the document. Sets the `dark` class on <html> when
 * resolved theme is dark; otherwise the `:root` light styles apply. Adjusts
 * the splash background and suppresses transitions briefly to avoid a flash.
 */
export const applyTheme = (mode: ThemeMode): void => {
  const resolved = getResolvedTheme(mode)
  const root = document.documentElement

  root.classList.add('no-transitions')
  // Strip the legacy `claude` class if present from an older build.
  root.classList.remove('dark', 'claude')
  if (resolved === 'dark') {
    root.classList.add('dark')
    document.body.style.backgroundColor = '#0a0a0a'
  } else {
    document.body.style.backgroundColor = '#ffffff'
  }

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
