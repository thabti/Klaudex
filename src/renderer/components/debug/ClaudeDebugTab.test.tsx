import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * Tests for `ClaudeDebugTab` (TASK-048).
 *
 * SUT: src/renderer/components/debug/ClaudeDebugTab.tsx
 *
 * The component:
 *   - Renders the filter bar (search input, category select, errors checkbox,
 *     count, copy-all, clear-log).
 *   - Shows "No debug entries yet" when entries are empty.
 *   - Shows "No matches" when entries exist but the filter excludes them.
 *   - Clicking the trash button calls `useDebugStore.clear()`.
 *
 * `useTaskStore` is mocked because the real module pulls in ipc/history-store
 * /debug-logger which require Tauri runtime. The real `useDebugStore` is used
 * because it is dependency-free.
 */

// Mock useTaskStore so we don't drag in the full ipc graph. The component only
// uses it to look up `tasks[entry.taskId]` for thread/project filter dropdowns.
vi.mock('@/stores/taskStore', () => ({
  useTaskStore: <T,>(selector?: (s: { tasks: Record<string, never> }) => T) => {
    const state = { tasks: {} as Record<string, never> }
    return selector ? selector(state) : state
  },
}))

import { ClaudeDebugTab } from './ClaudeDebugTab'
import { useDebugStore } from '@/stores/debugStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { DebugLogEntry } from '@/types'

const renderTab = (ui: ReactElement = <ClaudeDebugTab />) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

const makeEntry = (over: Partial<DebugLogEntry> = {}): DebugLogEntry => ({
  id: Math.floor(Math.random() * 1e9),
  timestamp: new Date().toISOString(),
  direction: 'in',
  category: 'event',
  type: 'session/init',
  taskId: null,
  summary: 'session initialised',
  payload: { hello: 'world' },
  isError: false,
  ...over,
})

const seedDebugStore = (entries: DebugLogEntry[]): void => {
  useDebugStore.setState({
    entries,
    isOpen: false,
    filter: {
      search: '',
      category: 'all',
      errorsOnly: false,
      threadName: '',
      projectName: '',
      mcpServerName: '',
    },
  })
}

describe('ClaudeDebugTab', () => {
  beforeEach(() => {
    seedDebugStore([])
  })

  it('shows the empty state when there are no debug entries', () => {
    renderTab()
    expect(screen.getByText(/no debug entries yet/i)).toBeInTheDocument()
  })

  it('renders the filter bar (search input + category dropdown)', () => {
    renderTab()
    const search = screen.getByPlaceholderText(/filter\.\.\./i) as HTMLInputElement
    expect(search).toBeInTheDocument()
    expect(search.value).toBe('')

    // The category <select> renders 'All types' as the first option label.
    expect(screen.getByText(/all types/i)).toBeInTheDocument()
  })

  it('shows the count in "filtered/total" form (smoke render with entries)', () => {
    seedDebugStore([
      makeEntry({ id: 1, type: 'a' }),
      makeEntry({ id: 2, type: 'b' }),
    ])
    renderTab()
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  it('shows "No matches" when a filter excludes all entries', () => {
    seedDebugStore([
      makeEntry({ id: 1, type: 'session/init', summary: 'normal' }),
    ])
    renderTab()

    // Type into the filter input to drive `setFilter({ search })`.
    const search = screen.getByPlaceholderText(/filter\.\.\./i) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'definitely-not-present-xyz' } })

    expect(screen.getByText(/no matches/i)).toBeInTheDocument()
    expect(screen.getByText('0/1')).toBeInTheDocument()
  })

  it('clicking the clear (trash) button empties the debug store', () => {
    seedDebugStore([
      makeEntry({ id: 1 }),
      makeEntry({ id: 2 }),
    ])
    const { container } = renderTab(<ClaudeDebugTab />)
    expect(useDebugStore.getState().entries).toHaveLength(2)

    // The clear button has a trash icon (Tabler renders class `tabler-icon-trash`)
    // and no accessible name. Walk up from the icon to find the button.
    const trashIcon = container.querySelector('.tabler-icon-trash') as HTMLElement | null
    expect(trashIcon).not.toBeNull()
    const clearBtn = trashIcon?.closest('button') as HTMLButtonElement
    expect(clearBtn).not.toBeNull()

    fireEvent.click(clearBtn)
    expect(useDebugStore.getState().entries).toHaveLength(0)
  })

  it('toggling the "Errors only" checkbox flips the filter in the store', () => {
    seedDebugStore([makeEntry({ id: 1, isError: false })])
    renderTab()

    // The errors checkbox is the only input[type=checkbox] in the filter bar.
    const errorsCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(errorsCheckbox.checked).toBe(false)

    fireEvent.click(errorsCheckbox)
    expect(useDebugStore.getState().filter.errorsOnly).toBe(true)
  })
})
