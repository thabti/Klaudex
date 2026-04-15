import { useState, useEffect, useCallback } from 'react'
import {
  IconStack2, IconCircleCheck, IconCircleX,
  IconExternalLink, IconFolderOpen,
  IconMessageChatbot, IconListCheck, IconTool, IconLock,
  IconLoader2, IconLogin, IconRefresh, IconArrowRight,
  IconUser, IconBrandGoogle, IconBrandGithub, IconBuilding,
  IconCopy, IconCheck, IconChevronDown, IconChevronUp,
  IconBrandApple, IconTerminal, IconPaint, IconShieldCheck,
} from '@tabler/icons-react'
import { Switch } from '@/components/ui/switch'
import { ipc } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/types'
import { applyTheme, persistTheme } from '@/lib/theme'
import ThemeSelector from '@/components/settings/ThemeSelector'

type Step = 'welcome' | 'theme' | 'setup'
type DetectState = 'detecting' | 'found' | 'not-found'
type AuthState = 'checking' | 'authenticated' | 'not-authenticated'
type Platform = 'macos' | 'linux' | 'windows'

const FEATURES = [
  { Icon: IconMessageChatbot, text: 'Chat with AI about your code' },
  { Icon: IconListCheck, text: 'Plan mode for structured feature development' },
  { Icon: IconTool, text: 'Agent executes file edits, terminal commands, and more' },
  { Icon: IconLock, text: 'Runs locally — your code stays on your machine' },
] as const

interface InstallCommand {
  readonly label: string
  readonly command: string
}

const INSTALL_COMMANDS: Record<Platform, { primary: InstallCommand; alternatives: InstallCommand[] }> = {
  macos: {
    primary: { label: 'Homebrew', command: 'brew install kiro-cli' },
    alternatives: [
      { label: 'curl', command: 'curl -fsSL https://kiro.dev/install.sh | sh' },
      { label: 'Manual', command: 'Download from https://kiro.dev/docs/cli/installation/' },
    ],
  },
  linux: {
    primary: { label: 'curl', command: 'curl -fsSL https://kiro.dev/install.sh | sh' },
    alternatives: [
      { label: 'apt', command: 'sudo apt install kiro-cli' },
      { label: 'Manual', command: 'Download from https://kiro.dev/docs/cli/installation/' },
    ],
  },
  windows: {
    primary: { label: 'PowerShell', command: 'irm https://kiro.dev/install.ps1 | iex' },
    alternatives: [
      { label: 'Manual', command: 'Download from https://kiro.dev/docs/cli/installation/' },
    ],
  },
}

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}

const PLATFORM_LABELS: Record<Platform, string> = {
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
}

/** Small copy-to-clipboard button with checkmark feedback */
const CopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch { /* clipboard may not be available */ }
  }, [text])
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      tabIndex={0}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
    >
      {isCopied ? <IconCheck size={14} className="text-emerald-600 dark:text-emerald-400" /> : <IconCopy size={14} />}
    </button>
  )
}

