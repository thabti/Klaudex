import { useState, useEffect, useCallback } from 'react'
import {
  IconStack2, IconCircleCheck, IconCircleX,
  IconExternalLink, IconFolderOpen,
  IconMessageChatbot, IconListCheck, IconTool, IconLock,
  IconLoader2, IconLogin, IconRefresh, IconArrowRight,
  IconUser, IconBrandGoogle, IconBrandGithub, IconBuilding,
  IconChevronRight,
} from '@tabler/icons-react'
import { ipc } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'

type Step = 'welcome' | 'cli' | 'auth'
type DetectState = 'detecting' | 'found' | 'not-found'
type AuthState = 'checking' | 'authenticated' | 'not-authenticated'

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [detectState, setDetectState] = useState<DetectState>('detecting')
  const [cliPath, setCliPath] = useState('')
  const [manualPath, setManualPath] = useState('')
  const [authState, setAuthState] = useState<AuthState>('not-authenticated')
  const [authEmail, setAuthEmail] = useState('')
  const [authAccountType, setAuthAccountType] = useState('')
  const [authRegion, setAuthRegion] = useState('')

  const bin = cliPath || manualPath || 'kiro-cli'

  const detect = useCallback(async () => {
    setDetectState('detecting')
    try {
      const path = await ipc.detectKiroCli()
      if (path) { setCliPath(path); setDetectState('found') }
      else { setDetectState('not-found') }
    } catch { setDetectState('not-found') }
  }, [])

  // Auto-detect on CLI step mount
  useEffect(() => {
    if (step === 'cli') detect()
  }, [step, detect])

  // Auto-check auth when entering auth step
  useEffect(() => {
    if (step !== 'auth') return
    checkAuth()
  }, [step])

  const checkAuth = useCallback(async () => {
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

  const finish = useCallback(async () => {
    const settings = useSettingsStore.getState().settings
    await useSettingsStore.getState().saveSettings({ ...settings, kiroBin: bin, hasOnboarded: true })
    useSettingsStore.getState().checkAuth()
    ipc.probeCapabilities().catch(() => {})
  }, [bin])

  const accountTypeLabel = (t: string) => {
    if (t === 'IamIdentityCenter') return 'IAM Identity Center'
    if (t === 'BuilderId') return 'Builder ID'
    return t
  }

  return (
    <div data-testid="onboarding-section" className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-background">
      <div className="fixed inset-x-0 top-0 h-10" data-tauri-drag-region />

      {/* Step indicator */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {(['welcome', 'cli', 'auth'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={cn('h-px w-6', step === s || (['cli', 'auth'].indexOf(step) > i - 1) ? 'bg-primary/40' : 'bg-border/30')} />}
            <div className={cn(
              'flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
              step === s ? 'bg-primary text-primary-foreground' : (['cli', 'auth'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground/60'),
            )}>
              {i + 1}
            </div>
          </div>
        ))}
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
                A native desktop client for Kiro — the AI-powered coding assistant.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-left text-[14px] text-muted-foreground/80">
              <Feature Icon={IconMessageChatbot} text="Chat with AI about your code" />
              <Feature Icon={IconListCheck} text="Plan mode for structured feature development" />
              <Feature Icon={IconTool} text="Agent executes file edits, terminal commands, and more" />
              <Feature Icon={IconLock} text="Runs locally — your code stays on your machine" />
            </div>
            <button
              type="button"
              onClick={() => setStep('cli')}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started <IconArrowRight size={18} />
            </button>
          </>
        )}

        {/* ── Step 2: CLI Detection ── */}
        {step === 'cli' && (
          <>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Connect to Kiro CLI</h2>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Kirodex needs kiro-cli to communicate with the AI agent.
              </p>
            </div>

            {/* Terminal card */}
            <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/5 bg-[#0d0d1a] shadow-2xl shadow-black/30">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500/60" />
                  <span className="size-2.5 rounded-full bg-yellow-500/60" />
                  <span className="size-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="flex-1 text-center text-[10px] font-medium text-white/15">terminal</span>
              </div>
              <div className="px-4 py-3 font-mono text-[12px] leading-relaxed">
                <span className="text-green-400/70">$ </span>
                <span className="text-white/50">which kiro-cli</span>
                <div className="mt-1">
                  {detectState === 'detecting' && (
                    <span className="inline-flex items-center gap-2 text-white/25">
                      <IconLoader2 size={10} className="animate-spin" /> searching…
                    </span>
                  )}
                  {detectState === 'found' && (
                    <>
                      <span className="text-white/35">{cliPath}</span>
                      <div className="mt-1 flex items-center gap-1.5 text-emerald-400/90">
                        <IconCircleCheck size={12} /> <span className="text-[11px]">kiro-cli found</span>
                      </div>
                    </>
                  )}
                  {detectState === 'not-found' && (
                    <span className="flex items-center gap-1.5 text-red-400/80">
                      <IconCircleX size={12} /> not found in PATH
                    </span>
                  )}
                </div>
              </div>
            </div>

            {detectState === 'not-found' && (
              <div className="flex w-full max-w-sm flex-col gap-3">
                <button type="button"
                  onClick={() => ipc.openUrl('https://kiro.dev/docs/cli/installation/')}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2.5 text-[13px] text-foreground/70 transition-colors hover:bg-muted/50"
                >
                  Install kiro-cli <IconExternalLink size={14} />
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
                  <div className="relative flex justify-center"><span className="bg-background px-2 text-[10px] text-muted-foreground/60">or set path manually</span></div>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="/path/to/kiro-cli"
                    className="flex-1 rounded-lg border border-border/60 bg-card/70 px-3 py-2 font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                  />
                  <button type="button" onClick={handleBrowse}
                    className="rounded-lg border border-border/60 px-2.5 py-2 text-muted-foreground transition-colors hover:text-foreground/70"
                  >
                    <IconFolderOpen size={16} />
                  </button>
                </div>
                <button type="button" onClick={detect}
                  className="text-[12px] text-primary/50 transition-colors hover:text-primary"
                >
                  Retry detection
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              {(detectState === 'found' || manualPath) && (
                <button
                  type="button"
                  onClick={() => setStep('auth')}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Continue <IconArrowRight size={18} />
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Step 3: Authentication ── */}
        {step === 'auth' && (
          <>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to Kiro</h2>
              <p className="mt-2 text-[14px] text-muted-foreground">
                Authenticate to access AI models and start coding.
              </p>
            </div>

            {/* Auth status card */}
            <div className="w-full max-w-sm">
              {authState === 'checking' && (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-8">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted/40">
                    <IconLoader2 size={24} className="animate-spin text-muted-foreground/60" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">Checking authentication…</p>
                </div>
              )}

              {authState === 'authenticated' && (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20">
                    <IconUser size={28} className="text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-foreground">{authEmail || 'Authenticated'}</p>
                    <div className="mt-1.5 flex items-center justify-center gap-2">
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                        {accountTypeLabel(authAccountType)}
                      </span>
                      {authRegion && (
                        <span className="text-[10px] text-muted-foreground/70">{authRegion}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-emerald-400/70">
                    <IconCircleCheck size={14} /> Ready to go
                  </div>
                </div>
              )}

              {authState === 'not-authenticated' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-6">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted/40">
                      <IconUser size={24} className="text-muted-foreground/60" />
                    </div>
                    <p className="text-[13px] text-muted-foreground">Not signed in</p>
                  </div>

                  {/* Login button */}
                  <button
                    type="button"
                    onClick={handleLogin}
                    className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <IconLogin size={18} /> Sign in with Kiro CLI
                  </button>

                  {/* Login methods info */}
                  <div className="flex items-center justify-center gap-4 py-1">
                    <LoginMethod Icon={IconBuilding} label="Builder ID" />
                    <LoginMethod Icon={IconBuilding} label="Identity Center" />
                    <LoginMethod Icon={IconBrandGoogle} label="Google" />
                    <LoginMethod Icon={IconBrandGithub} label="GitHub" />
                  </div>

                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                    This will open a terminal window to run <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">kiro-cli login</code>.
                    After signing in, click the button below.
                  </p>

                  <button
                    type="button"
                    onClick={checkAuth}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-[13px] text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground/80"
                  >
                    <IconRefresh size={14} /> I've signed in — check again
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {authState === 'authenticated' ? (
                <button
                  type="button"
                  onClick={finish}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-8 py-3 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Launch Kirodex <IconArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground/70"
                >
                  Skip for now <IconChevronRight size={14} className="inline" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Feature({ Icon, text }: { Icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={20} stroke={1.5} className="text-muted-foreground/70" />
      <span>{text}</span>
    </div>
  )
}

function LoginMethod({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
      <Icon size={12} /> {label}
    </div>
  )
}
