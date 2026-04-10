import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueuedMessages } from './QueuedMessages'
import { TooltipProvider } from '@/components/ui/tooltip'

const wrap = (ui: React.ReactNode) => <TooltipProvider>{ui}</TooltipProvider>

describe('QueuedMessages', () => {
  it('returns null for empty messages', () => {
    const { container } = render(wrap(<QueuedMessages messages={[]} onRemove={vi.fn()} />))
    expect(container.querySelector('.flex.flex-col')).toBeNull()
  })

  it('renders queued messages', () => {
    render(wrap(<QueuedMessages messages={['msg1', 'msg2']} onRemove={vi.fn()} />))
    expect(screen.getByText('msg1')).toBeInTheDocument()
    expect(screen.getByText('msg2')).toBeInTheDocument()
    expect(screen.getByText('Queued (2)')).toBeInTheDocument()
  })

  it('calls onRemove when trash clicked', () => {
    const onRemove = vi.fn()
    render(wrap(<QueuedMessages messages={['msg1']} onRemove={onRemove} />))
    fireEvent.click(screen.getByLabelText('Remove queued message 1'))
    expect(onRemove).toHaveBeenCalledWith(0)
  })
})
