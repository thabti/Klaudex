import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueuedMessages } from './QueuedMessages'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { QueuedMessage } from '@/stores/task-store-types'

const wrap = (ui: React.ReactNode) => <TooltipProvider>{ui}</TooltipProvider>

describe('QueuedMessages', () => {
  it('returns null for empty messages', () => {
    const { container } = render(wrap(<QueuedMessages messages={[]} onRemove={vi.fn()} />))
    expect(container.querySelector('.flex.flex-col')).toBeNull()
  })

  it('renders queued messages', () => {
    const messages: QueuedMessage[] = [{ text: 'msg1' }, { text: 'msg2' }]
    render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} />))
    expect(screen.getByText('msg1')).toBeInTheDocument()
    expect(screen.getByText('msg2')).toBeInTheDocument()
    expect(screen.getByText('Queued (2)')).toBeInTheDocument()
  })

  it('calls onRemove when trash clicked', () => {
    const onRemove = vi.fn()
    render(wrap(<QueuedMessages messages={[{ text: 'msg1' }]} onRemove={onRemove} />))
    fireEvent.click(screen.getByLabelText('Remove queued message 1'))
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('shows image indicator when attachments present', () => {
    const messages: QueuedMessage[] = [
      { text: 'check this', attachments: [{ base64: 'abc', mimeType: 'image/png', name: 'img.png' }] },
    ]
    render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} />))
    expect(screen.getByLabelText('1 image attached')).toBeInTheDocument()
    expect(screen.getByText('check this')).toBeInTheDocument()
  })

  it('shows fallback text for image-only messages', () => {
    const messages: QueuedMessage[] = [
      { text: '', attachments: [{ base64: 'abc', mimeType: 'image/png', name: 'img.png' }] },
    ]
    render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} />))
    expect(screen.getByText('Image attachment')).toBeInTheDocument()
  })

  describe('onEdit', () => {
    it('renders edit button when onEdit is provided', () => {
      render(wrap(<QueuedMessages messages={[{ text: 'hello' }]} onRemove={vi.fn()} onEdit={vi.fn()} />))
      expect(screen.getByLabelText('Edit queued message 1')).toBeInTheDocument()
    })

    it('does not render edit button when onEdit is omitted', () => {
      render(wrap(<QueuedMessages messages={[{ text: 'hello' }]} onRemove={vi.fn()} />))
      expect(screen.queryByLabelText('Edit queued message 1')).toBeNull()
    })

    it('calls onEdit with correct index when clicked', () => {
      const onEdit = vi.fn()
      const messages: QueuedMessage[] = [{ text: 'first' }, { text: 'second' }]
      render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} onEdit={onEdit} />))
      fireEvent.click(screen.getByLabelText('Edit queued message 2'))
      expect(onEdit).toHaveBeenCalledWith(1)
    })

    it('renders one edit button per queued message', () => {
      const messages: QueuedMessage[] = [{ text: 'a' }, { text: 'b' }, { text: 'c' }]
      render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} onEdit={vi.fn()} />))
      expect(screen.getAllByRole('button', { name: /Edit queued message/ })).toHaveLength(3)
    })
  })

  describe('reorder buttons', () => {
    it('renders reorder buttons when 2+ messages and onReorder provided', () => {
      const messages: QueuedMessage[] = [{ text: 'a' }, { text: 'b' }]
      render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} onReorder={vi.fn()} />))
      expect(screen.getByLabelText('Move "a" up')).toBeInTheDocument()
      expect(screen.getByLabelText('Move "a" down')).toBeInTheDocument()
    })

    it('does not render reorder buttons for single message', () => {
      render(wrap(<QueuedMessages messages={[{ text: 'only' }]} onRemove={vi.fn()} onReorder={vi.fn()} />))
      expect(screen.queryByLabelText(/Move/)).toBeNull()
    })

    it('calls onReorder with correct indices', () => {
      const onReorder = vi.fn()
      const messages: QueuedMessage[] = [{ text: 'first' }, { text: 'second' }]
      render(wrap(<QueuedMessages messages={messages} onRemove={vi.fn()} onReorder={onReorder} />))
      fireEvent.click(screen.getByLabelText('Move "second" up'))
      expect(onReorder).toHaveBeenCalledWith(1, 0)
    })
  })

  describe('steer button', () => {
    it('renders steer button when onSteer provided', () => {
      render(wrap(<QueuedMessages messages={[{ text: 'steer me' }]} onRemove={vi.fn()} onSteer={vi.fn()} />))
      expect(screen.getByText('Steer')).toBeInTheDocument()
    })

    it('calls onSteer with correct index', () => {
      const onSteer = vi.fn()
      render(wrap(<QueuedMessages messages={[{ text: 'msg' }]} onRemove={vi.fn()} onSteer={onSteer} />))
      fireEvent.click(screen.getByText('Steer'))
      expect(onSteer).toHaveBeenCalledWith(0)
    })
  })
})
