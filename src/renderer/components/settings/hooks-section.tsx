import { useMemo } from 'react'
import {
  IconBolt, IconShieldCheck, IconArrowRight, IconArrowDown, IconArrowUp,
  IconHandStop, IconLogin, IconChevronRight,
} from '@tabler/icons-react'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import type { ClaudeConfig } from '@/types'
import { cn } from '@/lib/utils'
import { SettingsCard } from './settings-shared'

/* ── Types ──────────────────────────────────────────────────────────
 * Mirrors the Rust `ClaudeHook` struct from
 * `src-tauri/src/commands/claude_config.rs` (camelCase serde). The
 * shared `ClaudeConfig` type in `@/types` is owned by parallel agents
 * and doesn't yet declare the `hooks` field, so we widen the store
 * shape locally — same approach permissions-section.tsx and
 * memory-section.tsx use for their respective fields. */

type HookSource = 'global' | 'project'

interface ClaudeHook {
  readonly event: string
  readonly matcher?: string
  readonly command: string
  readonly source: HookSource | string
}

type ClaudeConfigWithHooks = ClaudeConfig & { hooks?: readonly ClaudeHook[] }

/* ── Event metadata ────────────────────────────────────────────────*/

interface EventMeta {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly icon: typeof IconBolt
  readonly accentClass: string
}

/** Canonical event order. Unknown events fall to the end via `OTHER_META`. */
const EVENT_ORDER: readonly string[] = [
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'Stop',
]

const EVENT_META: Record<string, EventMeta> = {
  SessionStart: {
    id: 'SessionStart',
    title: 'SessionStart',
    subtitle: 'Runs when a Claude session starts.',
    icon: IconLogin,
    accentClass: 'text-sky-500 dark:text-sky-400',
  },
  PreToolUse: {
    id: 'PreToolUse',
    title: 'PreToolUse',
    subtitle: 'Runs before a tool call is executed.',
    icon: IconArrowUp,
    accentClass: 'text-amber-500 dark:text-amber-400',
  },
  PostToolUse: {
    id: 'PostToolUse',
    title: 'PostToolUse',
    subtitle: 'Runs after a tool call completes.',
    icon: IconArrowDown,
    accentClass: 'text-emerald-500 dark:text-emerald-400',
  },
  Stop: {
    id: 'Stop',
    title: 'Stop',
    subtitle: 'Runs when the session is stopped.',
    icon: IconHandStop,
    accentClass: 'text-red-500 dark:text-red-400',
  },
}

const otherMeta = (eventId: string): EventMeta => ({
  id: eventId,
  title: eventId,
  subtitle: 'Custom hook event.',
  icon: IconChevronRight,
  accentClass: 'text-muted-foreground',
})

/* ── Helpers ───────────────────────────────────────────────────────*/

interface HookGroup {
  readonly meta: EventMeta
  readonly hooks: readonly ClaudeHook[]
}

const groupByEvent = (hooks: readonly ClaudeHook[]): readonly HookGroup[] => {
  const buckets = new Map<string, ClaudeHook[]>()
  for (const h of hooks) {
    const existing = buckets.get(h.event)
    if (existing) existing.push(h)
    else buckets.set(h.event, [h])
  }
  // Order: canonical events first (in EVENT_ORDER), then alphabetical for the rest.
  const known = EVENT_ORDER.filter((id) => buckets.has(id))
  const rest = [...buckets.keys()]
    .filter((id) => !EVENT_ORDER.includes(id))
    .sort((a, b) => a.localeCompare(b))
  const ordered = [...known, ...rest]
  return ordered.map((event) => ({
    meta: EVENT_META[event] ?? otherMeta(event),
    hooks: buckets.get(event) ?? [],
  }))
}

/* ── Scope badge ───────────────────────────────────────────────────*/

const ScopeBadge = ({ source }: { source: ClaudeHook['source'] }) => {
  const isProject = source === 'project'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide',
        isProject
          ? 'bg-primary/15 text-primary'
          : 'bg-muted/60 text-muted-foreground',
      )}
      title={isProject ? 'Defined in <workspace>/.claude/settings.json' : 'Defined in ~/.claude/settings.json'}
    >
      {String(source)}
    </span>
  )
}

