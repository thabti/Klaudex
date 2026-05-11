import { memo, useCallback, useState } from 'react'
import { IconCommand, IconChevronRight } from '@tabler/icons-react'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import type { ClaudeCommand } from '@/types'
import { formatName, SourceDot } from './claude-config-helpers'

interface ClaudeCommandRowProps {
  command: ClaudeCommand
}

/**
 * Compact relative path for display: shows last two segments
 * (e.g., `commands/foo.md` or `~/.claude/commands/foo.md` collapsed
 * to `commands/foo.md`).
 */
const relativePath = (filePath: string): string => {
  if (!filePath) return ''
  const home = filePath.replace(/^\/Users\/[^/]+/, '~')
  // Show parent dir + filename when path is long
  const parts = home.split('/')
  if (parts.length <= 3) return home
  return parts.slice(-2).join('/')
}

export const ClaudeCommandRow = memo(function ClaudeCommandRow({ command }: ClaudeCommandRowProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleToggle = useCallback(async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (body !== null || loading) return
    if (!command.filePath) {
      setError('Could not read file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const content = await ipc.readFile(command.filePath)
      if (content === null) {
        setError('Could not read file')
      } else {
        setBody(content)
      }
    } catch {
      setError('Could not read file')
    } finally {
      setLoading(false)
    }
  }, [open, body, loading, command.filePath])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        void handleToggle()
      }
    },
    [handleToggle],
  )

  const shortPath = relativePath(command.filePath)

  return (
    <li className="flex min-w-0 w-full flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => void handleToggle()}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-6 min-w-0 w-full items-center gap-1.5 rounded-md px-1.5 text-[11px] cursor-pointer',
          'text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors',
        )}
      >
        <IconChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <IconCommand
          className="size-3 shrink-0 text-amber-600 dark:text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{formatName(command.name)}</span>
        {shortPath && (
          <span className="shrink-0 truncate font-mono text-[9px] text-muted-foreground/60 max-w-[60%]">
            {shortPath}
          </span>
        )}
        <SourceDot source={command.source} />
      </div>

      {open && (
        <div className="mx-1 mb-1 mt-0.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-[10px] text-foreground/80">
          {loading && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading…</span>
            </div>
          )}
          {!loading && error && <p className="text-muted-foreground">Could not read file</p>}
          {!loading && !error && body !== null && (
            <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-foreground/80">
              {body}
            </pre>
          )}
        </div>
      )}
    </li>
  )
})
