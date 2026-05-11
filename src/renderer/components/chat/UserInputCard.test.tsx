import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRespond } = vi.hoisted(() => ({
  mockRespond: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/ipc', () => ({
  ipc: {
    respondUserInput: mockRespond,
  },
}))

vi.mock('@/stores/taskStore', () => {
  const setState = vi.fn()
  return {
    useTaskStore: Object.assign(() => ({}), {
      setState,
      getState: () => ({ pendingUserInputs: {} }),
    }),
  }
})

import { UserInputCard } from './UserInputCard'

describe('UserInputCard', () => {
  beforeEach(() => {
    mockRespond.mockClear()
  })

  it('renders with valid requestId and fields (smoke)', () => {
    render(
      <UserInputCard
        taskId="task-1"
        requestId="req-1"
        fields={[{ name: 'username', label: 'Username', type: 'text', required: true }]}
      />,
    )
    expect(screen.getByTestId('user-input-card')).toBeInTheDocument()
    expect(screen.getByText('Input Required')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('renders fallback (still mounts) when fields is empty', () => {
    render(<UserInputCard taskId="task-1" requestId="req-1" fields={[]} />)
    expect(screen.getByTestId('user-input-card')).toBeInTheDocument()
    // Submit button is enabled (no required fields)
    expect(screen.getByRole('button', { name: 'Submit input' })).not.toBeDisabled()
  })

  it('renders and stays mounted even with missing/empty requestId', () => {
    // Component does not guard on requestId itself; ensure no crash
    render(<UserInputCard taskId="task-1" requestId="" fields={[]} />)
    expect(screen.getByTestId('user-input-card')).toBeInTheDocument()
  })

  it('submit is disabled until required text field is filled', () => {
    render(
      <UserInputCard
        taskId="task-1"
        requestId="req-1"
        fields={[{ name: 'name', label: 'Name', type: 'text', required: true }]}
      />,
    )
    const submitBtn = screen.getByRole('button', { name: 'Submit input' })
    expect(submitBtn).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
    expect(submitBtn).not.toBeDisabled()
  })

  it('submitting fires ipc.respondUserInput with entered values', () => {
    render(
      <UserInputCard
        taskId="task-1"
        requestId="req-1"
        fields={[{ name: 'name', label: 'Name', type: 'text', required: true }]}
      />,
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit input' }))
    expect(mockRespond).toHaveBeenCalledWith('task-1', 'req-1', { name: 'Alice' })
  })

  it('renders select field with options', () => {
    render(
      <UserInputCard
        taskId="task-1"
        requestId="req-1"
        fields={[{ name: 'choice', label: 'Choice', type: 'select', options: ['A', 'B'] }]}
      />,
    )
    expect(screen.getByLabelText('Choice')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument()
  })

  it('renders boolean field as a checkbox', () => {
    render(
      <UserInputCard
        taskId="task-1"
        requestId="req-1"
        fields={[{ name: 'agree', label: 'Agree', type: 'boolean' }]}
      />,
    )
    const cb = screen.getByLabelText('Agree') as HTMLInputElement
    expect(cb).toBeInTheDocument()
    expect(cb.type).toBe('checkbox')
  })
})
