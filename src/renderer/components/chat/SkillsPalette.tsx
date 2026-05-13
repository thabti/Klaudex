import { memo, useCallback, useMemo } from 'react'
import { IconBolt } from '@tabler/icons-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useSkillsPaletteStore } from '@/stores/skillsPaletteStore'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import { useSkillInvoke } from '@/hooks/useSkillInvoke'
import { fuzzyScore } from '@/lib/fuzzy-search'
import { cn } from '@/lib/utils'
import type { ClaudeSkill } from '@/types'

const MAX_RESULTS = 50
const MAX_PREVIEW_CHARS = 150

/**
 * Trim a description / body excerpt down to a fixed character budget so the
 * card height stays predictable even for skills that ship a long first line.
 * The `line-clamp-2` Tailwind class handles visual overflow, but capping the
 * raw text first means we don't measure off-screen content.
 */
const truncatePreview = (raw: string): string => {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= MAX_PREVIEW_CHARS) return trimmed
  return `${trimmed.slice(0, MAX_PREVIEW_CHARS - 1).trimEnd()}…`
}

interface SkillCardProps {
  skill: ClaudeSkill
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

const SkillCard = memo(function SkillCard({ skill, isSelected, onClick, onMouseEnter }: SkillCardProps) {
  const previewSource = skill.description ?? skill.bodyExcerpt ?? skill.filePath
  const preview = truncatePreview(previewSource)
  const showFilePath = Boolean(skill.filePath) && previewSource !== skill.filePath

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors outline-none',
        'focus-visible:bg-accent/70',
        isSelected ? 'bg-accent text-foreground' : 'text-foreground/90 hover:bg-accent/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md',
          isSelected
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-muted/60 text-amber-600 dark:text-amber-400',
        )}
        aria-hidden
      >
        <IconBolt className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold">{skill.name}</span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide',
              skill.source === 'global'
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {skill.source}
          </span>
        </span>
        {preview && (
          <span className="mt-0.5 block line-clamp-2 text-[12px] text-muted-foreground">{preview}</span>
        )}
        {showFilePath && (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground/70">{skill.filePath}</span>
        )}
      </span>
    </button>
  )
})

export const SkillsPalette = memo(function SkillsPalette() {
  const isOpen = useSkillsPaletteStore((s) => s.isOpen)
  const query = useSkillsPaletteStore((s) => s.query)
  const selectedIndex = useSkillsPaletteStore((s) => s.selectedIndex)
  const close = useSkillsPaletteStore((s) => s.close)
  const setQuery = useSkillsPaletteStore((s) => s.setQuery)
  const setSelectedIndex = useSkillsPaletteStore((s) => s.setSelectedIndex)
  const moveSelection = useSkillsPaletteStore((s) => s.moveSelection)

  // Active workspace pattern: the store maintains a per-workspace cache and
  // exposes `config` as a derived field that always points at the currently
  // active project's config. Other consumers (FileMentionPicker, AgentPanel,
  // ClaudeConfigPanel) use the same `s.config.skills` selector.
  const skills = useClaudeConfigStore((s) => s.config.skills)

  const invoke = useSkillInvoke()

  const filtered = useMemo<ClaudeSkill[]>(() => {
    const list = skills ?? []
    const trimmed = query.trim()
    if (!trimmed) return list.slice(0, MAX_RESULTS)
    return list
      .map((skill) => {
        const haystack = `${skill.name} ${skill.description ?? ''}`
        const score = fuzzyScore(trimmed, haystack)
        return score == null ? null : { skill, score }
      })
      .filter((entry): entry is { skill: ClaudeSkill; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.skill)
  }, [query, skills])

  // Clamp the highlight purely for rendering. The store will correct itself
  // on the next user interaction (arrow keys / typing). This prevents a
  // briefly-out-of-range highlight when the filter shrinks the list.
  const effectiveSelectedIndex = filtered.length > 0
    ? Math.min(selectedIndex, filtered.length - 1)
    : 0

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Radix dispatches `false` on Escape, overlay click, and programmatic
      // close. The store's `close` is idempotent (bail-out guard), so calling
      // it on already-closed state is a no-op.
      if (!open) close()
    },
    [close],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1, filtered.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1, filtered.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        // Explicit guard: pressing Enter with no matches is a no-op. We do
        // not close the palette either, so the user can refine the query.
        if (filtered.length === 0) return
        const target = filtered[effectiveSelectedIndex]
        if (!target) return
        invoke(target)
        return
      }
      if (event.key === 'Escape') {
        // Radix Dialog also handles Escape via onOpenChange. The explicit
        // close() call here keeps behaviour identical even when the focus
        // root differs from Radix's expected target.
        event.preventDefault()
        close()
      }
    },
    [moveSelection, filtered, effectiveSelectedIndex, invoke, close],
  )

  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value)
    },
    [setQuery],
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-xl gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <div className="border-b border-border px-4 py-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search skills…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search skills"
            aria-autocomplete="list"
            aria-controls="skills-palette-listbox"
            aria-activedescendant={
              filtered.length > 0 ? `skills-palette-option-${effectiveSelectedIndex}` : undefined
            }
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
        <div
          id="skills-palette-listbox"
          role="listbox"
          aria-label="Skills"
          className="max-h-[60vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No skills match.
              <br />
              <span className="text-xs">
                Install skills under <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">~/.claude/skills/</code>{' '}
                or <code className="rounded bg-muted/60 px-1 font-mono text-[11px]">.claude/skills/</code>.
              </span>
            </div>
          ) : (
            filtered.map((skill, idx) => (
              <div
                key={`${skill.source}:${skill.name}:${skill.filePath}`}
                id={`skills-palette-option-${idx}`}
              >
                <SkillCard
                  skill={skill}
                  isSelected={idx === effectiveSelectedIndex}
                  onClick={() => invoke(skill)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              </div>
            ))
          )}
        </div>
        <div className="flex gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ invoke</span>
          <span>esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
})
