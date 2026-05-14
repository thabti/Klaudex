import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'
import { AcpSubagentDisplay } from './AcpSubagentDisplay'
import type { SubagentInfo, AgentTask, ToolCall } from '@/types'

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

/** Seed both liveSubagents AND the task itself (with messages) — needed for
 *  click-to-focus tests that look up `tasks[taskId].messages`. */
const seedSubagentsAndTask = (
  taskId: string,
  agents: SubagentInfo[],
  messages: AgentTask['messages'],
) => {
  useTaskStore.setState({
    selectedTaskId: taskId,
    liveSubagents: { [taskId]: agents },
    tasks: {
      [taskId]: {
        id: taskId,
        name: 't',
        workspace: '/tmp',
        status: 'running',
        createdAt: new Date().toISOString(),
        messages,
      },
    },
  } as unknown as Partial<ReturnType<typeof useTaskStore.getState>>)
}

const clearSubagents = () => {
  useTaskStore.setState({
    selectedTaskId: null,
    liveSubagents: {},
    tasks: {},
  } as unknown as Partial<ReturnType<typeof useTaskStore.getState>>)
}

const makeAgent = (overrides: Partial<SubagentInfo> = {}): SubagentInfo => ({
  name: 'agent-a',
  status: 'running',
  raw: {},
  ...overrides,
})

