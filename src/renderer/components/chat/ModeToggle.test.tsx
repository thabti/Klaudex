import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/stores/settingsStore', () => {
  const store = { availableModes: [] as any[], currentModeId: null as string | null }
  return {
    useSettingsStore: Object.assign(
      (selector: (s: typeof store) => any) => selector(store),
      { getState: () => store, setState: (s: Partial<typeof store>) => Object.assign(store, s) },
    ),
  }
})
vi.mock('@/stores/taskStore', () => ({
  useTaskStore: { getState: () => ({ selectedTaskId: null }) },
}))
vi.mock('@/lib/ipc', () => ({
  ipc: { setMode: vi.fn().mockResolvedValue(undefined) },
}))

import { ModeToggle } from './ModeToggle'
import { useSettingsStore } from '@/stores/settingsStore'

describe('ModeToggle', () => {
  it('shows loading placeholders when < 2 modes', () => {
    (useSettingsStore as any).setState({ availableModes: [], currentModeId: null })
    const { container } = render(<ModeToggle />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders Chat and Plan buttons when modes available', () => {
    (useSettingsStore as any).setState({
      availableModes: [
        { id: 'kiro_default', name: 'Default' },
        { id: 'kiro_planner', name: 'Planner' },
      ],
      currentModeId: 'kiro_default',
    })
    render(<ModeToggle />)
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
  })
})