/** Single install command row */
const CommandRow = ({ cmd }: { cmd: InstallCommand }) => (
  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-16">{cmd.label}</span>
    <code className="flex-1 truncate font-mono text-[12px] text-muted-foreground">{cmd.command}</code>
    <CopyButton text={cmd.command} />
  </div>
)

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [themeChoice, setThemeChoice] = useState<ThemeMode>(
    useSettingsStore.getState().settings.theme ?? 'dark',
  )
  const [detectState, setDetectState] = useState<DetectState>('detecting')
  const [cliPath, setCliPath] = useState('')
  const [manualPath, setManualPath] = useState('')
  const [authState, setAuthState] = useState<AuthState>('not-authenticated')
  const [authEmail, setAuthEmail] = useState('')
  const [authAccountType, setAuthAccountType] = useState('')
  const [authRegion, setAuthRegion] = useState('')
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [isAnalyticsEnabled, setIsAnalyticsEnabled] = useState(true)
  const platform = useState(detectPlatform)[0]
  const bin = cliPath || manualPath || 'kiro-cli'
  const isCliReady = detectState === 'found' || manualPath.length > 0

  const detect = useCallback(async () => {
    setDetectState('detecting')
    try {
      const path = await ipc.detectKiroCli()
      if (path) { setCliPath(path); setDetectState('found') }
      else { setDetectState('not-found') }
    } catch { setDetectState('not-found') }
  }, [])

  // Auto-detect CLI when entering setup step
  useEffect(() => {
    if (step === 'setup') detect()
  }, [step, detect])

  // Auto-check auth once CLI is ready
  useEffect(() => {
    if (step === 'setup' && isCliReady) checkAuth()
  }, [step, isCliReady])

  const checkAuth = useCallback(async () => {
    setAuthState('checking')
    try {
      const identity = await ipc.kiroWhoami(bin)
      if (identity.accountType) {
        setAuthEmail(identity.email ?? '')
        setAuthAccountType(identity.accountType)
        setAuthRegion(identity.region ?? '')
        setAuthState('authenticated')
      } else {
        setAuthState('not-authenticated')
      }
    } catch {
      setAuthState('not-authenticated')
    }
  }, [bin])

  const handleLogin = useCallback(() => {
    ipc.openTerminalWithCommand(`${bin} login`).catch(() => {})
  }, [bin])

  const handleBrowse = useCallback(async () => {
    const picked = await ipc.pickFolder()
    if (picked) setManualPath(picked)
  }, [])

  const handleThemeChange = useCallback((mode: ThemeMode) => {
    setThemeChoice(mode)
    applyTheme(mode)
    persistTheme(mode)
  }, [])

  const finish = useCallback(async () => {
    const settings = useSettingsStore.getState().settings
    await useSettingsStore.getState().saveSettings({ ...settings, kiroBin: bin, hasOnboardedV2: true, theme: themeChoice, analyticsEnabled: isAnalyticsEnabled })
    useSettingsStore.getState().checkAuth()
    ipc.probeCapabilities().catch(() => {})
  }, [bin, themeChoice, isAnalyticsEnabled])

  const accountTypeLabel = (t: string): string => {
    if (t === 'IamIdentityCenter') return 'IAM Identity Center'
    if (t === 'BuilderId') return 'Builder ID'
    return t
  }

  const installCommands = INSTALL_COMMANDS[platform]

  return (
    <div data-testid="onboarding-section" className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-background">
      <div className="fixed inset-x-0 top-0 h-10" data-tauri-drag-region />

      {/* Step indicator: 3 dots */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {(['welcome', 'theme', 'setup'] as const).map((s, i) => {
          const steps: Step[] = ['welcome', 'theme', 'setup']
          const currentIdx = steps.indexOf(step)
          const isPast = i < currentIdx
          const isCurrent = step === s
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-8', isPast || isCurrent ? 'bg-primary/40' : 'bg-border')} />}
              <div className={cn(
                'flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isPast
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted/50 text-muted-foreground',
              )}>
                {i + 1}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-8 py-12 text-center max-w-lg w-full px-6">

        {/* ── Step 1: Welcome ── */}
        {step === 'welcome' && (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
              <IconStack2 size={40} stroke={1.5} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome to Kirodex</h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                A native desktop client for Kiro; the AI-powered coding assistant.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-left text-[14px] text-muted-foreground">
              {FEATURES.map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon size={20} stroke={1.5} className="text-muted-foreground" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep('theme')}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started <IconArrowRight size={18} />
            </button>
          </>
        )}

        {/* ── Step 2: Theme ── */}
        {step === 'theme' && (
          <div className="flex w-full max-w-md flex-col items-center gap-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <IconPaint size={32} stroke={1.5} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Choose your theme</h2>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Pick a look that suits you. You can change this later in Settings.
              </p>
            </div>
            <div className="w-full">
              <ThemeSelector value={themeChoice} onChange={handleThemeChange} />
            </div>
            <button
              type="button"
              onClick={() => setStep('setup')}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue <IconArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── Step 3: Setup (CLI + Auth combined) ── */}
        {step === 'setup' && (
          <div className="flex w-full max-w-md flex-col gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Set up Kirodex</h2>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Connect to kiro-cli and sign in to get started.
              </p>
            </div>

            {/* ── CLI Section ── */}
            <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <div className={cn(
                  'flex size-7 items-center justify-center rounded-full transition-colors',
                  isCliReady ? 'bg-emerald-500/10' : 'bg-muted/40',
                )}>
                  {detectState === 'detecting' ? (
                    <IconLoader2 size={14} className="animate-spin text-muted-foreground" />
                  ) : isCliReady ? (
                    <IconCircleCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <IconTerminal size={14} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-medium text-foreground/90">Kiro CLI</p>
                  <p className="text-[11px] text-muted-foreground">
                    {detectState === 'detecting' && 'Searching for kiro-cli...'}
                    {detectState === 'found' && cliPath}
                    {detectState === 'not-found' && !manualPath && 'Not found — install or set path below'}
                    {detectState === 'not-found' && manualPath && manualPath}
                  </p>
                </div>
                {detectState !== 'detecting' && (
                  <button
                    type="button"
                    onClick={detect}
                    aria-label="Retry CLI detection"
                    tabIndex={0}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground/70"
                  >
                    <IconRefresh size={14} />
                  </button>
                )}
              </div>

              {detectState === 'not-found' && !manualPath && (
                <div className="flex flex-col gap-3 px-5 py-4">
                  {/* Platform badge */}
                  <div className="flex items-center gap-2">
                    {platform === 'macos' && <IconBrandApple size={14} className="text-muted-foreground" />}
                    {platform === 'linux' && <IconTerminal size={14} className="text-muted-foreground" />}
                    {platform === 'windows' && <IconTerminal size={14} className="text-muted-foreground" />}
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Install for {PLATFORM_LABELS[platform]}
                    </span>
                  </div>

                  {/* Primary install command */}
                  <CommandRow cmd={installCommands.primary} />

                  {/* Alternative methods (collapsible) */}
                  {installCommands.alternatives.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAlternatives((v) => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-muted-foreground"
                      >
                        {showAlternatives ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                        Other install methods
                      </button>
                      {showAlternatives && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {installCommands.alternatives.map((cmd) => (
                            <CommandRow key={cmd.label} cmd={cmd} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider + manual path */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-2 text-[10px] text-muted-foreground">or set path manually</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={manualPath}
                      onChange={(e) => setManualPath(e.target.value)}
                      placeholder="/path/to/kiro-cli"
                      className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                    <button
                      type="button"
                      onClick={handleBrowse}
                      aria-label="Browse for kiro-cli"
                      tabIndex={0}
                      className="rounded-lg border border-border px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground/70"
                    >
                      <IconFolderOpen size={16} />
                    </button>
                  </div>

                  <a
                    href="https://kiro.dev/docs/cli/installation/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-[12px] text-primary transition-colors hover:text-primary"
                  >
                    Full installation guide <IconExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* ── Auth Section ── */}
            <div className={cn(
              'w-full rounded-xl border overflow-hidden transition-colors',
              !isCliReady ? 'border-border bg-card opacity-50 pointer-events-none' : 'border-border bg-card',
            )}>
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <div className={cn(
                  'flex size-7 items-center justify-center rounded-full transition-colors',
                  authState === 'authenticated' ? 'bg-emerald-500/10' : 'bg-muted/40',
                )}>
                  {authState === 'checking' ? (
                    <IconLoader2 size={14} className="animate-spin text-muted-foreground" />
                  ) : authState === 'authenticated' ? (
                    <IconCircleCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <IconUser size={14} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-medium text-foreground/90">Authentication</p>
                  <p className="text-[11px] text-muted-foreground">
                    {authState === 'checking' && 'Checking...'}
                    {authState === 'authenticated' && (authEmail || 'Signed in')}
                    {authState === 'not-authenticated' && 'Sign in to access AI models'}
                  </p>
                </div>
                {authState === 'authenticated' && authAccountType && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {accountTypeLabel(authAccountType)}
                  </span>
                )}
              </div>

              {authState === 'not-authenticated' && isCliReady && (
                <div className="flex flex-col gap-3 px-5 py-4">
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <IconLogin size={16} /> Sign in with Kiro CLI
                  </button>

                  <div className="flex items-center justify-center gap-4 py-0.5">
                    <LoginMethod Icon={IconBuilding} label="Builder ID" />
                    <LoginMethod Icon={IconBuilding} label="Identity Center" />
                    <LoginMethod Icon={IconBrandGoogle} label="Google" />
                    <LoginMethod Icon={IconBrandGithub} label="GitHub" />
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Opens a terminal to run <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">kiro-cli login</code>.
                    Come back and click below when done.
                  </p>

                  <button
                    type="button"
                    onClick={checkAuth}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[12px] text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground/80"
                  >
                    <IconRefresh size={14} /> I've signed in — check again
                  </button>
                </div>
              )}

              {authState === 'authenticated' && authRegion && (
                <div className="px-5 py-2.5 text-left">
                  <span className="text-[11px] text-muted-foreground">Region: {authRegion}</span>
                </div>
              )}
            </div>

            {/* ── Privacy ── */}
            <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="flex size-7 items-center justify-center rounded-full bg-muted/40">
                  <IconShieldCheck size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-medium text-foreground/90">Share anonymous usage data</p>
                  <p className="text-[11px] text-muted-foreground">
                    Feature usage and app version only. No prompts, code, file paths, branch names, or commit messages are ever sent.
                  </p>
                </div>
                <Switch
                  checked={isAnalyticsEnabled}
                  onCheckedChange={setIsAnalyticsEnabled}
                  aria-label="Toggle anonymous usage data"
                />
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex flex-col items-center gap-2 pt-2">
              {authState === 'authenticated' && isCliReady ? (
                <button
                  type="button"
                  onClick={finish}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Launch Kirodex <IconArrowRight size={18} />
                </button>
              ) : isCliReady ? (
                <button
                  type="button"
                  onClick={finish}
                  className="text-[13px] text-muted-foreground transition-colors hover:text-foreground/70"
                >
                  Skip sign-in for now
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LoginMethod({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Icon size={12} /> {label}
    </div>
  )
}