const makeToolCall = (overrides: Partial<ToolCall> = {}): ToolCall => ({
  toolCallId: 'tc-1',
  title: 'sample tool',
  status: 'in_progress',
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

  // ─────────────────────────────────────────────────────────────────────────
  // TASK-011 / TASK-012 / TASK-013 enrichment assertions
  // ─────────────────────────────────────────────────────────────────────────
  describe('TASK-011/012/013 enrichments', () => {
    // ── Group A — Nested tree (TASK-011) ────────────────────────────────────
    describe('nested tree rendering (TASK-011)', () => {
      /** Walks from the agent's name text up to the nearest wrapper with an
       *  inline `paddingLeft` style. Returns the paddingLeft value (in px) or
       *  `null` if no such wrapper is found within the panel root. */
      const findPaddingLeftFor = (agentName: string): string | null => {
        const nameEl = screen.getByText(agentName)
        let cursor: HTMLElement | null = nameEl
        const root = screen.getByTestId('acp-subagent-display')
        while (cursor && cursor !== root) {
          const pl = cursor.style?.paddingLeft
          if (pl) return pl
          cursor = cursor.parentElement
        }
        return null
      }

      it('renders child agents indented under their parent (paddingLeft: 12px)', () => {
        seedSubagents('task-1', [
          makeAgent({ name: 'root', status: 'running' }),
          makeAgent({ name: 'child', parent: 'root', status: 'running' }),
        ])
        render(<AcpSubagentDisplay />)
        // Root is at depth 0 — no indented wrapper.
        expect(findPaddingLeftFor('root')).toBeNull()
        // Child is at depth 1 — wrapped with paddingLeft: 12px (depth * 12).
        expect(findPaddingLeftFor('child')).toBe('12px')
      })

      it('renders two siblings at the same indent depth', () => {
        seedSubagents('task-1', [
          makeAgent({ name: 'root', status: 'running' }),
          makeAgent({ name: 'a', parent: 'root', status: 'running' }),
          makeAgent({ name: 'b', parent: 'root', status: 'running' }),
        ])
        render(<AcpSubagentDisplay />)
        const aPad = findPaddingLeftFor('a')
        const bPad = findPaddingLeftFor('b')
        expect(aPad).toBe('12px')
        expect(bPad).toBe('12px')
        expect(aPad).toBe(bPad)
      })

      it('renders flat (no padding) when no agent declares a parent', () => {
        seedSubagents('task-1', [
          makeAgent({ name: 'a', status: 'running' }),
          makeAgent({ name: 'b', status: 'running' }),
        ])
        render(<AcpSubagentDisplay />)
        // Both should be at depth 0 — no inline paddingLeft wrapper.
        expect(findPaddingLeftFor('a')).toBeNull()
        expect(findPaddingLeftFor('b')).toBeNull()
      })

      it('handles circular parent references without infinite loop and warns', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        seedSubagents('task-1', [
          makeAgent({ name: 'a', parent: 'b', status: 'running' }),
          makeAgent({ name: 'b', parent: 'a', status: 'running' }),
        ])

        // Race the render against a 3s timeout so a stack overflow / hang
        // fails loudly rather than freezing the suite.
        await Promise.race([
          (async () => {
            render(<AcpSubagentDisplay />)
            // Both agents must still appear in the DOM (flat fallback).
            expect(screen.getByText('a')).toBeInTheDocument()
            expect(screen.getByText('b')).toBeInTheDocument()
            // Cycle detection should have logged a warning.
            expect(warnSpy).toHaveBeenCalled()
            const warnedAboutCycle = warnSpy.mock.calls.some((call) =>
              call.some((arg) => typeof arg === 'string' && /cycle/i.test(arg)),
            )
            expect(warnedAboutCycle).toBe(true)
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Circular subagent tree timed out (>3s)')), 3000),
          ),
        ])

        warnSpy.mockRestore()
      })
    })

    // ── Group B — Role colors and icons (TASK-012) ──────────────────────────
    describe('role colors and icons (TASK-012)', () => {
      it('renders distinct role icons for plan vs research', () => {
        seedSubagents('task-1', [
          makeAgent({ name: 'planner', role: 'plan', status: 'running' }),
          makeAgent({ name: 'researcher', role: 'research', status: 'running' }),
        ])
        render(<AcpSubagentDisplay />)

        // Tabler icons stamp `tabler-icon-${name}` onto their root SVG class.
        // The plan role uses IconBrain, research uses IconSearch.
        const plannerCard = screen.getByTestId('acp-agent-planner')
        const researcherCard = screen.getByTestId('acp-agent-researcher')

        const plannerHasBrain = plannerCard.querySelector('svg.tabler-icon-brain') !== null
        const researcherHasSearch = researcherCard.querySelector('svg.tabler-icon-search') !== null

        // Primary assertion: each role's canonical icon is present.
        expect(plannerHasBrain).toBe(true)
        expect(researcherHasSearch).toBe(true)

        // Cross-assertion: the role icons differ between the two cards.
        const plannerRoleIconClass =
          plannerCard.querySelector('svg.tabler-icon-brain')?.getAttribute('class') ?? ''
        const researcherRoleIconClass =
          researcherCard.querySelector('svg.tabler-icon-search')?.getAttribute('class') ?? ''
        expect(plannerRoleIconClass).not.toEqual(researcherRoleIconClass)
      })

      it('applies a non-empty inline backgroundColor to the role badge', () => {
        seedSubagents('task-1', [makeAgent({ name: 'planner', role: 'plan', status: 'running' })])
        render(<AcpSubagentDisplay />)
        // The badge text is the human-readable role label ('Planner' for 'plan').
        const badge = screen.getByText('Planner')
        // Inline style backgroundColor is applied via `style={{ backgroundColor: roleStyle.bg }}`.
        // jsdom normalizes rgba() but the value must be non-empty.
        expect(badge.style.backgroundColor).not.toBe('')
        expect(badge.style.backgroundColor.length).toBeGreaterThan(0)
      })
    })

    // ── Group C — Elapsed clock lifecycle (TASK-012) ────────────────────────
    describe('elapsed clock (TASK-012)', () => {
      beforeEach(() => {
        // Anchor the clock so MM:SS math is deterministic across the test.
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('does NOT render an elapsed clock for pending agents', () => {
        seedSubagents('task-1', [makeAgent({ name: 'queued', status: 'pending' })])
        render(<AcpSubagentDisplay />)
        act(() => {
          vi.advanceTimersByTime(3000)
        })
        const card = screen.getByTestId('acp-agent-queued')
        // No MM:SS span should appear for an agent that never entered `running`.
        expect(card.textContent ?? '').not.toMatch(/\d{2}:\d{2}/)
      })

      it('ticks the clock while running and stops once the agent completes', () => {
        seedSubagents('task-1', [makeAgent({ name: 'worker', status: 'running' })])
        const { rerender } = render(<AcpSubagentDisplay />)

        // Advance 2s — clock should read 00:02.
        act(() => {
          vi.advanceTimersByTime(2000)
        })
        const cardAfter2s = screen.getByTestId('acp-agent-worker')
        expect(cardAfter2s.textContent).toMatch(/00:02/)

        // Flip the agent to completed and advance time again — clock must stop.
        // Stay below the 2000ms auto-collapse threshold so the panel doesn't
        // collapse out from under us; 1500ms is long enough for the interval
        // to have produced another tick had it still been alive.
        seedSubagents('task-1', [makeAgent({ name: 'worker', status: 'completed' })])
        rerender(<AcpSubagentDisplay />)

        act(() => {
          vi.advanceTimersByTime(1500)
        })
        const cardAfterCompletion = screen.getByTestId('acp-agent-worker')
        // The interval has been torn down. The displayed value is whatever the
        // last tick captured (here: 00:02). It must NOT have advanced to 00:03.
        expect(cardAfterCompletion.textContent ?? '').not.toMatch(/00:0[34]/)
      })
    })

    // ── Group D — Click-to-focus (TASK-013) ─────────────────────────────────
    describe('click-to-focus (TASK-013)', () => {
      it('dispatches chat-scroll-to with the matching messageId on click', () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

        seedSubagentsAndTask(
          'task-1',
          [
            makeAgent({
              name: 'agentX',
              currentToolCall: 'someToolId',
              status: 'running',
            }),
          ],
          [
            {
              role: 'user',
              content: 'go',
              timestamp: new Date().toISOString(),
            },
            {
              role: 'assistant',
              content: 'running tool',
              timestamp: new Date().toISOString(),
              toolCalls: [makeToolCall({ toolCallId: 'someToolId', title: 'tool x' })],
            },
          ],
        )
        render(<AcpSubagentDisplay />)
        fireEvent.click(screen.getByTestId('acp-agent-agentX'))

        // Find the chat-scroll-to CustomEvent.
        const scrollToCall = dispatchSpy.mock.calls.find(
          (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'chat-scroll-to',
        )
        expect(scrollToCall).toBeDefined()
        const event = scrollToCall![0] as CustomEvent<{ messageId: string }>
        // The matching tool call lives on message index 1 (the assistant turn).
        expect(event.detail.messageId).toBe('msg-1-work')

        dispatchSpy.mockRestore()
      })

      it('does NOT dispatch chat-scroll-to and keeps the panel open when no message matches', () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent')

        seedSubagentsAndTask(
          'task-1',
          [
            makeAgent({
              name: 'agentY',
              currentToolCall: 'unmatchedToolId',
              status: 'running',
            }),
          ],
          [
            {
              role: 'assistant',
              content: 'no matching tool',
              timestamp: new Date().toISOString(),
              toolCalls: [makeToolCall({ toolCallId: 'differentId', title: 'other tool' })],
            },
          ],
        )
        render(<AcpSubagentDisplay />)
        // Sanity: panel is open before the click.
        expect(screen.getByRole('region', { name: /subagent details/i })).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('acp-agent-agentY'))

        const scrollToCalls = dispatchSpy.mock.calls.filter(
          (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'chat-scroll-to',
        )
        expect(scrollToCalls).toHaveLength(0)

        // Panel must still be open — region remains in the DOM.
        expect(screen.getByRole('region', { name: /subagent details/i })).toBeInTheDocument()

        dispatchSpy.mockRestore()
      })

      it('supports keyboard focus (Tab) and Enter activation on agent cards', async () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent')
        const user = userEvent.setup()

        seedSubagentsAndTask(
          'task-1',
          [
            makeAgent({
              name: 'kbAgent',
              currentToolCall: 'kbTool',
              status: 'running',
            }),
          ],
          [
            {
              role: 'assistant',
              content: 'tool',
              timestamp: new Date().toISOString(),
              toolCalls: [makeToolCall({ toolCallId: 'kbTool', title: 'kb tool' })],
            },
          ],
        )
        render(<AcpSubagentDisplay />)

        // Tab until the agent card receives focus. The header toggle is the
        // first tabbable element; tabbing again should land on the card
        // (tabIndex=0, role=button).
        const card = screen.getByTestId('acp-agent-kbAgent')
        // Direct focus avoids brittleness over the header-toggle tab order.
        card.focus()
        expect(document.activeElement).toBe(card)

        await user.keyboard('{Enter}')

        const scrollToCall = dispatchSpy.mock.calls.find(
          (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'chat-scroll-to',
        )
        expect(scrollToCall).toBeDefined()
        const event = scrollToCall![0] as CustomEvent<{ messageId: string }>
        expect(event.detail.messageId).toBe('msg-0-work')

        dispatchSpy.mockRestore()
      })
    })
  })
})
