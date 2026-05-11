import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AppSettings } from '@/types'

/**
 * NOTE: We use `fireEvent` (not `@testing-library/user-event`) because Klaudex
 * does not depend on `@testing-library/user-event`. Other tests in the suite
 * (`header-toolbar.test.tsx`, `AcpSubagentDisplay.test.tsx`) follow the same
 * pattern. `fireEvent` is sufficient for the synthetic events here — the SUT
 * uses native `<button>` / `<input>` / `<select>` and reads `e.key` / `e.target.value`
 * directly, which `fireEvent` populates correctly.
 */

/**
 * Tests for `permissions-section.tsx` (TASK-117).
 *
 * The SUT is purely prop-driven — it accepts `settings` and `updateDraft` as
 * props (no `useSettingsStore` selector reads). This means the test file
 * doesn't need to mock the settings store; we just supply props directly and
 * assert on the patches passed to `updateDraft`. The plan's mock-strategy
 * stub assumed a store-coupled component, but the actual SUT shipped in
 * TASK-106 follows the same controlled-input pattern as `memory-section.tsx`
 * — see SUT comment at lines 261–268.
 *
 * The Rust backend (commands/settings.rs) handles the Tauri round-trip; in
 * the real wiring `SettingsPanel.tsx` translates `updateDraft({ permissions })`
 * into a `saveSettings` IPC call. That layer is out of scope here — pattern
 * matching tests live in `src-tauri/src/commands/permissions.rs`.
 */

// ── Mocks for transitive deps ────────────────────────────────────────
//
// `cn` is replaced with a simple class-joiner. The real version pulls in
// `tailwind-merge`, which is fine but slow under jsdom; the toolbar test
// uses the same shim.
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) =>
    args
      .flat(Infinity as number)
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join(' '),
}))

// Tooltip primitives wrap children in Radix portals; we flatten them so the
// import-button text is reachable via `getByRole`.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

// SUT relies on a couple of layout helpers from `settings-shared`. They're
// pure JSX and don't touch any external state, so we let the real exports run.

import { PermissionsSection, type Permissions } from './permissions-section'

// ── Helpers ──────────────────────────────────────────────────────────

const baseSettings: AppSettings = {
  claudeBin: 'claude',
  agentProfiles: [],
  fontSize: 14,
}

const buildSettings = (perms?: Permissions): AppSettings & { permissions?: Permissions } => ({
  ...baseSettings,
  ...(perms ? { permissions: perms } : {}),
})

