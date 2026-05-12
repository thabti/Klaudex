import { memo, useCallback } from 'react'
import { IconLogin, IconLogout } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettingsStore } from '@/stores/settingsStore'
import { SectionHeader, SettingsCard, SettingRow, SettingsGrid } from './settings-shared'

export const AccountSection = memo(function AccountSection() {
  const claudeAuth = useSettingsStore((s) => s.claudeAuth)
  const logout = useSettingsStore((s) => s.logout)
  const openLogin = useSettingsStore((s) => s.openLogin)

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  const handleLogin = useCallback(() => {
    openLogin()
  }, [openLogin])

  return (
    <>
      <SectionHeader section="account" />
      <SettingsGrid label="Authentication" description="Claude account status">
        <SettingsCard>
          {claudeAuth ? (
            <SettingRow
              label={claudeAuth.email ?? 'Authenticated'}
              description={`${claudeAuth.authMethod}${claudeAuth.subscriptionType ? ` · ${claudeAuth.subscriptionType}` : ''}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Sign out of Claude account"
                    className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <IconLogout className="size-3" />
                    Sign out
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sign out</TooltipContent>
              </Tooltip>
            </SettingRow>
          ) : (
            <SettingRow
              label="Not signed in"
              description="Sign in to access Claude features."
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleLogin}
                    aria-label="Sign in to Claude"
                    className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <IconLogin className="size-3" />
                    Sign in
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Sign in to your Claude account</TooltipContent>
              </Tooltip>
            </SettingRow>
          )}
        </SettingsCard>
      </SettingsGrid>
    </>
  )
})
