import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { StatsPanel } from './StatsPanel'
import type { AgentTask } from '@/types'

const seedTask = (task: AgentTask | null) => {
  if (task) {
    useTaskStore.setState({
      selectedTaskId: task.id,
      tasks: { [task.id]: task },
    })
  } else {
    useTaskStore.setState({
      selectedTaskId: null,
      tasks: {},
    })
  }
}

const makeTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: 'task-1',
  name: 'Test thread',
  workspace: '/projects/test',
  status: 'paused',
  createdAt: '2026-01-01T00:00:00Z',
  messages: [],
  ...overrides,
})

describe('StatsPanel', () => {
  beforeEach(() => {
    // Reset task store
    useTaskStore.setState({
      tasks: {},
      selectedTaskId: null,
    })
    // Ensure a known model id
    useSettingsStore.setState({ currentModelId: 'claude-sonnet-4-6' })
  })

  it('renders the Session Stats header (smoke)', () => {
    seedTask(null)
    render(<StatsPanel onDismiss={vi.fn()} />)
    expect(screen.getByText(/session stats/i)).toBeInTheDocument()
  })

  it('renders empty/zero state when no thread is selected', () => {
    seedTask(null)
    render(<StatsPanel onDismiss={vi.fn()} />)
    expect(screen.getByText(/no thread selected/i)).toBeInTheDocument()
  })

  it('renders task stats when a populated task is selected', () => {
    const task = makeTask({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01Z' },
        { role: 'assistant', content: 'hello', timestamp: '2026-01-01T00:00:02Z' },
      ],
      contextUsage: {
        used: 1000,
        size: 100000,
        inputTokens: 800,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
      totalCost: 0.0123,
    })
    seedTask(task)
    render(<StatsPanel onDismiss={vi.fn()} />)
    // Header
    expect(screen.getByText(/session stats/i)).toBeInTheDocument()
    // Conversation block label
    expect(screen.getByText(/conversation/i)).toBeInTheDocument()
    expect(screen.getByText(/turns/i)).toBeInTheDocument()
    // Tokens block label
    expect(screen.getByText(/^Tokens$/i)).toBeInTheDocument()
  })

  it('renders aggregate "All threads" block when threads exist', () => {
    const task = makeTask({
      messages: [
        { role: 'user', content: 'hi', timestamp: '2026-01-01T00:00:01Z' },
      ],
    })
    seedTask(task)
    render(<StatsPanel onDismiss={vi.fn()} />)
    expect(screen.getByText(/all threads/i)).toBeInTheDocument()
  })

  it('does not render "All threads" block when no thread has messages', () => {
    seedTask(null)
    render(<StatsPanel onDismiss={vi.fn()} />)
    expect(screen.queryByText(/all threads/i)).toBeNull()
  })

  it('calls onDismiss when the close button is activated (interaction)', () => {
    seedTask(null)
    const onDismiss = vi.fn()
    render(<StatsPanel onDismiss={onDismiss} />)
    const closeBtn = screen.getByRole('button', { name: /close panel/i })
    // PanelShell uses onMouseDown, not onClick
    fireEvent.mouseDown(closeBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders without crashing on a totally empty task store (zero state)', () => {
    seedTask(null)
    const { container } = render(<StatsPanel onDismiss={vi.fn()} />)
    expect(container).toBeInTheDocument()
  })
})
