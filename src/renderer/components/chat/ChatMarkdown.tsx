import React, {
  Children,
  Suspense,
  createContext,
  isValidElement,
  memo,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconCheck, IconCopy } from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { fnv1a32, resolveDiffThemeName, type DiffThemeName } from '@/lib/diffRendering'
import { LRUCache } from '@/lib/lruCache'
import { getHighlighterPromise } from '@/lib/chatHighlighter'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { useSettingsStore, selectChatFontSize } from '@/stores/settingsStore'
import { hasInteractiveQuestionBlocks, stripQuestionBlocks } from '@/lib/question-parser'
import { handleExternalLinkClick, handleExternalLinkKeyDown } from '@/lib/open-external'
import { HighlightText } from './HighlightText'
import { useMessageListTaskId } from './MessageList'
import { QuestionCards } from './QuestionCards'
import { FileTypeIcon } from '@/components/file-tree/FileTypeIcon'
import { useFilePreviewStore } from '@/stores/filePreviewStore'

interface ChatMarkdownProps {
  text: string
  isStreaming?: boolean
  questionsAnswered?: boolean
  taskId?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROSE_CLASSES =
  'chat-markdown w-full min-w-0 leading-[1.7] text-foreground'
const FILE_PATH_RE = /^(?:\.{0,2}[\\/])?(?:[\w.@-]+[\\/])*[\w.@-]+\.\w{1,10}$/
const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/

// 500 entries / ~50MB. The cache is process-wide
// so it survives MessageList virtualization remounts.
const MAX_HIGHLIGHT_CACHE_ENTRIES = 500
const MAX_HIGHLIGHT_CACHE_MEMORY_BYTES = 50 * 1024 * 1024
const highlightedCodeCache = new LRUCache<string>(
  MAX_HIGHLIGHT_CACHE_ENTRIES,
  MAX_HIGHLIGHT_CACHE_MEMORY_BYTES,
)

const remarkPlugins = [remarkGfm]

// ─── Small helpers ────────────────────────────────────────────────────────────

function nodeToPlainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToPlainText).join('')
  if (isValidElement<{ children?: ReactNode }>(node))
    return nodeToPlainText(node.props.children)
  return ''
}

function extractCodeBlock(
  children: ReactNode,
): { className?: string; code: string } | null {
  const nodes = Children.toArray(children)
  if (nodes.length !== 1) return null
  const child = nodes[0]
  if (
    !isValidElement<{ className?: string; children?: ReactNode }>(child) ||
    child.type !== 'code'
  )
    return null
  return {
    className: child.props.className,
    code: nodeToPlainText(child.props.children),
  }
}

/**
 * Pull the language name out of a `language-foo` className.
 * Shiki has no `gitignore` grammar (kirodex GH#685) — `ini` is a close match
 * and produces useful colors without a console warning.
 */
function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX)
  const raw = match?.[1] ?? 'text'
  return raw === 'gitignore' ? 'ini' : raw
}

function createHighlightCacheKey(
  code: string,
  language: string,
  themeName: DiffThemeName,
): string {
  return `${fnv1a32(code).toString(36)}:${code.length}:${language}:${themeName}`
}

function estimateHighlightedSize(html: string, code: string): number {
  // Shiki HTML is roughly 2x the source; keep a floor based on raw code so
  // we never under-account for very small snippets.
  return Math.max(html.length * 2, code.length * 3)
}

/**
 * Recursively walk children and wrap every string leaf with HighlightText so
 * the chat search bar can highlight matches inside `<strong>`, `<em>`, `<a>`
 * and other inline tags.
 */
function wrapChildrenWithHighlight(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') return <HighlightText text={child} />
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children != null) {
      const { children: _nested, ...rest } = child.props
      return {
        ...child,
        props: { ...rest, children: wrapChildrenWithHighlight(child.props.children) },
      }
    }
    return child
  })
}

