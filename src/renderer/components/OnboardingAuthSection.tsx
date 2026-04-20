import { useState, useCallback, useEffect } from 'react'
import {
  IconCircleCheck, IconLoader2, IconLogin,
  IconUser,
} from '@tabler/icons-react'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { type AuthState } from '@/components/onboarding-shared'

interface OnboardingAuthSectionProps {
  bin: string
  isCliReady: boolean
  onAuthChange: (isAuthenticated: boolean) => void
}

export const OnboardingAuthSection = ({ bin, isCliReady, onAuthChange }: OnboardingAuthSectionProps) => {
  const [authState, setAuthState] = useState<AuthState>('not-authenticated')
  const [authEmail, setAuthEmail] = useState('')
  const [authMethod, setAuthMethod] = useState('')
  const [subscriptionType, setSubscriptionType] = useState('')

  const checkAuth = useCallback(async () => {
    setAuthState('checking')
    try {
      const result = await ipc.claudeWhoami(bin)
      if (result.loggedIn) {
        setAuthEmail(result.email ?? '')
        setAuthMethod(result.authMethod ?? '')
        setSubscriptionType(result.subscriptionType ?? '')
        setAuthState('authenticated')
        onAuthChange(true)
      } else {
        setAuthState('not-authenticated')
        onAuthChange(false)
      }
    } catch {
      setAuthState('not-authenticated')
      onAuthChange(false)
    }
  }, [bin, onAuthChange])

  useEffect(() => { if (isCliReady) checkAuth() }, [isCliReady, checkAuth])

  const handleLogin = useCallback(async () => {
    setAuthState('checking')
    try {
      const result = await ipc.claudeLogin(bin)
      if (result.loggedIn) {
        setAuthEmail(result.email ?? '')
        setAuthMethod(result.authMethod ?? '')
        setSubscriptionType(result.subscriptionType ?? '')
        setAuthState('authenticated')
        onAuthChange(true)
      } else {
        setAuthState('not-authenticated')
      }
    } catch {
      setAuthState('not-authenticated')
    }
  }, [bin, onAuthChange])

  return (
    <div className={cn('w-full rounded-xl border overflow-hidden transition-colors', !isCliReady ? 'border-border bg-card opacity-50 pointer-events-none' : 'border-border bg-card')}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className={cn('flex size-7 items-center justify-center rounded-full transition-colors', authState === 'authenticated' ? 'bg-emerald-500/10' : 'bg-muted/40')}>
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
        {authState === 'authenticated' && subscriptionType && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            {subscriptionType}
          </span>
        )}
      </div>
      {authState === 'not-authenticated' && isCliReady && (
        <div className="flex flex-col gap-3 px-5 py-4">
          <button type="button" onClick={handleLogin}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <IconLogin size={16} /> Sign in with Claude
          </button>
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            Opens your browser to authenticate with Claude. The app will detect when you're signed in.
          </p>
        </div>
      )}
      {authState === 'authenticated' && authMethod && (
        <div className="px-5 py-2.5 text-left">
          <span className="text-[11px] text-muted-foreground">Signed in via {authMethod}</span>
        </div>
      )}
    </div>
  )
}
