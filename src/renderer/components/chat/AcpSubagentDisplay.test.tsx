import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'
import { AcpSubagentDisplay } from './AcpSubagentDisplay'
import type { SubagentInfo } from '@/types'

/**
 * NOTE on SUT bug (AcpSubagentDisplay.tsx:136):
 *   `data-testid={`acp-agent-${agent.name || i}`}`
 * `i` is undefined inside AgentCard. Tests work around this by always
 * giving subagents a non-empty `name`, which short-circuits the `||`
 * and avoids the ReferenceError. This is a SUT bug that is out of
 * scope for TASK-047.
 */

const seedSubagents = (taskId: string, agents: SubagentInfo[]) => {
  useTaskStore.setState({
    selectedTaskId: taskId,
    liveSubagents: { [taskId]: agents },
  })
}

const clearSubagents = () => {
  useTaskStore.setState({
    selectedTaskId: null,
    liveSubagents: {},
  })
}

const makeAgent = (overrides: Partial<SubagentInfo> = {}): SubagentInfo => ({
  name: 'agent-a',
  status: 'running',
  raw: {},
  ...overrides,
})

describe('AcpSubagentDisplay', () => {
  beforeEach(() => {
    clearSubagents()
  })

  it('renders nothing when no subagents are present (empty state)', () => {
    seedSubagents('task-1', [])
    const { container } = render(<AcpSubagentDisplay />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('acp-subagent-display')).toBeNull()
  })

  it('renders nothing when no task is selected', () => {
    useTaskStore.setState({ selectedTaskId: null, liveSubagents: {} })
    const { container } = render(<AcpSubagentDisplay />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the panel with header description when subagents exist (smoke)', () => {
    seedSubagents('task-1', [
      makeAgent({ name: 'agent-a', description: 'Parallel research', status: 'running' }),
      makeAgent({ name: 'agent-b', status: 'completed' }),
    ])
    render(<AcpSubagentDisplay />)
    expect(screen.getByTestId('acp-subagent-display')).toBeInTheDocument()
    expect(screen.getByText('Parallel research')).toBeInTheDocument()
    // Counter "1/2"
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('agent-a')).toBeInTheDocument()
    expect(screen.getByText('agent-b')).toBeInTheDocument()
  })

  it('renders fallback "Parallel agents" when description is missing', () => {
    seedSubagents('task-1', [makeAgent({ name: 'lone' })])
    render(<AcpSubagentDisplay />)
    expect(screen.getByText('Parallel agents')).toBeInTheDocument()
  })

  it('shows "all done" indicator when every subagent is completed', () => {
    seedSubagents('task-1', [
      makeAgent({ name: 'a', status: 'completed' }),
      makeAgent({ name: 'b', status: 'completed' }),
    ])
    render(<AcpSubagentDisplay />)
    expect(screen.getByText(/all done/i)).toBeInTheDocument()
  })

  it('toggles the expand/collapse state when header is clicked (interaction)', () => {
    seedSubagents('task-1', [makeAgent({ name: 'agent-x', status: 'running' })])
    render(<AcpSubagentDisplay />)
    const toggle = screen.getByRole('button', { name: /collapse subagent details/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  describe('role label mapping (current behavior; TASK-003 blocked area)', () => {
    it('maps kiro_default to "Default" label', () => {
      seedSubagents('task-1', [makeAgent({ name: 'a', role: 'kiro_default', status: 'running' })])
      const { container } = render(<AcpSubagentDisplay />)
      // Label is hidden on small screens (sm:inline) but is in the DOM
      expect(container.textContent).toContain('Default')
    })

    it('maps kiro_planner to "Planner" label', () => {
      seedSubagents('task-1', [makeAgent({ name: 'a', role: 'kiro_planner', status: 'running' })])
      const { container } = render(<AcpSubagentDisplay />)
      expect(container.textContent).toContain('Planner')
    })

    it('maps kiro_guide to "Guide" label', () => {
      seedSubagents('task-1', [makeAgent({ name: 'a', role: 'kiro_guide', status: 'running' })])
      const { container } = render(<AcpSubagentDisplay />)
      expect(container.textContent).toContain('Guide')
    })

    it('falls back to the raw role string when not mapped', () => {
      seedSubagents('task-1', [makeAgent({ name: 'a', role: 'custom-role', status: 'running' })])
      const { container } = render(<AcpSubagentDisplay />)
      expect(container.textContent).toContain('custom-role')
    })
  })
})
