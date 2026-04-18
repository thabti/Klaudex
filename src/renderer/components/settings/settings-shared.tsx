import {
  IconUser, IconSettings2, IconPaint, IconKeyboard, IconTool, IconArchive,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

// ── Navigation ───────────────────────────────────────────────────

export type Section = 'account' | 'general' | 'appearance' | 'keymap' | 'advanced' | 'archives'

export const NAV: { id: Section; label: string; icon: typeof IconSettings2; description: string; sectionDescription: string; group?: string }[] = [
  { id: 'account', label: 'Account', icon: IconUser, description: 'Auth status, login', sectionDescription: 'Manage your authentication and account preferences.', group: 'account' },
  { id: 'general', label: 'General', icon: IconSettings2, description: 'CLI path, model, permissions', sectionDescription: 'Configure the CLI, default model, and permission behavior.', group: 'settings' },
  { id: 'appearance', label: 'Appearance', icon: IconPaint, description: 'Theme, font size', sectionDescription: 'Customize the look and feel of Klaudex.', group: 'settings' },
  { id: 'keymap', label: 'Keyboard', icon: IconKeyboard, description: 'Shortcuts reference', sectionDescription: 'View all available keyboard shortcuts.', group: 'settings' },
  { id: 'advanced', label: 'Advanced', icon: IconTool, description: 'Privacy, git integration, and data management.', sectionDescription: 'Privacy, git integration, and data management.', group: 'settings' },
  { id: 'archives', label: 'Archives', icon: IconArchive, description: 'Deleted threads', sectionDescription: 'Restore or permanently remove deleted threads.', group: 'data' },
]

// ── Search index ─────────────────────────────────────────────────

export interface SearchableItem {
  readonly label: string
  readonly description: string
  readonly section: Section
  readonly keywords: string
}

export const SEARCHABLE_SETTINGS: readonly SearchableItem[] = [
  { label: 'kiro-cli path', description: 'Path to the kiro-cli binary', section: 'general', keywords: 'cli binary connection detect' },
  { label: 'Default model', description: 'Choose the default AI model', section: 'general', keywords: 'model ai llm' },
  { label: 'Auto-approve', description: 'Skip permission prompts for tool calls', section: 'general', keywords: 'permissions approve tools' },
  { label: 'Respect .gitignore', description: 'Hide gitignored files from @ mentions', section: 'general', keywords: 'gitignore files mentions' },
  { label: 'Worktrees', description: 'Isolate each thread in its own git worktree', section: 'general', keywords: 'worktree git isolate thread' },
  { label: 'Tight sandbox', description: 'Restrict the agent to the project directory', section: 'general', keywords: 'sandbox restrict agent directory' },
  { label: 'Desktop notifications', description: 'Notify when the agent finishes or needs approval', section: 'general', keywords: 'notifications alert sound' },
  { label: 'Notification sound', description: 'Play a chime when a notification is sent', section: 'general', keywords: 'sound chime audio' },
  { label: 'Theme', description: 'Dark, light, or system theme', section: 'appearance', keywords: 'theme dark light mode' },
  { label: 'Font size', description: 'Adjust the editor font size', section: 'appearance', keywords: 'font size text' },
  { label: 'Sidebar position', description: 'Left or right sidebar placement', section: 'appearance', keywords: 'sidebar left right position layout' },
  { label: 'Keyboard shortcuts', description: 'View all available keyboard shortcuts', section: 'keymap', keywords: 'keyboard shortcuts hotkeys keybindings' },
  { label: 'Anonymous analytics', description: 'Share anonymous usage data', section: 'advanced', keywords: 'analytics privacy telemetry' },
  { label: 'Co-authored-by', description: 'Append Klaudex trailer to every commit', section: 'advanced', keywords: 'git commit co-author trailer' },
  { label: 'Task completion report', description: 'Summary card when a task finishes', section: 'advanced', keywords: 'report summary task completion' },
  { label: 'Max question length', description: 'Character limit for /btw and /tangent questions', section: 'advanced', keywords: 'btw tangent question limit characters' },
  { label: 'Clear history', description: 'Delete all conversation threads', section: 'advanced', keywords: 'clear history delete conversations data' },
  { label: 'Replay onboarding', description: 'Run the setup wizard again', section: 'advanced', keywords: 'onboarding wizard setup replay' },
  { label: 'Account', description: 'Authentication status and sign in', section: 'account', keywords: 'account login sign auth email' },
  { label: 'Deleted threads', description: 'Restore or permanently remove deleted threads', section: 'archives', keywords: 'deleted threads restore archive trash' },
] as const

// ── Reusable components ──────────────────────────────────────────

interface SettingRowProps {
  label: string
  description: string
  children: React.ReactNode
  className?: string
}

export const SettingRow = ({ label, description, children, className }: SettingRowProps) => (
  <div className={cn('flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/5 -mx-5 px-5 rounded-lg', className)}>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

export const SectionLabel = ({ title }: { title: string }) => (
  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
)

export const SectionHeader = ({ section }: { section: Section }) => {
  const nav = NAV.find((n) => n.id === section)
  if (!nav) return null
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <nav.icon className="size-5 text-primary" />
        <h3 className="text-[17px] font-semibold text-foreground">{nav.label}</h3>
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{nav.sectionDescription}</p>
    </div>
  )
}

export const SettingsCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    'rounded-xl border border-border/50 bg-card/70 px-5 py-1 shadow-sm transition-colors',
    className,
  )}>
    {children}
  </div>
)

export const Divider = () => <div className="border-t border-border/70" />
