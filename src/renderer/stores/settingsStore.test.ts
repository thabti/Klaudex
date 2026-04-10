import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    getSettings: vi.fn().mockResolvedValue({}),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    listModels: vi.fn().mockResolvedValue({ availableModels: [], currentModelId: null }),
    kiroWhoami: vi.fn().mockResolvedValue({}),
    kiroLogout: vi.fn().mockResolvedValue(undefined),
    openTerminalWithCommand: vi.fn().mockResolvedValue(undefined),
  },
}))

import { useSettingsStore } from './settingsStore'

beforeEach(() => {
  useSettingsStore.setState({
    settings: { kiroBin: 'kiro-cli', agentProfiles: [], fontSize: 13 },
    isLoaded: false,
    availableModels: [],
    currentModelId: null,
    modelsLoading: false,
    modelsError: null,
    availableModes: [],
    currentModeId: null,
    activeWorkspace: null,
    availableCommands: [],
    liveMcpServers: [],
    kiroAuth: null,
    kiroAuthChecked: false,
  })
})

describe('settingsStore', () => {
  it('has default settings', () => {
    const s = useSettingsStore.getState()
    expect(s.settings.kiroBin).toBe('kiro-cli')
    expect(s.settings.fontSize).toBe(13)
  })

  it('setActiveWorkspace sets workspace', () => {
    useSettingsStore.getState().setActiveWorkspace('/ws')
    expect(useSettingsStore.getState().activeWorkspace).toBe('/ws')
  })

  it('setActiveWorkspace applies project model pref', () => {
    useSettingsStore.setState({
      settings: {
        kiroBin: 'kiro-cli', agentProfiles: [], fontSize: 13,
        projectPrefs: { '/ws': { modelId: 'claude-4' } },
      },
    })
    useSettingsStore.getState().setActiveWorkspace('/ws')
    expect(useSettingsStore.getState().currentModelId).toBe('claude-4')
  })

  it('setActiveWorkspace null clears workspace', () => {
    useSettingsStore.getState().setActiveWorkspace('/ws')
    useSettingsStore.getState().setActiveWorkspace(null)
    expect(useSettingsStore.getState().activeWorkspace).toBeNull()
  })

  it('setProjectPref updates settings and model', () => {
    useSettingsStore.getState().setActiveWorkspace('/ws')
    useSettingsStore.getState().setProjectPref('/ws', { modelId: 'gpt-5', autoApprove: true })
    const prefs = useSettingsStore.getState().settings.projectPrefs?.['/ws']
    expect(prefs?.modelId).toBe('gpt-5')
    expect(prefs?.autoApprove).toBe(true)
    expect(useSettingsStore.getState().currentModelId).toBe('gpt-5')
  })
})
