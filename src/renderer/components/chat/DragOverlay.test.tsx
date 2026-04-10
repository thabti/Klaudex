import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DragOverlay } from './DragOverlay'

describe('DragOverlay', () => {
  it('renders drop text', () => {
    render(<DragOverlay />)
    expect(screen.getByText('Drop files here')).toBeInTheDocument()
  })
  it('renders file type hint', () => {
    render(<DragOverlay />)
    expect(screen.getByText('Images, code, documents')).toBeInTheDocument()
  })
})
