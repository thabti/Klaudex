import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WorkingRow } from './WorkingRow'

describe('WorkingRow', () => {
  it('renders with working data attribute', () => {
    const { container } = render(<WorkingRow />)
    expect(container.querySelector('[data-timeline-row-kind="working"]')).toBeInTheDocument()
  })

  it('shows a loading word', () => {
    const { container } = render(<WorkingRow />)
    expect(container.textContent).toMatch(/\w+/)
  })
})
