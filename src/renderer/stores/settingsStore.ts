import { create } from 'zustand'
import type { AppSettings, ProjectPrefs } from '@/types'
import { ipc } from '@/lib/ipc'
import { track } from '@/lib/analytics'
import { logStoreAction, logError } from '@/lib/debug-logger'

export interface ModelOption {
  modelId: string
  name: string
  description?: string | null
}

export interface ModeOption {
  id: string
  name: string
  description?: string | null
}

export interface SlashCommand {
  name: string
  description?: string
  inputType?: string
}

export interface LiveMcpServer {
  name: string
  status: string
  toolCount: number
}

interface SettingsStore {
  settings: AppSettings
  isLoaded: boolean
  availableModels: ModelOption[]
  currentModelId: string | null
  modelsLoading: boolean
  modelsError: string | null
  availableModes: ModeOption[]
  currentModeId: string | null
  activeWorkspace: string | null
  /** Actual working directory for operations (worktree path when in a worktree thread, project root otherwise). */
  operationalWorkspace: string | null
  availableCommands: SlashCommand[]
  liveMcpServers: LiveMcpServer[]
  claudeAuth: { email: string | null; authMethod: string; subscriptionType?: string } | null
  claudeAuthChecked: boolean
  loadSettings: () => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
  fetchModels: (claudeBin?: string) => Promise<void>
  setActiveWorkspace: (workspace: string | null, operationalWs?: string | null) => void
  setProjectPref: (workspace: string, patch: Partial<ProjectPrefs>) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  openLogin: () => void
}

const defaultSettings: AppSettings = {
  claudeBin: 'claude',
  agentProfiles: [],
  fontSize: 14,
  sidebarPosition: 'left',
  analyticsEnabled: true,
}

