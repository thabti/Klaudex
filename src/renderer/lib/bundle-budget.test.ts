import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUDGET_FILE = join(__dirname, '..', '..', '..', 'bundle-budget.json')

describe('bundle-budget.json', () => {
  const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf-8'))

  it('has a budgets object with chunk names', () => {
    expect(budget.budgets).toBeDefined()
    expect(typeof budget.budgets).toBe('object')
    expect(Object.keys(budget.budgets).length).toBeGreaterThan(0)
  })

  it('all budget values are positive numbers', () => {
    for (const [_name, size] of Object.entries(budget.budgets)) {
      expect(typeof size).toBe('number')
      expect(size as number).toBeGreaterThan(0)
    }
  })

  it('has a totalBudget', () => {
    expect(budget.totalBudget).toBeDefined()
    expect(typeof budget.totalBudget).toBe('number')
    expect(budget.totalBudget).toBeGreaterThan(0)
  })

  it('totalBudget is greater than any individual chunk budget', () => {
    for (const size of Object.values(budget.budgets)) {
      expect(budget.totalBudget).toBeGreaterThanOrEqual(size as number)
    }
  })

  it('includes critical chunks', () => {
    const expected = ['vendor-react', 'index', 'vendor-shiki', 'ChatPanel']
    for (const chunk of expected) {
      expect(budget.budgets).toHaveProperty(chunk)
    }
  })
})
