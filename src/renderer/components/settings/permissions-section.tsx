import { useCallback, useMemo, useState } from 'react'
import {
  IconShieldCheck, IconShieldExclamation, IconShieldOff, IconShield,
  IconBan, IconCheck, IconPlus, IconX, IconChevronDown, IconDownload,
  IconAlertTriangle,
} from '@tabler/icons-react'
import type { AppSettings } from '@/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SectionLabel, SettingsCard, Divider } from './settings-shared'

/* ── Types ──
 * Mirrors Rust `Permissions` / `PermissionMode` from
 * `src-tauri/src/commands/settings.rs` (camelCase serde). Extended on
 * `AppSettings` locally because `src/renderer/types/index.ts` is owned by
 * a parallel agent — same approach memory-section.tsx uses for its
 * terminal fields (TASK-024). Rust persistence handles the round-trip. */

export type PermissionMode = 'ask' | 'allowListed' | 'bypass'

export interface Permissions {
  readonly mode: PermissionMode
  readonly allow: readonly string[]
  readonly deny: readonly string[]
}

type PermissionsPatch = Partial<{ permissions: Permissions }>
type AppSettingsWithPermissions = AppSettings & { permissions?: Permissions }

const DEFAULT_PERMISSIONS: Permissions = { mode: 'ask', allow: [], deny: [] }

const TOOL_OPTIONS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task',
] as const
type Tool = (typeof TOOL_OPTIONS)[number]

const PATTERN_HINT_BY_TOOL: Record<Tool, string> = {
  Bash: 'npm test:*',
  Read: './src/**',
  Write: './src/**',
  Edit: './src/**',
  Glob: '**/*.ts',
  Grep: 'TODO',
  WebFetch: 'https://example.com/*',
  WebSearch: '*',
  Task: '*',
}

/* ── Mode metadata ─────────────────────────────────────────────────*/

interface ModeOption {
  readonly id: PermissionMode
  readonly title: string
  readonly subtitle: string
  readonly icon: typeof IconShield
  readonly iconClass: string
}

const MODE_OPTIONS: readonly ModeOption[] = [
  {
    id: 'ask',
    title: 'Always ask',
    subtitle: 'Show a permission prompt for every tool call. Safest default.',
    icon: IconShield,
    iconClass: 'text-sky-500 dark:text-sky-400',
  },
  {
    id: 'allowListed',
    title: 'Allow listed only',
    subtitle: 'Auto-approve when an allow rule matches; ask for everything else.',
    icon: IconShieldCheck,
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  {
    id: 'bypass',
    title: 'Bypass',
    subtitle: 'Auto-approve every tool call. Use only when you trust the agent fully.',
    icon: IconShieldOff,
    iconClass: 'text-red-500 dark:text-red-400',
  },
]

/* ── Helpers ───────────────────────────────────────────────────────*/

/** Best-effort parse of a `Tool(args)` rule for icon/label rendering. */
const parseRule = (rule: string): { tool: string; args: string } | null => {
  const match = /^([A-Za-z]+)\(([\s\S]*)\)$/u.exec(rule.trim())
  if (!match) return null
  return { tool: match[1] ?? '', args: match[2] ?? '' }
}

/* ── Inline rule editor ────────────────────────────────────────────*/

interface RuleEditorProps {
  readonly placeholder: string
  readonly onAdd: (rule: string) => void
  readonly onCancel: () => void
}

const RuleEditor = ({ placeholder, onAdd, onCancel }: RuleEditorProps) => {
  const [tool, setTool] = useState<Tool>('Bash')
  const [args, setArgs] = useState('')
  const trimmed = args.trim()
  const canSubmit = trimmed.length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onAdd(`${tool}(${trimmed})`)
    setArgs('')
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/40 p-2">
      <div className="relative">
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value as Tool)}
          className={cn(
            'h-8 appearance-none rounded-lg border border-input bg-background/50 pl-2.5 pr-7 text-[12px] font-medium',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
          aria-label="Permission tool"
        >
          {TOOL_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <IconChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70" />
      </div>
      <input
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        placeholder={placeholder || PATTERN_HINT_BY_TOOL[tool]}
        className={cn(
          'h-8 flex-1 min-w-[10rem] rounded-lg border border-input bg-background/50 px-2.5 font-mono text-[12px]',
          'placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
        aria-label="Permission pattern"
        autoFocus
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors',
          'hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <IconCheck className="size-3" />
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-border/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  )
}

/* ── Pattern row ───────────────────────────────────────────────────*/

interface PatternRowProps {
  readonly rule: string
  readonly variant: 'allow' | 'deny'
  readonly onRemove: () => void
}

const PatternRow = ({ rule, variant, onRemove }: PatternRowProps) => {
  const parsed = parseRule(rule)
  const isDeny = variant === 'deny'
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors',
        isDeny
          ? 'border-red-500/25 bg-red-500/5 hover:bg-red-500/10'
          : 'border-border/40 bg-background/40 hover:bg-accent/30',
      )}
    >
      {isDeny
        ? <IconBan className="size-3.5 shrink-0 text-red-500/80 dark:text-red-400/80" />
        : <IconCheck className="size-3.5 shrink-0 text-emerald-500/80 dark:text-emerald-400/80" />
      }
      {parsed ? (
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="text-[11.5px] font-semibold text-foreground/80">{parsed.tool}</span>
          <span className="truncate font-mono text-[11.5px] text-muted-foreground">({parsed.args})</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/80">{rule}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${variant} rule ${rule}`}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors',
          'opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground focus:opacity-100',
        )}
      >
        <IconX className="size-3" />
      </button>
    </div>
  )
}