/** Close unclosed markdown constructs so partial streams don't render broken DOM. */
function stabilizeStreamingMarkdown(text: string): string {
  const fenceCount = (text.match(/^```/gm) || []).length
  if (fenceCount % 2 !== 0) text += '\n```'
  const backticks = (text.match(/(?<!`)`(?!`)/g) || []).length
  if (backticks % 2 !== 0) text += '`'
  return text
}

// ─── Code block components ────────────────────────────────────────────────────

/**
 * Per-render context that lets the static `components` map (defined once at
 * module scope) read the current theme name and streaming state without
 * forcing a fresh `Components` object on every chunk. Recreating the
 * components map on every streaming token would re-mount the entire
 * ReactMarkdown render tree internally; threading these two values through
 * context keeps the map stable.
 */
interface CodeFenceContext {
  themeName: DiffThemeName
  isStreaming: boolean
}
const CodeFenceCtx = createContext<CodeFenceContext>({
  themeName: 'pierre-dark' as DiffThemeName,
  isStreaming: false,
})

/**
 * Plain `<pre><code>` fallback. Used when:
 *   - the highlighter is loading (Suspense fallback),
 *   - highlighting fails (error boundary fallback).
 */
function PlainCodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre className="overflow-x-auto px-4 py-3.5 leading-[1.6] text-foreground">
      <code className={className}>{code}</code>
    </pre>
  )
}

class CodeHighlightErrorBoundary extends React.Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Surface for debugging; the boundary still renders the fallback.
    // `info.componentStack` is invaluable when the failure happens deep
    // inside Shiki's hast → React tree.
    console.warn('Chat code highlight failed:', error, info.componentStack)
  }
  override render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

interface ShikiCodeProps {
  code: string
  language: string
  themeName: DiffThemeName
  isStreaming: boolean
}

/**
 * Reads a cached HTML result if available; otherwise mounts the
 * Suspense-driven uncached variant which actually invokes the highlighter.
 *
 * Cache reads are skipped while streaming because the code body changes
 * every token — caching that would thrash the LRU.
 *
 * `cacheKey` is memoized on `(code, language, themeName)` so we don't
 * re-hash a 10 KB code block on every render. FNV is fast but not free,
 * and `code` is stable across renders that don't change the body.
 */
function CachedShikiCodeBlock({ code, language, themeName, isStreaming }: ShikiCodeProps) {
  const cacheKey = useMemo(
    () => createHighlightCacheKey(code, language, themeName),
    [code, language, themeName],
  )
  const cached = !isStreaming ? highlightedCodeCache.get(cacheKey) : null

  if (cached != null) {
    return (
      <div
        className="chat-markdown-shiki"
        dangerouslySetInnerHTML={{ __html: cached }}
      />
    )
  }

  return (
    <UncachedShikiCodeBlock
      code={code}
      language={language}
      themeName={themeName}
      cacheKey={cacheKey}
      isStreaming={isStreaming}
    />
  )
}

interface UncachedShikiCodeProps extends ShikiCodeProps {
  cacheKey: string
}

function UncachedShikiCodeBlock({
  code,
  language,
  themeName,
  cacheKey,
  isStreaming,
}: UncachedShikiCodeProps) {
  // `use()` suspends until the highlighter promise resolves. The promise is
  // cached per-language so re-renders don't re-fetch.
  const highlighter = use(getHighlighterPromise(language))

  const html = useMemo(() => {
    try {
      return highlighter.codeToHtml(code, { lang: language, theme: themeName })
    } catch (err) {
      console.warn(
        `Code highlighting failed for language "${language}", falling back to plain text.`,
        err instanceof Error ? err.message : err,
      )
      return highlighter.codeToHtml(code, { lang: 'text', theme: themeName })
    }
  }, [code, highlighter, language, themeName])

  useEffect(() => {
    if (isStreaming) return
    highlightedCodeCache.set(cacheKey, html, estimateHighlightedSize(html, code))
  }, [cacheKey, code, html, isStreaming])

  return (
    <div
      className="chat-markdown-shiki"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

const CopyButton = memo(function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || navigator.clipboard == null) return
    void navigator.clipboard.writeText(text).then(() => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setCopied(true)
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 1200)
    })
  }, [text])

  // Clear pending timer if the component unmounts mid-feedback.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    },
    [],
  )

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
    </button>
  )
})

// ─── Components map ───────────────────────────────────────────────────────────
//
// Defined ONCE at module scope. The `pre` handler reads `themeName` and
// `isStreaming` from context (`CodeFenceCtx`) so this object is referentially
// stable across every render — ReactMarkdown's reconciler then doesn't have
// to re-mount its render tree on every streaming chunk.

const PreFence: Components['pre'] = ({ children, ...props }) => {
  const { themeName, isStreaming } = useContext(CodeFenceCtx)
  const block = extractCodeBlock(children)
  if (!block) return <pre {...props}>{children}</pre>
  const language = extractFenceLanguage(block.className)
  const fallback = <PlainCodeBlock code={block.code} className={block.className} />
  return (
    <div className="chat-markdown-codeblock group relative my-3 overflow-hidden rounded-lg border border-border/50 bg-muted/50 dark:bg-muted/30">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {language}
        </span>
        <CopyButton text={block.code} />
      </div>
      <CodeHighlightErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <CachedShikiCodeBlock
            code={block.code}
            language={language}
            themeName={themeName}
            isStreaming={isStreaming}
          />
        </Suspense>
      </CodeHighlightErrorBoundary>
    </div>
  )
}

