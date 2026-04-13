import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DragOverlay } from './DragOverlay'

describe('DragOverlay', () => {
  it('renders drop text', () => {
    render(<DragOverlay visible />)
    expect(screen.getByText('Drop files here')).toBeInTheDocument()
  })
  it('renders file type hint', () => {
    render(<DragOverlay visible />)
    expect(screen.getByText('Images, code, documents')).toBeInTheDocument()
  })
})
