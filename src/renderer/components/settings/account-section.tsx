import { IconLogin, IconLogout } from '@tabler/icons-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { SectionHeader, SettingsCard, SettingRow } from './settings-shared'

export const AccountSection = () => {
  const { claudeAuth, logout, openLogin } = useSettingsStore()

  return (
    <>
      <SectionHeader section="account" />
      <SettingsCard>
        {claudeAuth ? (
          <SettingRow
            label={claudeAuth.email ?? 'Authenticated'}
            description={`${claudeAuth.authMethod}${claudeAuth.subscriptionType ? ` · ${claudeAuth.subscriptionType}` : ''}`}
          >
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <IconLogout className="size-3" />
              Sign out
            </button>
          </SettingRow>
        ) : (
          <SettingRow
            label="Not signed in"
            description="Sign in to access Claude features and sync your preferences."
          >
            <button
              type="button"
              onClick={openLogin}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <IconLogin className="size-3" />
              Sign in
            </button>
          </SettingRow>
        )}
      </SettingsCard>
    </>
  )
}