const InlineCode: Components['code'] = ({ className, children, ...props }) => {
  if (className?.startsWith('language-')) {
    // Block-level code is rendered via the `pre` handler above; this
    // branch only fires for the inner <code> when react-markdown calls
    // both. Pass through with the className so Shiki can read it.
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
  const text = nodeToPlainText(children)
  if (!className && FILE_PATH_RE.test(text)) {
    const fileName = text.split('/').pop() ?? text
    return (
      <code
        role="button"
        tabIndex={0}
        onClick={() => useFilePreviewStore.getState().openPreview(text)}
        onKeyDown={(e) =>
          e.key === 'Enter' && useFilePreviewStore.getState().openPreview(text)
        }
        className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted px-1.5 py-0.5 text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:bg-accent hover:decoration-primary/60"
        title={`Preview ${text}`}
        style={{ fontSize: '0.9em' }}
        {...props}
      >
        <FileTypeIcon name={fileName} isDir={false} className="size-3.5 shrink-0" />
        {children}
      </code>
    )
  }
  return (
    <code
      className="rounded-md border border-border/50 bg-muted px-1.5 py-0.5 text-foreground"
      style={{ fontSize: '0.9em' }}
      {...props}
    >
      {children}
    </code>
  )
}

const STATIC_COMPONENTS: Components = {
  // Wrap text leaves so the chat-search highlight reaches inside inline tags.
  p: ({ children, ...props }) => <p {...props}>{wrapChildrenWithHighlight(children)}</p>,
  li: ({ children, ...props }) => <li {...props}>{wrapChildrenWithHighlight(children)}</li>,
  td: ({ children, ...props }) => <td {...props}>{wrapChildrenWithHighlight(children)}</td>,
  th: ({ children, ...props }) => <th {...props}>{wrapChildrenWithHighlight(children)}</th>,
  h1: ({ children, ...props }) => <h1 {...props}>{wrapChildrenWithHighlight(children)}</h1>,
  h2: ({ children, ...props }) => <h2 {...props}>{wrapChildrenWithHighlight(children)}</h2>,
  h3: ({ children, ...props }) => <h3 {...props}>{wrapChildrenWithHighlight(children)}</h3>,
  h4: ({ children, ...props }) => <h4 {...props}>{wrapChildrenWithHighlight(children)}</h4>,
  h5: ({ children, ...props }) => <h5 {...props}>{wrapChildrenWithHighlight(children)}</h5>,
  h6: ({ children, ...props }) => <h6 {...props}>{wrapChildrenWithHighlight(children)}</h6>,
  blockquote: ({ children, ...props }) => (
    <blockquote {...props}>{wrapChildrenWithHighlight(children)}</blockquote>
  ),
  strong: ({ children, ...props }) => <strong {...props}>{wrapChildrenWithHighlight(children)}</strong>,
  em: ({ children, ...props }) => <em {...props}>{wrapChildrenWithHighlight(children)}</em>,
  pre: PreFence,
  code: InlineCode,
  a: ({ href, ...props }) => (
    <a
      href={href}
      onClick={handleExternalLinkClick}
      onKeyDown={handleExternalLinkKeyDown}
      tabIndex={0}
      role="link"
      className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary/60"
      {...props}
    />
  ),
}

// ─── Main component ───────────────────────────────────────────────────────────

function ChatMarkdown({
  text,
  isStreaming = false,
  questionsAnswered = false,
  taskId: taskIdProp,
}: ChatMarkdownProps) {
  const contextTaskId = useMessageListTaskId()
  const resolvedTaskId = taskIdProp ?? contextTaskId
  const resolvedTheme = useResolvedTheme()
  const themeName = resolveDiffThemeName(resolvedTheme)

  // When the resolved theme flips (dark↔light), drop cached HTML for the
  // *other* theme so we don't pin both sets in memory simultaneously up to
  // the LRU cap. The cache key suffix `:<themeName>` makes the predicate a
  // simple string check.
  useEffect(() => {
    highlightedCodeCache.prune((key) => !key.endsWith(`:${themeName}`))
  }, [themeName])

  const displayText = useMemo(
    () => (isStreaming ? stabilizeStreamingMarkdown(text) : text),
    [text, isStreaming],
  )
  const chatFontSize = useSettingsStore(selectChatFontSize)
  const showQuestions = useMemo(
    () => !isStreaming && !questionsAnswered && hasInteractiveQuestionBlocks(displayText),
    [isStreaming, questionsAnswered, displayText],
  )
  const markdownText = useMemo(
    () => (showQuestions ? stripQuestionBlocks(displayText) : displayText),
    [showQuestions, displayText],
  )

  // Context value is the only thing that changes between streams; the
  // `STATIC_COMPONENTS` map handed to ReactMarkdown is the same object
  // forever.
  const codeFence = useMemo(() => ({ themeName, isStreaming }), [themeName, isStreaming])

  return (
    <div
      className={cn(PROSE_CLASSES, isStreaming && 'streaming-cursor')}
      style={{ fontSize: chatFontSize }}
    >
      <CodeFenceCtx.Provider value={codeFence}>
        <ReactMarkdown remarkPlugins={remarkPlugins} components={STATIC_COMPONENTS}>
          {markdownText}
        </ReactMarkdown>
      </CodeFenceCtx.Provider>
      {showQuestions && <QuestionCards text={displayText} taskId={resolvedTaskId} />}
    </div>
  )
}

export default memo(ChatMarkdown)
