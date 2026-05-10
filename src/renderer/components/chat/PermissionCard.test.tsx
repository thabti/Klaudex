import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAllow, mockDeny } = vi.hoisted(() => ({
  mockAllow: vi.fn().mockResolvedValue(undefined),
  mockDeny: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/ipc', () => ({
  ipc: {
    allowPermission: mockAllow,
    denyPermission: mockDeny,
  },
}))

import { PermissionCard } from './PermissionCard'

const baseProps = {
  taskId: 'task-1',
  requestId: 'req-1',
  toolName: 'execute_command',
  description: 'Run a shell command',
  options: [
    { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
    { optionId: 'reject-once', name: 'Reject once', kind: 'reject_once' },
  ],
}

describe('PermissionCard', () => {
  beforeEach(() => {
    mockAllow.mockClear()
    mockDeny.mockClear()
  })

  it('renders with valid permission props (smoke)', () => {
    render(<PermissionCard {...baseProps} />)
    expect(screen.getByTestId('permission-card')).toBeInTheDocument()
    expect(screen.getByText('Permission Request')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allow permission' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deny permission' })).toBeInTheDocument()
  })

  it('formats the tool name and shows description', () => {
    render(<PermissionCard {...baseProps} />)
    // formatToolName replaces _ with space and lowercases
    expect(screen.getByText(/execute command/i)).toBeInTheDocument()
    expect(screen.getByText(/Run a shell command/)).toBeInTheDocument()
  })

  it('renders command preview when input.command is provided', () => {
    render(
      <PermissionCard
        {...baseProps}
        input={{ command: 'ls -la /tmp' }}
      />,
    )
    expect(screen.getByText('ls -la /tmp')).toBeInTheDocument()
  })

  it('renders decisionReason text when provided', () => {
    render(<PermissionCard {...baseProps} decisionReason="Awaiting user approval" />)
    expect(screen.getByText('Awaiting user approval')).toBeInTheDocument()
  })

  it('falls back to "a tool" when toolName is unknown', () => {
    render(<PermissionCard {...baseProps} toolName="unknown" />)
    expect(screen.getByText(/a tool/i)).toBeInTheDocument()
  })

  it('renders fallback when description is empty', () => {
    render(<PermissionCard {...baseProps} description="" />)
    // No crash; permission card still rendered
    expect(screen.getByTestId('permission-card')).toBeInTheDocument()
  })

  it('renders even with empty options array (no crash)', () => {
    render(<PermissionCard {...baseProps} options={[]} />)
    expect(screen.getByTestId('permission-card')).toBeInTheDocument()
  })

  it('clicking Allow fires ipc.allowPermission with allow option', () => {
    render(<PermissionCard {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Allow permission' }))
    expect(mockAllow).toHaveBeenCalledWith('task-1', 'req-1', 'allow-once')
    expect(mockDeny).not.toHaveBeenCalled()
  })

  it('clicking Deny fires ipc.denyPermission with reject option', () => {
    render(<PermissionCard {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deny permission' }))
    expect(mockDeny).toHaveBeenCalledWith('task-1', 'req-1', 'reject-once')
    expect(mockAllow).not.toHaveBeenCalled()
  })
})
