import { describe, it, expect } from 'vitest'
import { calculateBackoffDelay } from './connection-health'

describe('calculateBackoffDelay', () => {
  it('returns base delay for first attempt', () => {
    // With jitter, should be within ±25% of base
    const delay = calculateBackoffDelay(0, 1000, 30000)
    expect(delay).toBeGreaterThanOrEqual(750)
    expect(delay).toBeLessThanOrEqual(1250)
  })

  it('doubles delay for each attempt', () => {
    // attempt 1: ~2000ms, attempt 2: ~4000ms, attempt 3: ~8000ms
    const d1 = calculateBackoffDelay(1, 1000, 30000)
    const d2 = calculateBackoffDelay(2, 1000, 30000)
    // d2 should be roughly double d1 (within jitter range)
    expect(d2).toBeGreaterThan(d1 * 0.8)
  })

  it('clamps to max delay', () => {
    const delay = calculateBackoffDelay(10, 1000, 5000)
    // Should never exceed max + 25% jitter
    expect(delay).toBeLessThanOrEqual(6250)
  })

  it('never returns negative', () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoffDelay(i, 100, 1000)
      expect(delay).toBeGreaterThanOrEqual(0)
    }
  })
})
