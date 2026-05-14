import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSkillsPaletteStore } from '@/stores/skillsPaletteStore'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import type { ClaudeSkill, ClaudeConfig } from '@/types'

// Mock the invocation hook BEFORE importing SkillsPalette so the mock is in
// place when the component module is evaluated. The factory returns a stable
// `invokeSpy` reference; tests inspect/reset it via the imported binding.
const invokeSpy = vi.fn()
vi.mock('@/hooks/useSkillInvoke', () => ({
  useSkillInvoke: () => invokeSpy,
}))

// eslint-disable-next-line import/first
import { SkillsPalette } from './SkillsPalette'

const wrap = (ui: ReactNode) => <TooltipProvider>{ui}</TooltipProvider>

const EMPTY_CONFIG: ClaudeConfig = {
  agents: [],
  commands: [],
  skills: [],
  steeringRules: [],
  memoryFiles: [],
  mcpServers: [],
  prompts: [],
}

/** Inject a skills fixture into the active claudeConfigStore config. */
const seedSkills = (skills: ClaudeSkill[]): void => {
  useClaudeConfigStore.setState({
    activeProject: '__test__',
    config: { ...EMPTY_CONFIG, skills },
    configs: { __test__: { ...EMPTY_CONFIG, skills } },
    loaded: true,
    loading: false,
  } as unknown as Partial<ReturnType<typeof useClaudeConfigStore.getState>>)
}

const openPalette = (): void => {
  // Use the store's setState directly — bypasses bail-out guards which is
  // fine for tests because we want a deterministic starting state.
  useSkillsPaletteStore.setState({ isOpen: true, query: '', selectedIndex: 0 })
}

const makeSkill = (overrides: Partial<ClaudeSkill> & { name: string }): ClaudeSkill => ({
  source: 'global',
  filePath: `/skills/${overrides.name}.md`,
  ...overrides,
})

