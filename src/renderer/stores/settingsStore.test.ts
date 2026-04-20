import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    getSettings: vi.fn().mockResolvedValue({}),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    listModels: vi.fn().mockResolvedValue({ availableModels: [{ modelId: 'm1', name: 'Model 1' }], currentModelId: 'm1' }),
    claudeWhoami: vi.fn().mockResolvedValue({ loggedIn: true, authMethod: 'claude.ai', email: 'test@test.com', subscriptionType: 'team' }),
    claudeLogout: vi.fn().mockResolvedValue(undefined),
    claudeLogin: vi.fn().mockResolvedValue({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.com', subscriptionType: 'team' }),
    openTerminalWithCommand: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

import { useSettingsStore } from './settingsStore'
import { ipc } from '@/lib/ipc'

const defaultState = {
  settings: { claudeBin: 'claude', agentProfiles: [], fontSize: 13, sidebarPosition: 'left' as const, analyticsEnabled: true },
  isLoaded: false,
  availableModels: [],
  currentModelId: null,
  modelsLoading: false,
  modelsError: null,
  availableModes: [],
  currentModeId: null,
  activeWorkspace: null,
  operationalWorkspace: null,
  availableCommands: [],
  liveMcpServers: [],
  claudeAuth: null,
  claudeAuthChecked: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  useSettingsStore.setState(defaultState)
})

describe('settingsStore', () => {
  describe('loadSettings', () => {
    it('loads settings from IPC and merges with defaults', async () => {
      vi.mocked(ipc.getSettings).mockResolvedValue({ fontSize: 16 } as never)
      await useSettingsStore.getState().loadSettings()
      expect(useSettingsStore.getState().settings.fontSize).toBe(16)
      expect(useSettingsStore.getState().settings.claudeBin).toBe('claude')
      expect(useSettingsStore.getState().isLoaded).toBe(true)
    })

    it('sets isLoaded even on error', async () => {
      vi.mocked(ipc.getSettings).mockRejectedValue(new Error('fail'))
      await useSettingsStore.getState().loadSettings()
      expect(useSettingsStore.getState().isLoaded).toBe(true)
    })
  })

  describe('saveSettings', () => {
    it('saves settings via IPC and updates state', async () => {
      const newSettings = { ...defaultState.settings, fontSize: 18 }
      await useSettingsStore.getState().saveSettings(newSettings)
      expect(ipc.saveSettings).toHaveBeenCalledWith(newSettings)
      expect(useSettingsStore.getState().settings.fontSize).toBe(18)
    })
  })

  describe('fetchModels', () => {
    it('fetches models and sets state', async () => {
      await useSettingsStore.getState().fetchModels()
      expect(useSettingsStore.getState().availableModels).toHaveLength(1)
      expect(useSettingsStore.getState().currentModelId).toBe('m1')
      expect(useSettingsStore.getState().modelsLoading).toBe(false)
    })

    it('sets error on failure', async () => {
      vi.mocked(ipc.listModels).mockRejectedValue(new Error('network error'))
      await useSettingsStore.getState().fetchModels()
      expect(useSettingsStore.getState().modelsError).toBe('network error')
      expect(useSettingsStore.getState().modelsLoading).toBe(false)
    })

    it('sets generic error for non-Error throws', async () => {
      vi.mocked(ipc.listModels).mockRejectedValue('string error')
      await useSettingsStore.getState().fetchModels()
      expect(useSettingsStore.getState().modelsError).toBe('Failed to fetch models')
    })
  })

  describe('setActiveWorkspace', () => {
    it('sets workspace', () => {
      useSettingsStore.getState().setActiveWorkspace('/ws')
      expect(useSettingsStore.getState().activeWorkspace).toBe('/ws')
    })

    it('clears workspace when null', () => {
      useSettingsStore.getState().setActiveWorkspace('/ws')
      useSettingsStore.getState().setActiveWorkspace(null)
      expect(useSettingsStore.getState().activeWorkspace).toBeNull()
    })

    it('applies project model pref', () => {
      useSettingsStore.setState({
        settings: {
          ...defaultState.settings,
          projectPrefs: { '/ws': { modelId: 'claude-4' } },
        },
      })
      useSettingsStore.getState().setActiveWorkspace('/ws')
      expect(useSettingsStore.getState().currentModelId).toBe('claude-4')
    })

    it('bails out when workspace and model unchanged', () => {
      useSettingsStore.setState({ activeWorkspace: '/ws', currentModelId: 'claude-4', operationalWorkspace: '/ws' })
      useSettingsStore.setState({
        settings: {
          ...defaultState.settings,
          projectPrefs: { '/ws': { modelId: 'claude-4' } },
        },
      })
      // Should not throw or cause issues
      useSettingsStore.getState().setActiveWorkspace('/ws', '/ws')
      expect(useSettingsStore.getState().activeWorkspace).toBe('/ws')
    })

    it('sets operationalWorkspace to workspace when not provided', () => {
      useSettingsStore.getState().setActiveWorkspace('/project')
      expect(useSettingsStore.getState().activeWorkspace).toBe('/project')
      expect(useSettingsStore.getState().operationalWorkspace).toBe('/project')
    })

    it('sets operationalWorkspace to worktree path when provided', () => {
      useSettingsStore.getState().setActiveWorkspace('/project', '/project/.klaudex/worktrees/feat')
      expect(useSettingsStore.getState().activeWorkspace).toBe('/project')
      expect(useSettingsStore.getState().operationalWorkspace).toBe('/project/.klaudex/worktrees/feat')
    })

    it('clears operationalWorkspace when workspace is null', () => {
      useSettingsStore.getState().setActiveWorkspace('/project', '/project/.klaudex/worktrees/feat')
      useSettingsStore.getState().setActiveWorkspace(null)
      expect(useSettingsStore.getState().activeWorkspace).toBeNull()
      expect(useSettingsStore.getState().operationalWorkspace).toBeNull()
    })

    it('bails out when all three fields unchanged', () => {
      useSettingsStore.setState({ activeWorkspace: '/project', operationalWorkspace: '/project/.klaudex/worktrees/feat', currentModelId: null })
      const stateBefore = useSettingsStore.getState()
      useSettingsStore.getState().setActiveWorkspace('/project', '/project/.klaudex/worktrees/feat')
      // State reference should be the same (no unnecessary re-render)
      expect(useSettingsStore.getState().activeWorkspace).toBe(stateBefore.activeWorkspace)
      expect(useSettingsStore.getState().operationalWorkspace).toBe(stateBefore.operationalWorkspace)
    })
  })

  describe('setProjectPref', () => {
    it('updates project prefs and model', () => {
      useSettingsStore.getState().setActiveWorkspace('/ws')
      useSettingsStore.getState().setProjectPref('/ws', { modelId: 'gpt-5', autoApprove: true })
      const prefs = useSettingsStore.getState().settings.projectPrefs?.['/ws']
      expect(prefs?.modelId).toBe('gpt-5')
      expect(prefs?.autoApprove).toBe(true)
      expect(useSettingsStore.getState().currentModelId).toBe('gpt-5')
    })

    it('merges with existing prefs', () => {
      useSettingsStore.setState({
        settings: {
          ...defaultState.settings,
          projectPrefs: { '/ws': { modelId: 'old', autoApprove: false } },
        },
      })
      useSettingsStore.getState().setProjectPref('/ws', { autoApprove: true })
      const prefs = useSettingsStore.getState().settings.projectPrefs?.['/ws']
      expect(prefs?.modelId).toBe('old')
      expect(prefs?.autoApprove).toBe(true)
    })
  })

  describe('checkAuth', () => {
    it('sets auth state on success', async () => {
      await useSettingsStore.getState().checkAuth()
      expect(useSettingsStore.getState().claudeAuth).toEqual({
        email: 'test@test.com',
        authMethod: 'claude.ai',
        subscriptionType: 'team',
      })
      expect(useSettingsStore.getState().claudeAuthChecked).toBe(true)
    })

    it('clears auth when not logged in', async () => {
      vi.mocked(ipc.claudeWhoami).mockResolvedValue({ loggedIn: false } as never)
      await useSettingsStore.getState().checkAuth()
      expect(useSettingsStore.getState().claudeAuth).toBeNull()
      expect(useSettingsStore.getState().claudeAuthChecked).toBe(true)
    })

    it('clears auth on error', async () => {
      vi.mocked(ipc.claudeWhoami).mockRejectedValue(new Error('fail'))
      await useSettingsStore.getState().checkAuth()
      expect(useSettingsStore.getState().claudeAuth).toBeNull()
      expect(useSettingsStore.getState().claudeAuthChecked).toBe(true)
    })
  })

  describe('logout', () => {
    it('calls IPC logout and clears auth', async () => {
      useSettingsStore.setState({ claudeAuth: { email: 'a@b.com', authMethod: 'claude.ai' } })
      await useSettingsStore.getState().logout()
      expect(ipc.claudeLogout).toHaveBeenCalled()
      expect(useSettingsStore.getState().claudeAuth).toBeNull()
    })

    it('clears auth even when IPC fails', async () => {
      vi.mocked(ipc.claudeLogout).mockRejectedValue(new Error('fail'))
      useSettingsStore.setState({ claudeAuth: { email: 'a@b.com', authMethod: 'claude.ai' } })
      await useSettingsStore.getState().logout()
      expect(useSettingsStore.getState().claudeAuth).toBeNull()
    })
  })

  describe('openLogin', () => {
    it('refreshes state if already logged in', async () => {
      vi.mocked(ipc.claudeWhoami).mockResolvedValue({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.com' } as never)
      await useSettingsStore.getState().openLogin()
      expect(useSettingsStore.getState().claudeAuth?.authMethod).toBe('claude.ai')
      expect(ipc.claudeLogin).not.toHaveBeenCalled()
    })

    it('calls claudeLogin when not logged in', async () => {
      vi.mocked(ipc.claudeWhoami).mockRejectedValue(new Error('not logged in'))
      await useSettingsStore.getState().openLogin()
      expect(ipc.claudeLogin).toHaveBeenCalled()
    })
  })
})
