import { IconTrash, IconRefresh, IconChartBar } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { Switch } from '@/components/ui/switch'
import type { AppSettings } from '@/types'
import { SectionHeader, SectionLabel, SettingsCard, SettingRow, Divider } from './settings-shared'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AdvancedSectionProps {
  draft: AppSettings
  updateDraft: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

export const AdvancedSection = ({ draft, updateDraft, onClose }: AdvancedSectionProps) => {
  const [analyticsSize, setAnalyticsSize] = useState<number>(0)
  const refreshDbSize = useAnalyticsStore((s) => s.refreshDbSize)
  const clearAnalytics = useAnalyticsStore((s) => s.clearData)
  const dbSize = useAnalyticsStore((s) => s.dbSize)

  useEffect(() => {
    refreshDbSize()
  }, [refreshDbSize])

  useEffect(() => { setAnalyticsSize(dbSize) }, [dbSize])

  return (
  <>
    <SectionHeader section="advanced" />
    <div>
      <SectionLabel title="Privacy" />
      <SettingsCard>
        <SettingRow
          label="Share anonymous usage data"
          description="Feature usage and app version only. No prompts, code, file paths, branch names, or commit messages are ever sent."
        >
          <Switch
            checked={draft.analyticsEnabled ?? true}
            onCheckedChange={(checked) => updateDraft({ analyticsEnabled: checked })}
            aria-label="Toggle anonymous analytics"
          />
        </SettingRow>
      </SettingsCard>
    </div>

    <div>
      <SectionLabel title="Git" />
      <SettingsCard>
        <SettingRow label="Co-authored-by Klaudex" description="Append trailer to every commit">
          <Switch
            checked={draft.coAuthor ?? true}
            onCheckedChange={(checked) => updateDraft({ coAuthor: checked })}
            aria-label="Toggle co-author trailer"
          />
        </SettingRow>
        <Divider />
        <SettingRow label="Task completion report" description="Summary card when a task finishes">
          <Switch
            checked={draft.coAuthorJsonReport ?? true}
            onCheckedChange={(checked) => updateDraft({ coAuthorJsonReport: checked })}
            aria-label="Toggle task completion report"
          />
        </SettingRow>
      </SettingsCard>
    </div>

    <div>
      <SectionLabel title="Side questions (/btw)" />
      <SettingsCard>
        <SettingRow label="Max question length" description="Character limit for /btw and /tangent questions">
          <input
            type="number"
            min={100}
            max={10000}
            step={100}
            value={draft.btwMaxChars ?? 1220}
            onChange={(e) => updateDraft({ btwMaxChars: Math.max(100, Math.min(10000, Number(e.target.value) || 1220)) })}
            className="w-20 rounded-lg border border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            aria-label="Max btw question characters"
          />
        </SettingRow>
      </SettingsCard>
    </div>

    <div>
      <SectionLabel title="Data" />
      <SettingsCard>
        <SettingRow label="Conversation history" description="Threads are saved between sessions">
          <button
            type="button"
            onClick={() => { useTaskStore.getState().clearHistory(); onClose() }}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <IconTrash className="size-3" />
            Clear history
          </button>
        </SettingRow>
        <Divider />
        <SettingRow
          label="Analytics data"
          description={`Local usage stats stored on disk (${formatBytes(analyticsSize)})`}
        >
          <button
            type="button"
            onClick={async () => { await clearAnalytics(); refreshDbSize() }}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <IconChartBar className="size-3" />
            Clear analytics
          </button>
        </SettingRow>
        <Divider />
        <SettingRow label="Replay onboarding" description="Run the setup wizard again">
          <button
            type="button"
            onClick={async () => {
              const store = useSettingsStore.getState()
              await store.saveSettings({ ...store.settings, hasOnboardedV2: false })
              onClose()
            }}
            className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <IconRefresh className="size-3" />
            Replay
          </button>
        </SettingRow>
      </SettingsCard>
    </div>
  </>
  )
}
