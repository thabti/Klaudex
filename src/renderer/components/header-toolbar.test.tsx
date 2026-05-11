import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Port of kirodex `header-toolbar.test.tsx` (TASK-046).
 *
 * Klaudex's `header-toolbar.tsx` is a simplified version of kirodex's:
 *   - It does NOT call `ipc.gitDetect` / `ipc.gitInit`
 *   - It does NOT render an "Initialize Git" button
 *   - It always renders the diff toggle (the surrounding AppHeader gates on workspace)
 *   - It does NOT include kirodex's `SplitToggleButton` (Klaudex uses a different split impl)
 *
 * The kirodex tests for `git-init-button` and split-view focus are therefore not
 * applicable and are dropped — see inline comments. The remaining tests cover
 * action-button states (diff toggle, terminal toggle), workspace/diff-stats
 * rendering, and a button-disabled-state failure case (terminal button must not
 * be clickable / dispatch a callback when no task is selected).
 */

const mockGitDiffStats = vi.fn()
const mockToggleTerminal = vi.fn()

vi.mock('@/lib/ipc', () => ({
  ipc: {
    gitDiffStats: (...args: unknown[]) => mockGitDiffStats(...args),
  },
}))

type StoreShape = {
  selectedTaskId: string | null
  tasks: Record<string, { status: string }>
  terminalOpenTasks: Set<string>
  toggleTerminal: (id: string) => void
}

let storeState: StoreShape = {
  selectedTaskId: null,
  tasks: {},
  terminalOpenTasks: new Set(),
  toggleTerminal: mockToggleTerminal,
}

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: (selector: (s: StoreShape) => unknown) => selector(storeState),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) =>
    args
      .flat(Infinity as number)
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join(' '),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/OpenInEditorGroup', () => ({
  OpenInEditorGroup: () => <div data-testid="open-in-editor-group" />,
}))

vi.mock('@/components/GitActionsGroup', () => ({
  GitActionsGroup: () => <div data-testid="git-actions-group" />,
}))

import { HeaderToolbar } from './header-toolbar'

const setStore = (overrides: Partial<StoreShape>) => {
  storeState = {
    selectedTaskId: null,
    tasks: {},
    terminalOpenTasks: new Set(),
    toggleTerminal: mockToggleTerminal,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setStore({})
  mockGitDiffStats.mockResolvedValue({ additions: 0, deletions: 0, fileCount: 0 })
})

describe('HeaderToolbar', () => {
  it('renders the diff toggle button and adjacent groups for a workspace', async () => {
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('toggle-diff-button')).toBeInTheDocument()
    expect(screen.getByTestId('open-in-editor-group')).toBeInTheDocument()
    expect(screen.getByTestId('git-actions-group')).toBeInTheDocument()
    // Stats poller should run on mount with the workspace path
    await waitFor(() => {
      expect(mockGitDiffStats).toHaveBeenCalledWith('/tmp/proj')
    })
  })

  it('reflects sidePanelOpen via aria-pressed on the diff toggle (action-button state)', () => {
    const { rerender } = render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('toggle-diff-button')).toHaveAttribute('aria-pressed', 'false')
    rerender(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen
        onToggleSidePanel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('toggle-diff-button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('invokes onToggleSidePanel when the diff toggle is clicked', () => {
    const handleToggle = vi.fn()
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={handleToggle}
      />,
    )
    fireEvent.click(screen.getByTestId('toggle-diff-button'))
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('renders diff stats (+adds / -dels / fileCount) once gitDiffStats resolves with non-zero values', async () => {
    mockGitDiffStats.mockResolvedValue({ additions: 12, deletions: 3, fileCount: 4 })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('+12')).toBeInTheDocument()
    })
    expect(screen.getByText('-3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('does not render diff-stats counters when stats are all zero', async () => {
    mockGitDiffStats.mockResolvedValue({ additions: 0, deletions: 0, fileCount: 0 })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(mockGitDiffStats).toHaveBeenCalled()
    })
    expect(screen.queryByText('+0')).not.toBeInTheDocument()
    expect(screen.queryByText('-0')).not.toBeInTheDocument()
  })

  it('hides the terminal toggle when no task is selected (focus / action-button state)', () => {
    setStore({ selectedTaskId: null })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('toggle-terminal-button')).not.toBeInTheDocument()
  })

  it('shows the terminal toggle when a task is selected and reflects open state via aria-pressed', () => {
    setStore({
      selectedTaskId: 'task-1',
      tasks: { 'task-1': { status: 'paused' } },
      terminalOpenTasks: new Set(['task-1']),
    })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('toggle-terminal-button')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports aria-pressed=false for terminal toggle when the task is NOT in terminalOpenTasks', () => {
    setStore({
      selectedTaskId: 'task-1',
      tasks: { 'task-1': { status: 'paused' } },
      terminalOpenTasks: new Set(),
    })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('toggle-terminal-button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls toggleTerminal with the selected task id when the terminal button is clicked', () => {
    setStore({
      selectedTaskId: 'task-7',
      tasks: { 'task-7': { status: 'paused' } },
      terminalOpenTasks: new Set(),
    })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('toggle-terminal-button'))
    expect(mockToggleTerminal).toHaveBeenCalledTimes(1)
    expect(mockToggleTerminal).toHaveBeenCalledWith('task-7')
  })

  // Failure-case (regression guard for "button disabled state computed wrong"):
  // The terminal toggle is gated on `selectedTaskId` truthiness. If that
  // condition were inverted (or removed), the button would render and a click
  // could invoke `toggleTerminal(null!)`. This test pins down the correct
  // gating: with no selectedTaskId, no button is in the DOM, so it can never
  // be clicked or fire the callback.
  it('failure-case: terminal toggle cannot fire when no task is selected', () => {
    setStore({ selectedTaskId: null })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    const btn = screen.queryByTestId('toggle-terminal-button')
    expect(btn).toBeNull()
    // Even forcing a "click" on something that doesn't exist must not invoke
    // the store action — we assert the callback was never called.
    expect(mockToggleTerminal).not.toHaveBeenCalled()
  })

  it('applies the animate-pulse class on diff stats while task status is "running"', async () => {
    setStore({
      selectedTaskId: 'task-1',
      tasks: { 'task-1': { status: 'running' } },
      terminalOpenTasks: new Set(),
    })
    mockGitDiffStats.mockResolvedValue({ additions: 5, deletions: 1, fileCount: 2 })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    const adds = await screen.findByText('+5')
    // The pulse class lives on the stats wrapper (parent of the +N span).
    expect(adds.parentElement?.className).toContain('animate-pulse')
  })

  it('does NOT apply animate-pulse when task status is not "running"', async () => {
    setStore({
      selectedTaskId: 'task-1',
      tasks: { 'task-1': { status: 'paused' } },
      terminalOpenTasks: new Set(),
    })
    mockGitDiffStats.mockResolvedValue({ additions: 5, deletions: 1, fileCount: 2 })
    render(
      <HeaderToolbar
        workspace="/tmp/proj"
        sidePanelOpen={false}
        onToggleSidePanel={vi.fn()}
      />,
    )
    const adds = await screen.findByText('+5')
    expect(adds.parentElement?.className).not.toContain('animate-pulse')
  })
})
