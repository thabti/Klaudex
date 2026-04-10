import { describe, it, expect } from 'vitest'
import { selectAutoApprove } from './AutoApproveToggle'

describe('selectAutoApprove', () => {
  it('returns false by default', () => {
    const state = { activeWorkspace: null, settings: { kiroBin: '', agentProfiles: [], fontSize: 13 } } as any
    expect(selectAutoApprove(state)).toBe(false)
  })

  it('returns global autoApprove when no workspace', () => {
    const state = { activeWorkspace: null, settings: { kiroBin: '', agentProfiles: [], fontSize: 13, autoApprove: true } } as any
    expect(selectAutoApprove(state)).toBe(true)
  })

  it('returns project pref when workspace set', () => {
    const state = {
      activeWorkspace: '/ws',
      settings: { kiroBin: '', agentProfiles: [], fontSize: 13, autoApprove: false, projectPrefs: { '/ws': { autoApprove: true } } },
    } as any
    expect(selectAutoApprove(state)).toBe(true)
  })

  it('falls back to global when project pref undefined', () => {
    const state = {
      activeWorkspace: '/ws',
      settings: { kiroBin: '', agentProfiles: [], fontSize: 13, autoApprove: true, projectPrefs: { '/ws': {} } },
    } as any
    expect(selectAutoApprove(state)).toBe(true)
  })
})