describe('SkillsPalette', () => {
  beforeEach(() => {
    invokeSpy.mockClear()
    useSkillsPaletteStore.setState({ isOpen: false, query: '', selectedIndex: 0 })
    useClaudeConfigStore.setState({
      activeProject: null,
      config: EMPTY_CONFIG,
      configs: {},
      loaded: false,
      loading: false,
    } as unknown as Partial<ReturnType<typeof useClaudeConfigStore.getState>>)
  })

  it('renders nothing when isOpen is false', () => {
    seedSkills([makeSkill({ name: 'commit' })])
    render(wrap(<SkillsPalette />))
    // Radix Dialog is unmounted entirely when closed (no portal in the DOM).
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByLabelText('Search skills')).toBeNull()
  })

  it('renders dialog content when isOpen is true', () => {
    seedSkills([makeSkill({ name: 'commit', description: 'Stage and commit' })])
    openPalette()
    render(wrap(<SkillsPalette />))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Search skills')).toBeInTheDocument()
    // The skill card should render the skill's name.
    expect(screen.getAllByText('commit').length).toBeGreaterThan(0)
  })

  it('fuzzy filter ranks exact-prefix matches highest', async () => {
    const user = userEvent.setup()
    seedSkills([
      // Intentionally seed in reverse order so we can prove the sort actually
      // happens (rather than relying on input order).
      makeSkill({ name: 'cost-estimate' }),
      makeSkill({ name: 'commit' }),
    ])
    openPalette()
    render(wrap(<SkillsPalette />))

    const input = screen.getByLabelText('Search skills')
    await user.type(input, 'com')

    // Both cards must still be visible.
    const commitButton = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('commit') && !el.textContent.includes('cost'))
    const costButton = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('cost-estimate'))

    expect(commitButton).toBeDefined()
    expect(costButton).toBeDefined()

    // `commit` (startsWith → score 1) should precede `cost-estimate`
    // (contains at index 0 but longer/subsequence path → higher score).
    // compareDocumentPosition returns DOCUMENT_POSITION_FOLLOWING (4) when
    // `costButton` follows `commitButton` in document order.
    const position = commitButton!.compareDocumentPosition(costButton!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('ArrowDown advances selectedIndex and clamps at the last item', async () => {
    const user = userEvent.setup()
    seedSkills([
      makeSkill({ name: 'alpha' }),
      makeSkill({ name: 'bravo' }),
      makeSkill({ name: 'charlie' }),
    ])
    openPalette()
    render(wrap(<SkillsPalette />))

    const input = screen.getByLabelText('Search skills')
    input.focus()

    expect(useSkillsPaletteStore.getState().selectedIndex).toBe(0)

    await user.keyboard('{ArrowDown}')
    expect(useSkillsPaletteStore.getState().selectedIndex).toBe(1)

    await user.keyboard('{ArrowDown}')
    expect(useSkillsPaletteStore.getState().selectedIndex).toBe(2)

    // Press ArrowDown beyond the last item — store should clamp to index 2.
    await user.keyboard('{ArrowDown}')
    expect(useSkillsPaletteStore.getState().selectedIndex).toBe(2)

    // ArrowUp should walk back.
    await user.keyboard('{ArrowUp}')
    expect(useSkillsPaletteStore.getState().selectedIndex).toBe(1)
  })

  it('pressing Enter invokes the selected skill exactly once', async () => {
    const user = userEvent.setup()
    const skill = makeSkill({ name: 'commit', description: 'Commit changes' })
    seedSkills([skill])
    openPalette()
    render(wrap(<SkillsPalette />))

    const input = screen.getByLabelText('Search skills')
    input.focus()
    await user.keyboard('{Enter}')

    expect(invokeSpy).toHaveBeenCalledTimes(1)
    // The component invokes with the full skill object (same identity is fine
    // because we control the fixture, but match by shape for resilience).
    expect(invokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'commit', source: 'global' }),
    )
  })

  it('pressing Escape closes the palette', async () => {
    const user = userEvent.setup()
    seedSkills([makeSkill({ name: 'commit' })])
    openPalette()
    render(wrap(<SkillsPalette />))

    const input = screen.getByLabelText('Search skills')
    input.focus()
    await user.keyboard('{Escape}')

    expect(useSkillsPaletteStore.getState().isOpen).toBe(false)
  })

  it('shows empty state when no skills match the query', async () => {
    const user = userEvent.setup()
    seedSkills([makeSkill({ name: 'commit' })])
    openPalette()
    render(wrap(<SkillsPalette />))

    const input = screen.getByLabelText('Search skills')
    await user.type(input, 'xyznoresult')

    // Use findAllByText for the dual-render Radix safe pattern, even though
    // this string lives outside the tooltip system — keeps the pattern uniform.
    const empty = await screen.findAllByText(/No skills match/)
    expect(empty.length).toBeGreaterThan(0)
  })

  it('store toggle() flips isOpen (proxy for Cmd+K wiring)', () => {
    // The actual Cmd+K binding lives in `useKeyboardShortcuts`, which is
    // wired into App.tsx and excluded from coverage. The hook's only contract
    // with this component is `useSkillsPaletteStore.getState().toggle()`, so
    // we verify the store action directly. Full integration is covered by
    // the keyboard hook tests + manual smoke.
    expect(useSkillsPaletteStore.getState().isOpen).toBe(false)
    act(() => {
      useSkillsPaletteStore.getState().toggle()
    })
    expect(useSkillsPaletteStore.getState().isOpen).toBe(true)
    act(() => {
      useSkillsPaletteStore.getState().toggle()
    })
    expect(useSkillsPaletteStore.getState().isOpen).toBe(false)
  })

  it('renders skills without description/bodyExcerpt without throwing', () => {
    // Failure-case: a skill that omits both optional preview sources should
    // still render — `truncatePreview` should fall back to `filePath`, and
    // the file-path line is suppressed because `previewSource === filePath`.
    seedSkills([
      { name: 'foo', source: 'global', filePath: '/x' },
    ])
    openPalette()
    expect(() => render(wrap(<SkillsPalette />))).not.toThrow()
    expect(screen.getAllByText('foo').length).toBeGreaterThan(0)
    // The card button must be present and accessible as an option.
    expect(screen.getByRole('option', { name: /foo/i })).toBeInTheDocument()
  })
})