const FALLBACK_MODELS: ModelOption[] = [
  { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Best combination of speed and intelligence' },
  { modelId: 'claude-opus-4-7', name: 'Claude Opus 4.7', description: 'Most capable for complex reasoning and agentic coding' },
  { modelId: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fastest with near-frontier intelligence' },
]

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,
  availableModels: FALLBACK_MODELS,
  currentModelId: 'claude-sonnet-4-6',
  modelsLoading: false,
  modelsError: null,
  availableModes: [],
  currentModeId: null,
  activeWorkspace: null,
  operationalWorkspace: null,
  claudeAuth: null,
  claudeAuthChecked: false,
  availableCommands: [],
  liveMcpServers: [],

  loadSettings: async () => {
    try {
      const settings = await ipc.getSettings()
      const merged = { ...defaultSettings, ...settings }
      // If settings look like defaults (user was onboarded but confy lost data),
      // restore from backup to recover projectPrefs, iconOverrides, etc.
      if (!merged.hasOnboardedV2) {
        try {
          const { loadBackup } = await import('@/lib/history-store')
          const backup = await loadBackup()
          if (backup.settings?.hasOnboardedV2) {
            const restored = { ...merged, ...backup.settings }
            set({ settings: restored, isLoaded: true })
            ipc.saveSettings(restored).catch(() => {})
            return
          }
        } catch { /* backup load is best-effort */ }
      }
      set({ settings: merged, isLoaded: true })
    } catch {
      set({ isLoaded: true })
    }
  },

  saveSettings: async (settings) => {
    const prev = get().settings
    logStoreAction('settingsStore', 'saveSettings')
    await ipc.saveSettings(settings)
    set({ settings })
    // Emit a settings_changed event per key that actually changed. We only
    // send the key name, never the value — e.g. the default model id is a
    // user-chosen string we don't need in analytics.
    const keys: Array<keyof AppSettings> = [
      'claudeBin', 'defaultModel', 'autoApprove', 'respectGitignore',
      'coAuthor', 'coAuthorJsonReport', 'notifications', 'fontSize',
      'sidebarPosition', 'analyticsEnabled', 'theme', 'customAppIcon',
    ]
    for (const k of keys) {
      if (prev[k] !== settings[k]) track('settings_changed', { key: String(k) })
    }
  },

  fetchModels: async (claudeBin?: string) => {
    set({ modelsLoading: true, modelsError: null })
    try {
      const result = await ipc.listModels(claudeBin)
      set({
        availableModels: Array.isArray(result.availableModels) ? result.availableModels : [],
        currentModelId: result.currentModelId,
        modelsLoading: false,
      })
    } catch (err) {
      set({
        modelsLoading: false,
        modelsError: err instanceof Error ? err.message : 'Failed to fetch models',
      })
    }
  },

  setActiveWorkspace: (workspace, operationalWs) => {
    const { settings, currentModelId } = get()
    if (!workspace) { set({ activeWorkspace: null, operationalWorkspace: null }); return }
    const prefs = settings.projectPrefs?.[workspace]
    const newModelId = prefs?.modelId !== undefined ? prefs.modelId : currentModelId
    const opWs = operationalWs ?? workspace
    // Only update if something actually changed
    const current = get()
    if (current.activeWorkspace === workspace && current.currentModelId === newModelId && current.operationalWorkspace === opWs) return
    set({ activeWorkspace: workspace, operationalWorkspace: opWs, currentModelId: newModelId ?? null })
  },

  setProjectPref: (workspace, patch) => {
    const { settings } = get()
    const existing = settings.projectPrefs?.[workspace] ?? {}
    const updated: AppSettings = {
      ...settings,
      projectPrefs: {
        ...settings.projectPrefs,
        [workspace]: { ...existing, ...patch },
      },
    }
    // Single set() to avoid two render cycles
    set({
      settings: updated,
      ...(patch.modelId !== undefined ? { currentModelId: patch.modelId } : {}),
    })
    if (patch.modelId !== undefined) track('feature_used', { feature: 'model_switch' })
    ipc.saveSettings(updated).catch(() => {})
  },

  checkAuth: async () => {
    try {
      const { settings } = get()
      logStoreAction('settingsStore', 'checkAuth')
      console.log('[auth] checkAuth called with claudeBin:', settings.claudeBin)
      const result = await ipc.claudeWhoami(settings.claudeBin)
      console.log('[auth] auth status result:', JSON.stringify(result))
      if (result.loggedIn) {
        set({
          claudeAuth: {
            email: result.email ?? null,
            authMethod: result.authMethod ?? 'unknown',
            subscriptionType: result.subscriptionType ?? undefined,
          },
          claudeAuthChecked: true,
        })
        console.log('[auth] authenticated:', result.authMethod, result.email)
      } else {
        console.log('[auth] not logged in')
        set({ claudeAuth: null, claudeAuthChecked: true })
      }
    } catch (err) {
      logError('settingsStore.checkAuth', err)
      console.warn('[auth] checkAuth failed:', err)
      set({ claudeAuth: null, claudeAuthChecked: true })
    }
  },

  logout: async () => {
    try {
      const { settings } = get()
      await ipc.claudeLogout(settings.claudeBin)
    } catch { /* ignore */ }
    set({ claudeAuth: null })
  },

  openLogin: async () => {
    const { settings } = get()
    console.log('[auth] openLogin called with claudeBin:', settings.claudeBin)
    // If already logged in, just refresh state
    try {
      const result = await ipc.claudeWhoami(settings.claudeBin)
      console.log('[auth] openLogin auth check:', JSON.stringify(result))
      if (result.loggedIn) {
        set({
          claudeAuth: {
            email: result.email ?? null,
            authMethod: result.authMethod ?? 'unknown',
            subscriptionType: result.subscriptionType ?? undefined,
          },
          claudeAuthChecked: true,
        })
        console.log('[auth] already logged in')
        return
      }
    } catch (err) {
      console.log('[auth] not logged in, starting login flow:', err)
    }
    // Spawn claude auth login internally — it opens a browser for OAuth
    // and we poll auth status until complete
    console.log('[auth] starting claude auth login')
    try {
      const result = await ipc.claudeLogin(settings.claudeBin)
      if (result.loggedIn) {
        set({
          claudeAuth: {
            email: result.email ?? null,
            authMethod: result.authMethod ?? 'unknown',
            subscriptionType: result.subscriptionType ?? undefined,
          },
          claudeAuthChecked: true,
        })
        console.log('[auth] login succeeded:', result.authMethod, result.email)
      }
    } catch (err) {
      console.warn('[auth] login failed or timed out:', err)
    }
  },
}))