/* ── Mode radio ────────────────────────────────────────────────────*/

interface ModeRadioProps {
  readonly option: ModeOption
  readonly selected: boolean
  readonly onSelect: () => void
}

const ModeRadio = ({ option, selected, onSelect }: ModeRadioProps) => {
  const Icon = option.icon
  const isBypass = option.id === 'bypass'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
        selected
          ? isBypass
            ? 'border-red-500/50 bg-red-500/5 shadow-sm'
            : 'border-primary/50 bg-primary/5 shadow-sm'
          : 'border-border/40 hover:border-border/70 hover:bg-accent/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? isBypass ? 'border-red-500 bg-red-500' : 'border-primary bg-primary'
            : 'border-border',
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-background" />}
      </span>
      <Icon className={cn('mt-0.5 size-4 shrink-0', option.iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{option.title}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{option.subtitle}</p>
      </div>
    </button>
  )
}

/* ── Main section ──────────────────────────────────────────────────*/

interface PermissionsSectionProps {
  readonly settings: AppSettings
  readonly updateDraft: (patch: Partial<AppSettings>) => void
}

export const PermissionsSection = ({ settings, updateDraft }: PermissionsSectionProps) => {
  const draftWithPerms = settings as AppSettingsWithPermissions
  const updatePerms = updateDraft as (patch: PermissionsPatch) => void

  const permissions = useMemo<Permissions>(
    () => draftWithPerms.permissions ?? DEFAULT_PERMISSIONS,
    [draftWithPerms.permissions],
  )

  const [allowEditorOpen, setAllowEditorOpen] = useState(false)
  const [denyEditorOpen, setDenyEditorOpen] = useState(false)

  const writePerms = useCallback((next: Permissions) => {
    updatePerms({ permissions: next })
  }, [updatePerms])

  const handleModeChange = useCallback((mode: PermissionMode) => {
    if (mode === permissions.mode) return
    writePerms({ ...permissions, mode })
  }, [permissions, writePerms])

  const handleAddAllow = useCallback((rule: string) => {
    if (permissions.allow.includes(rule)) { setAllowEditorOpen(false); return }
    writePerms({ ...permissions, allow: [...permissions.allow, rule] })
    setAllowEditorOpen(false)
  }, [permissions, writePerms])

  const handleRemoveAllow = useCallback((rule: string) => {
    writePerms({ ...permissions, allow: permissions.allow.filter((r) => r !== rule) })
  }, [permissions, writePerms])

  const handleAddDeny = useCallback((rule: string) => {
    if (permissions.deny.includes(rule)) { setDenyEditorOpen(false); return }
    writePerms({ ...permissions, deny: [...permissions.deny, rule] })
    setDenyEditorOpen(false)
  }, [permissions, writePerms])

  const handleRemoveDeny = useCallback((rule: string) => {
    writePerms({ ...permissions, deny: permissions.deny.filter((r) => r !== rule) })
  }, [permissions, writePerms])

  const isBypass = permissions.mode === 'bypass'
  const isAllowListed = permissions.mode === 'allowListed'
  const allowEmpty = permissions.allow.length === 0
  const denyEmpty = permissions.deny.length === 0

  return (
    <>
      {/* Section header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <IconShield className="size-5 text-primary" />
          <h3 className="text-[17px] font-semibold text-foreground">Permissions</h3>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Control how Klaudex handles tool-call approval. Allow rules auto-approve matching calls; deny rules always block.
        </p>
      </div>

      {/* Bypass safety banner — mirrors the future header chip styling so the
       * visual language stays consistent with TASK-107. */}
      {isBypass && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3"
        >
          <IconShieldExclamation className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-red-500 dark:text-red-300">
              Bypassing permissions
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-red-400/80 dark:text-red-200/70">
              Anything the agent runs is auto-approved — including writes, deletes, and shell commands. Switch back to
              <span className="font-semibold"> Always ask</span> when you finish a high-trust session.
            </p>
          </div>
        </div>
      )}

      {/* ── Mode ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionLabel title="Mode" />
        <div role="radiogroup" aria-label="Permission mode" className="flex flex-col gap-2">
          {MODE_OPTIONS.map((opt) => (
            <ModeRadio
              key={opt.id}
              option={opt}
              selected={permissions.mode === opt.id}
              onSelect={() => handleModeChange(opt.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Allow list ───────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionLabel title="Allow list" />
        <SettingsCard className="!py-4">
          <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Patterns that auto-approve matching tool calls.
            {isAllowListed
              ? ' Required for the current Allow listed mode — empty means everything still asks.'
              : ' Used by Allow listed mode and as a hint for Always ask.'}
          </p>
          {allowEmpty && !allowEditorOpen ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 px-3 py-2.5">
              <IconShieldCheck className="size-4 text-muted-foreground/50" />
              <p className="flex-1 text-[11.5px] text-muted-foreground">No allow rules.</p>
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
              {permissions.allow.map((rule) => (
                <PatternRow
                  key={rule}
                  rule={rule}
                  variant="allow"
                  onRemove={() => handleRemoveAllow(rule)}
                />
              ))}
            </div>
          )}
          {allowEditorOpen ? (
            <RuleEditor
              placeholder="e.g. npm test:*"
              onAdd={handleAddAllow}
              onCancel={() => setAllowEditorOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAllowEditorOpen(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconPlus className="size-3" />
              Add rule
            </button>
          )}
        </SettingsCard>
      </div>

      {/* ── Deny list ────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionLabel title="Deny list" />
        <SettingsCard className="!py-4">
          <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Patterns that are always blocked, even in Bypass mode.
          </p>
          {denyEmpty && !denyEditorOpen ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/40 px-3 py-2.5">
              <IconBan className="size-4 text-muted-foreground/50" />
              <p className="flex-1 text-[11.5px] text-muted-foreground">No deny rules.</p>
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
              {permissions.deny.map((rule) => (
                <PatternRow
                  key={rule}
                  rule={rule}
                  variant="deny"
                  onRemove={() => handleRemoveDeny(rule)}
                />
              ))}
            </div>
          )}
          {denyEditorOpen ? (
            <RuleEditor
              placeholder="e.g. rm:*"
              onAdd={handleAddDeny}
              onCancel={() => setDenyEditorOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setDenyEditorOpen(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconPlus className="size-3" />
              Add rule
            </button>
          )}
        </SettingsCard>
      </div>

      {/* ── Failure-case sanity for the empty + Bypass combo ─────── */}
      {isBypass && allowEmpty && denyEmpty && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-300">
            No rules configured. Every tool call will be auto-approved with no fallback safeguards.
          </p>
        </div>
      )}

      {/* ── Import (placeholder for TASK-116) ────────────────────── */}
      <div className="mb-2">
        <SectionLabel title="Import" />
        <SettingsCard>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">Import from Claude CLI</p>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Pull existing allow / deny rules from your Claude CLI settings file.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-[11px] font-medium text-muted-foreground opacity-60"
                  >
                    <IconDownload className="size-3" />
                    Import
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                Will import from ~/.claude/settings.json (TASK-116)
              </TooltipContent>
            </Tooltip>
          </div>
        </SettingsCard>
      </div>

      <Divider />
      <p className="mt-4 text-[10.5px] leading-relaxed text-muted-foreground/60">
        Rule format: <span className="font-mono">Tool(args)</span> — e.g. <span className="font-mono">Bash(npm test:*)</span>,
        {' '}<span className="font-mono">Read(./src/**)</span>, <span className="font-mono">WebFetch(https://api.example.com/*)</span>.
        Patterns matching is performed by the Rust backend.
      </p>
    </>
  )
}
