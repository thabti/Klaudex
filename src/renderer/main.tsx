import '@fontsource-variable/dm-sans'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../tailwind.css'

// Apply dark theme immediately to prevent white flash
document.documentElement.classList.add('dark')

function showError(err: unknown) {
  const fallback = document.getElementById('error-fallback')
  const msg = document.getElementById('error-message')
  const root = document.getElementById('root')
  if (fallback) fallback.style.display = 'flex'
  if (root) root.style.display = 'none'

  let text: string
  if (err instanceof Error) {
    // Clean up Vite/Tauri internal frames to surface the actual error
    const stack = (err.stack ?? '')
      .split('\n')
      .filter((l) => !l.includes('node_modules/.vite/'))
      .slice(0, 15)
      .join('\n')
    text = `${err.name}: ${err.message}\n\n${stack}`
  } else {
    text = String(err)
  }
  if (msg) msg.textContent = text
  console.error('[Kirodex crash]', err)
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { showError(error) }
  render() { return this.state.error ? null : this.props.children }
}

window.addEventListener('unhandledrejection', (e) => showError(e.reason))
window.addEventListener('error', (e) => showError(e.error ?? e.message))

// Wire up error fallback buttons
document.getElementById('reload-btn')?.addEventListener('click', () => {
  window.location.reload()
})
document.getElementById('copy-error-btn')?.addEventListener('click', () => {
  const msg = document.getElementById('error-message')?.textContent ?? ''
  navigator.clipboard.writeText(msg).then(() => {
    const btn = document.getElementById('copy-error-btn')
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Error' }, 2000) }
  }).catch(() => {})
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Fade out and remove splash screen after React mounts
const splash = document.getElementById('splash')
if (splash) {
  splash.style.opacity = '0'
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
}

