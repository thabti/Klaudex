// Stub for shiki — removes ~300 language grammar chunks (~8MB) from the bundle.
// @pierre/diffs still renders diffs correctly (addition/deletion coloring),
// just without per-language syntax highlighting.

// Proxy that returns a no-op loader for any language, preventing
// @pierre/diffs resolveLanguage from throwing "not found" errors.
const noopLang = { default: { name: 'text', patterns: [], scopeName: 'source.text' } }
export const bundledLanguages = new Proxy({} as Record<string, () => Promise<unknown>>, {
  has: () => true,
  get: (_target, prop) => {
    if (typeof prop === 'string') return () => Promise.resolve(noopLang)
    return undefined
  },
  getOwnPropertyDescriptor: (_target, _prop) => ({
    configurable: true,
    enumerable: true,
    writable: true,
    value: () => Promise.resolve(noopLang),
  }),
})
export const bundledThemes = {}

// Minimal theme object returned by getTheme — satisfies @pierre/diffs internal calls.
const NOOP_THEME = {
  name: 'noop',
  type: 'dark',
  bg: '#111114',
  fg: '#eeeeee',
  settings: [],
  colors: {},
}

export function createHighlighter() {
  return Promise.resolve({
    codeToTokens: () => ({ tokens: [], bg: '#111114', fg: '#eeeeee', themeName: 'noop' }),
    codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
    getLoadedLanguages: () => [],
    getLoadedThemes: () => ['noop'],
    getTheme: () => NOOP_THEME,
    loadLanguage: () => Promise.resolve(),
    loadTheme: () => Promise.resolve(),
  })
}

export function createJavaScriptRegexEngine() {
  return {}
}

export function createOnigurumaEngine() {
  return Promise.resolve({})
}

export function codeToHtml(code: string) {
  return `<pre><code>${code}</code></pre>`
}

export function createCssVariablesTheme() {
  return { name: 'css-variables', type: 'css-variables' }
}

export function normalizeTheme(theme: unknown) {
  return theme
}

export function getTokenStyleObject() {
  return {}
}

export function stringifyTokenStyle() {
  return ''
}
