import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { ContextRing } from './ContextRing'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTaskStore } from '@/stores/taskStore'

const wrap = (ui: React.ReactNode) => <TooltipProvider>{ui}</TooltipProvider>

/** Reset taskStore so tooltip selectors return predictable null/0 values
 *  unless the test explicitly seeds task data. */
const resetTaskStore = () => {
  useTaskStore.setState({ selectedTaskId: null, tasks: {} } as Partial<ReturnType<typeof useTaskStore.getState>>)
}

/** Seed a task with the given contextUsage / totalCost / messages, and select it. */
const seedTask = (opts: {
  contextUsage?: {
    used: number
    size: number
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  } | null
  totalCost?: number
  messageCount?: number
}) => {
  const taskId = 'test-task-id'
  const messages = Array.from({ length: opts.messageCount ?? 0 }, (_, i) => ({ id: `m-${i}` }))
  useTaskStore.setState({
    selectedTaskId: taskId,
    tasks: {
      [taskId]: {
        id: taskId,
        name: 'test',
        workspace: '/tmp',
        status: 'completed',
        createdAt: new Date().toISOString(),
        messages,
        contextUsage: opts.contextUsage ?? null,
        totalCost: opts.totalCost,
      },
    },
  } as unknown as Partial<ReturnType<typeof useTaskStore.getState>>)
}

/** Radix Tooltip renders the body twice: once in the visible popover, once in
 *  a screen-reader-only span. Use *AllBy* queries everywhere to handle both. */
const hoverRing = async () => {
  const user = userEvent.setup()
  const trigger = screen.getByTestId('context-ring')
  await user.hover(trigger)
}

describe('ContextRing', () => {
  beforeEach(() => {
    resetTaskStore()
  })

  // ── Existing baseline tests (preserved) ───────────────────────────────────
  it('shows percentage', () => {
    const { container } = render(wrap(<ContextRing used={50} size={100} />))
    expect(container.textContent).toContain('50')
  })

  it('calculates percentage from token counts', () => {
    const { container } = render(wrap(<ContextRing used={5000} size={10000} />))
    expect(container.textContent).toContain('50')
  })

  it('renders testid', () => {
    const { container } = render(wrap(<ContextRing used={0} size={100} />))
    expect(container.querySelector('[data-testid="context-ring"]')).toBeInTheDocument()
  })

  it('handles zero size', () => {
    const { container } = render(wrap(<ContextRing used={0} size={0} />))
    expect(container.textContent).toContain('0')
  })

  // ── TASK-010 tooltip extension assertions ─────────────────────────────────
  describe('tooltip extension', () => {
    it('renders breakdown grid when all four token fields are present', async () => {
      seedTask({
        contextUsage: {
          used: 50000,
          size: 100000,
          inputTokens: 30000,
          outputTokens: 15000,
          cacheReadTokens: 4000,
          cacheCreationTokens: 1000,
        },
      })
      render(wrap(<ContextRing used={50000} size={100000} />))
      await hoverRing()
      expect((await screen.findAllByText(/input:/)).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/output:/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/cache read:/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/cache write:/).length).toBeGreaterThan(0)
    })

    it('falls back to single-line summary when breakdown is missing', async () => {
      seedTask({ contextUsage: { used: 50000, size: 100000 } })
      render(wrap(<ContextRing used={50000} size={100000} />))
      await hoverRing()
      expect((await screen.findAllByText(/Context: \d+% used/)).length).toBeGreaterThan(0)
      // Breakdown rows must NOT appear when fields are absent.
      expect(screen.queryAllByText(/input:/)).toHaveLength(0)
      expect(screen.queryAllByText(/output:/)).toHaveLength(0)
      expect(screen.queryAllByText(/cache read:/)).toHaveLength(0)
      expect(screen.queryAllByText(/cache write:/)).toHaveLength(0)
    })

    it("renders auto-compact estimate as 'soon' when pct >= 95", async () => {
      seedTask({ contextUsage: { used: 96000, size: 100000 }, messageCount: 4 })
      render(wrap(<ContextRing used={96000} size={100000} />))
      await hoverRing()
      expect((await screen.findAllByText(/auto-compact in soon/)).length).toBeGreaterThan(0)
    })

    it("renders auto-compact estimate as '~N turns' when pct < 95", async () => {
      // pct = 20, turnsSoFar = max(1, floor(10/2)) = 5, avgPctPerTurn = 4,
      // turnsUntilCompact = floor((100-20)/4) = 20 -> "~20 turns"
      seedTask({ contextUsage: { used: 20000, size: 100000 }, messageCount: 10 })
      render(wrap(<ContextRing used={20000} size={100000} />))
      await hoverRing()
      expect((await screen.findAllByText(/auto-compact in ~\d+ turns/)).length).toBeGreaterThan(0)
    })

    it('renders cost row when totalCost > 0', async () => {
      seedTask({ contextUsage: { used: 50000, size: 100000 }, totalCost: 0.42 })
      render(wrap(<ContextRing used={50000} size={100000} />))
      await hoverRing()
      // formatCost(0.42) -> '$0.420' (cost < 1 branch uses toFixed(3))
      expect((await screen.findAllByText(/cost: \$0\.420/)).length).toBeGreaterThan(0)
    })

    it('omits cost row when totalCost is 0 or undefined', async () => {
      seedTask({ contextUsage: { used: 50000, size: 100000 }, totalCost: 0 })
      render(wrap(<ContextRing used={50000} size={100000} />))
      await hoverRing()
      // Wait for the tooltip body to appear before asserting absence.
      await screen.findAllByText(/Context: \d+% used/)
      expect(screen.queryAllByText(/^cost:/)).toHaveLength(0)
    })

    it('does not render a negative or "in -1 turns" auto-compact estimate at used=0', async () => {
      // pct=0, no messages -> turnsSoFar=1, avgPctPerTurn=0 -> fallback path,
      // turnsUntilCompact must be a non-negative integer (or 'soon').
      seedTask({ contextUsage: { used: 0, size: 100 } })
      render(wrap(<ContextRing used={0} size={100} />))
      await hoverRing()
      const bodies = await screen.findAllByText(/Context: 0% used/)
      // Pick the visible tooltip body (not the screen-reader span) and check its parent.
      const tooltipBody = bodies[0]
      const text = tooltipBody.parentElement?.textContent ?? ''
      expect(text).not.toMatch(/-\d+/)
      expect(text).not.toMatch(/in -1/)
    })
  })
})
