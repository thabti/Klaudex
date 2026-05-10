import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalyticsEvent } from '@/lib/ipc'
import { useSettingsStore } from '@/stores/settingsStore'
import { ModelPopularityChart } from './ModelPopularityChart'

/**
 * TASK-049 — Smoke tests for ModelPopularityChart (TASK-030).
 *
 * Prop signature: `{ events: AnalyticsEvent[] }`. Also reads the settings
 * store's `availableModels` to convert model IDs into display labels — known
 * IDs use `name`, unknown IDs render with " (legacy)" suffix.
 */

const modelEv = (modelId: string): AnalyticsEvent => ({
  ts: Date.now(),
  kind: 'model_used',
  detail: modelId,
})

beforeEach(() => {
  useSettingsStore.setState({
    availableModels: [
      { modelId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: null },
      { modelId: 'claude-opus-4-7', name: 'Claude Opus 4.7', description: null },
    ],
  })
})

describe('ModelPopularityChart', () => {
  it('renders the empty state when no events (smoke)', () => {
    render(<ModelPopularityChart events={[]} />)
    expect(screen.getByRole('heading', { name: /model popularity/i })).toBeInTheDocument()
    expect(screen.getByText(/no model data yet/i)).toBeInTheDocument()
  })

  it('renders one row per model when populated, sorted by count desc', () => {
    const events = [
      modelEv('claude-sonnet-4-6'),
      modelEv('claude-sonnet-4-6'),
      modelEv('claude-opus-4-7'),
    ]
    render(<ModelPopularityChart events={events} />)
    expect(screen.getByText('Claude Sonnet 4.6')).toBeInTheDocument()
    expect(screen.getByText('Claude Opus 4.7')).toBeInTheDocument()
    // Each row has a progressbar with the label.
    expect(
      screen.getByRole('progressbar', { name: 'Claude Sonnet 4.6' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Claude Opus 4.7' }),
    ).toBeInTheDocument()
  })

  it('annotates unknown model IDs with the (legacy) suffix', () => {
    render(<ModelPopularityChart events={[modelEv('claude-haiku-old')]} />)
    expect(screen.getByText('claude-haiku-old (legacy)')).toBeInTheDocument()
  })
})
