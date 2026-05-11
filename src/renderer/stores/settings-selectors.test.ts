import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'

describe('settingsStore selector granularity', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        autoApprove: false,
        projectPrefs: { '/project': { autoApprove: true, symlinkDirectories: ['node_modules'] } },
        fontSize: 13,
        theme: 'dark',
      },
      isLoaded: true,
    })
  })

  it('selecting settings.projectPrefs returns the correct value', () => {
    const projectPrefs = useSettingsStore.getState().settings.projectPrefs
    expect(projectPrefs).toBeDefined()
    expect(projectPrefs?.['/project']?.autoApprove).toBe(true)
  })

  it('selecting settings.autoApprove returns the correct value', () => {
    const autoApprove = useSettingsStore.getState().settings.autoApprove
    expect(autoApprove).toBe(false)
  })

  it('individual property selectors return stable references for unchanged values', () => {
    const selector = (s: ReturnType<typeof useSettingsStore.getState>) => s.settings.autoApprove
    const val1 = selector(useSettingsStore.getState())

    // Update an unrelated field
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, fontSize: 14 },
    })

    const val2 = selector(useSettingsStore.getState())
    // Primitive values are always stable (same value)
    expect(val1).toBe(val2)
  })

  it('projectPrefs selector returns correct per-workspace prefs', () => {
    const prefs = useSettingsStore.getState().settings.projectPrefs?.['/project']
    expect(prefs?.symlinkDirectories).toEqual(['node_modules'])
  })
})