const renderSUT = (perms?: Permissions) => {
  const updateDraft = vi.fn()
  const utils = render(
    <PermissionsSection
      settings={buildSettings(perms) as AppSettings}
      updateDraft={updateDraft}
    />,
  )
  return { ...utils, updateDraft }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────

describe('PermissionsSection', () => {
  it('renders all three modes in the radio group with default ask selected', () => {
    renderSUT({ mode: 'ask', allow: [], deny: [] })

    const group = screen.getByRole('radiogroup', { name: /permission mode/i })
    expect(group).toBeInTheDocument()
    expect(within(group).getByText('Always ask')).toBeInTheDocument()
    expect(within(group).getByText('Allow listed only')).toBeInTheDocument()
    expect(within(group).getByText('Bypass')).toBeInTheDocument()

    // 3 radios, exactly one (ask) checked
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0]).toHaveTextContent('Always ask')
  })

  it('switching mode triggers updateDraft with the new permission mode', () => {
    const { updateDraft } = renderSUT({ mode: 'ask', allow: ['Bash(ls)'], deny: ['Bash(rm)'] })

    const group = screen.getByRole('radiogroup', { name: /permission mode/i })
    const bypassRadio = within(group).getByText('Bypass').closest('button')!
    fireEvent.click(bypassRadio)

    expect(updateDraft).toHaveBeenCalledTimes(1)
    expect(updateDraft).toHaveBeenCalledWith({
      permissions: { mode: 'bypass', allow: ['Bash(ls)'], deny: ['Bash(rm)'] },
    })
  })

  it('clicking the currently-selected mode does NOT call updateDraft (bail-out)', () => {
    const { updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })

    const group = screen.getByRole('radiogroup', { name: /permission mode/i })
    const askRadio = within(group).getByText('Always ask').closest('button')!
    fireEvent.click(askRadio)

    expect(updateDraft).not.toHaveBeenCalled()
  })

  it('adding an allow rule via the form: opens editor, picks tool, types pattern, presses Enter', () => {
    const { updateDraft } = renderSUT({ mode: 'allowListed', allow: [], deny: [] })

    // The empty state shows "No allow rules." and an "Add rule" button per list.
    expect(screen.getByText('No allow rules.')).toBeInTheDocument()

    // There are two "Add rule" buttons (allow + deny). Allow is the first one
    // in document order — grab via getAllByRole and index.
    const addButtons = screen.getAllByRole('button', { name: /add rule/i })
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(addButtons[0]!)

    // Editor opens — pattern input is auto-focused with aria-label.
    const patternInput = screen.getByLabelText(/permission pattern/i)
    expect(patternInput).toBeInTheDocument()

    // Tool dropdown defaults to Bash.
    const toolSelect = screen.getByLabelText(/permission tool/i) as HTMLSelectElement
    expect(toolSelect.value).toBe('Bash')

    fireEvent.change(patternInput, { target: { value: 'npm test:*' } })
    fireEvent.keyDown(patternInput, { key: 'Enter' })

    expect(updateDraft).toHaveBeenCalledTimes(1)
    expect(updateDraft).toHaveBeenCalledWith({
      permissions: { mode: 'allowListed', allow: ['Bash(npm test:*)'], deny: [] },
    })
  })

  it('removing an allow rule emits an updateDraft with the rule filtered out', () => {
    const { updateDraft } = renderSUT({
      mode: 'allowListed',
      allow: ['Bash(npm test:*)', 'Read(./src/**)'],
      deny: [],
    })

    // The row's remove button has an explicit aria-label.
    const removeBtn = screen.getByRole('button', { name: /remove allow rule bash\(npm test:\*\)/i })
    fireEvent.click(removeBtn)

    expect(updateDraft).toHaveBeenCalledTimes(1)
    expect(updateDraft).toHaveBeenCalledWith({
      permissions: { mode: 'allowListed', allow: ['Read(./src/**)'], deny: [] },
    })
  })

  it('adding a deny rule lands in deny array, not allow', () => {
    const { updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })

    // Two "Add rule" buttons in DOM order: allow (index 0), deny (index 1).
    const addButtons = screen.getAllByRole('button', { name: /add rule/i })
    fireEvent.click(addButtons[1]!)

    const patternInput = screen.getByLabelText(/permission pattern/i)
    fireEvent.change(patternInput, { target: { value: 'rm:*' } })
    fireEvent.keyDown(patternInput, { key: 'Enter' })

    expect(updateDraft).toHaveBeenCalledTimes(1)
    expect(updateDraft).toHaveBeenCalledWith({
      permissions: { mode: 'ask', allow: [], deny: ['Bash(rm:*)'] },
    })
  })

  it('Bypass mode renders the warning banner with correct alert role', () => {
    renderSUT({ mode: 'bypass', allow: ['Read(./**)'], deny: ['Bash(rm)'] })

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/bypassing permissions/i)
    expect(alert).toHaveTextContent(/auto-approved/i)
  })

  it('non-bypass modes do NOT render the warning banner', () => {
    const { rerender, updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })
    expect(screen.queryByRole('alert')).toBeNull()

    rerender(
      <PermissionsSection
        settings={buildSettings({ mode: 'allowListed', allow: [], deny: [] }) as AppSettings}
        updateDraft={updateDraft}
      />,
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('failure-case: empty allow + empty deny + Bypass renders without crash AND shows the safeguard hint', () => {
    expect(() => renderSUT({ mode: 'bypass', allow: [], deny: [] })).not.toThrow()

    // Both list empty-states render
    expect(screen.getByText('No allow rules.')).toBeInTheDocument()
    expect(screen.getByText('No deny rules.')).toBeInTheDocument()

    // The amber warning copy specific to "no rules + bypass" is visible
    expect(
      screen.getByText(/no rules configured\. every tool call will be auto-approved/i),
    ).toBeInTheDocument()
  })

  it('Import button is present and disabled (placeholder for TASK-116)', () => {
    renderSUT({ mode: 'ask', allow: [], deny: [] })

    const importBtn = screen.getByRole('button', { name: /import/i })
    expect(importBtn).toBeInTheDocument()
    // Placeholder remains disabled until TASK-116 wires the IPC.
    expect(importBtn).toBeDisabled()
    expect(importBtn).toHaveAttribute('aria-disabled', 'true')
  })

  it('cancelling the editor with Escape closes it without calling updateDraft', async () => {
    const user = userEvent.setup()
    const { updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })

    const addButtons = screen.getAllByRole('button', { name: /add rule/i })
    await user.click(addButtons[0]!)

    const patternInput = screen.getByLabelText(/permission pattern/i)
    await user.type(patternInput, 'something')
    await user.keyboard('{Escape}')

    // Editor is gone, no patch emitted.
    expect(screen.queryByLabelText(/permission pattern/i)).toBeNull()
    expect(updateDraft).not.toHaveBeenCalled()
  })

  it('rejects empty patterns: pressing Enter with whitespace-only input is a no-op', async () => {
    const user = userEvent.setup()
    const { updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })

    const addButtons = screen.getAllByRole('button', { name: /add rule/i })
    await user.click(addButtons[0]!)

    const patternInput = screen.getByLabelText(/permission pattern/i)
    await user.type(patternInput, '   ')
    await user.keyboard('{Enter}')

    // Editor stays open (canSubmit is false), no patch emitted.
    expect(screen.queryByLabelText(/permission pattern/i)).not.toBeNull()
    expect(updateDraft).not.toHaveBeenCalled()
  })

  it('selecting a different tool in the dropdown then submitting persists the chosen tool', async () => {
    const user = userEvent.setup()
    const { updateDraft } = renderSUT({ mode: 'ask', allow: [], deny: [] })

    const addButtons = screen.getAllByRole('button', { name: /add rule/i })
    await user.click(addButtons[0]!)

    const toolSelect = screen.getByLabelText(/permission tool/i) as HTMLSelectElement
    await user.selectOptions(toolSelect, 'Read')
    expect(toolSelect.value).toBe('Read')

    const patternInput = screen.getByLabelText(/permission pattern/i)
    await user.type(patternInput, './src/**')
    await user.keyboard('{Enter}')

    expect(updateDraft).toHaveBeenCalledWith({
      permissions: { mode: 'ask', allow: ['Read(./src/**)'], deny: [] },
    })
  })

  it('renders existing allow + deny rules with their tool/args parsed in the row', () => {
    renderSUT({
      mode: 'allowListed',
      allow: ['Bash(npm test:*)'],
      deny: ['Bash(rm -rf /)'],
    })

    // Tool tag + parenthesised args appear together in each row. We assert
    // both halves, which also confirms the parseRule regex is working.
    expect(screen.getAllByText('Bash')).toHaveLength(2)
    expect(screen.getByText('(npm test:*)')).toBeInTheDocument()
    expect(screen.getByText('(rm -rf /)')).toBeInTheDocument()
  })
})