/* ── Hook row ──────────────────────────────────────────────────────*/

const HookRow = ({ hook }: { hook: ClaudeHook }) => {
  const matcher = hook.matcher && hook.matcher.length > 0 ? hook.matcher : null
  const command = hook.command && hook.command.length > 0 ? hook.command : null

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2 transition-colors hover:bg-accent/20">
      <span
        className={cn(
          'min-w-0 max-w-[12rem] shrink-0 truncate rounded-md border px-2 py-0.5 font-mono text-[11px]',
          matcher
            ? 'border-border/50 bg-muted/40 text-foreground/85'
            : 'border-dashed border-border/40 bg-transparent text-muted-foreground/70',
        )}
        title={matcher ?? '(no matcher)'}
      >
        {matcher ?? '(no matcher)'}
      </span>
      <IconArrowRight className="size-3 shrink-0 text-muted-foreground/50" aria-hidden />
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-mono text-[11.5px]',
          command ? 'text-foreground/85' : 'italic text-muted-foreground/70',
        )}
        title={command ?? '<empty>'}
      >
        {command ?? '<empty>'}
      </span>
      <ScopeBadge source={hook.source} />
    </div>
  )
}

/* ── Event group ───────────────────────────────────────────────────*/

const EventGroup = ({ group }: { group: HookGroup }) => {
  const { meta, hooks } = group
  const Icon = meta.icon
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('size-3.5 shrink-0', meta.accentClass)} aria-hidden />
        <p className="text-[12px] font-semibold text-foreground">{meta.title}</p>
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {hooks.length}
        </span>
        <p className="ml-1 truncate text-[11px] text-muted-foreground/70">{meta.subtitle}</p>
      </div>
      <SettingsCard className="!py-2">
        <div className="flex flex-col gap-1.5 py-1">
          {hooks.map((h, idx) => (
            <HookRow key={`${meta.id}-${idx}-${h.matcher ?? ''}-${h.command}`} hook={h} />
          ))}
        </div>
      </SettingsCard>
    </div>
  )
}

/* ── Main section ──────────────────────────────────────────────────*/

// Stable empty fallback — returning `[]` literally inline causes Zustand to
// see a new reference every selector call → infinite re-render loop.
const EMPTY_HOOKS: readonly ClaudeHook[] = []

export const HooksSection = () => {
  // Subscribe to the hooks slice only — auto-refreshes when the
  // claude_watcher (wave-1) re-loads `~/.claude/settings.json` or the
  // project settings file.
  const hooks = useClaudeConfigStore((s) => {
    const cfg = s.config as ClaudeConfigWithHooks
    return cfg.hooks ?? EMPTY_HOOKS
  })

  const groups = useMemo(() => groupByEvent(hooks), [hooks])
  const isEmpty = hooks.length === 0

  return (
    <>
      {/* Section header — mirrors permissions-section.tsx layout. */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <IconBolt className="size-5 text-primary" />
          <h3 className="text-[17px] font-semibold text-foreground">Hooks</h3>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Hooks are executed by the Claude CLI, not Klaudex. Edit{' '}
          <span className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px] text-foreground/80">
            ~/.claude/settings.json
          </span>{' '}
          or{' '}
          <span className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px] text-foreground/80">
            &lt;workspace&gt;/.claude/settings.json
          </span>{' '}
          to change them.
        </p>
      </div>

      {isEmpty ? (
        <SettingsCard>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <IconShieldCheck className="size-5 text-muted-foreground/40" aria-hidden />
            <p className="text-[12.5px] text-muted-foreground">No hooks defined.</p>
            <p className="text-[11px] text-muted-foreground/60">
              Hooks live under the <span className="font-mono">hooks</span> key in{' '}
              <span className="font-mono">settings.json</span>.
            </p>
          </div>
        </SettingsCard>
      ) : (
        <>
          {groups.map((g) => (
            <EventGroup key={g.meta.id} group={g} />
          ))}
        </>
      )}

      <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground/60">
        Read-only viewer. Klaudex never executes hooks itself — the Claude CLI runs them as part
        of its own session lifecycle.
      </p>
    </>
  )
}

export default HooksSection
