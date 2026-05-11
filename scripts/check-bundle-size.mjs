#!/usr/bin/env node
/**
 * Bundle size monitor — checks dist/assets/*.js against bundle-budget.json.
 * Exit 1 if any chunk exceeds its budget.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const DIST_DIR = join(import.meta.dirname, '..', 'dist', 'assets')
const BUDGET_FILE = join(import.meta.dirname, '..', 'bundle-budget.json')

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf-8'))
const budgets = budget.budgets
const totalBudget = budget.totalBudget

let totalSize = 0
let failures = []
let report = []

let files
try {
  files = readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'))
} catch {
  console.error('❌ dist/assets/ not found. Run `npx vite build` first.')
  process.exit(1)
}

for (const file of files) {
  const size = statSync(join(DIST_DIR, file)).size
  totalSize += size

  for (const [chunkName, maxSize] of Object.entries(budgets)) {
    if (file.includes(chunkName)) {
      const status = size <= maxSize ? '✅' : '❌'
      const pct = ((size / maxSize) * 100).toFixed(0)
      report.push({ chunkName, file, size, maxSize, status, pct })
      if (size > maxSize) {
        failures.push(`${chunkName}: ${(size / 1024).toFixed(1)} KB > ${(maxSize / 1024).toFixed(1)} KB budget`)
      }
      break
    }
  }
}

console.log('\n📦 Bundle Size Report\n')
console.log('Chunk'.padEnd(20), 'Size'.padEnd(12), 'Budget'.padEnd(12), 'Usage'.padEnd(8), 'Status')
console.log('─'.repeat(64))

for (const r of report.sort((a, b) => b.size - a.size)) {
  console.log(
    r.chunkName.padEnd(20),
    `${(r.size / 1024).toFixed(1)} KB`.padEnd(12),
    `${(r.maxSize / 1024).toFixed(1)} KB`.padEnd(12),
    `${r.pct}%`.padEnd(8),
    r.status,
  )
}

console.log('─'.repeat(64))
const totalStatus = totalSize <= totalBudget ? '✅' : '❌'
console.log(
  'TOTAL JS'.padEnd(20),
  `${(totalSize / 1024).toFixed(1)} KB`.padEnd(12),
  `${(totalBudget / 1024).toFixed(1)} KB`.padEnd(12),
  `${((totalSize / totalBudget) * 100).toFixed(0)}%`.padEnd(8),
  totalStatus,
)

if (totalSize > totalBudget) {
  failures.push(`Total JS: ${(totalSize / 1024).toFixed(1)} KB > ${(totalBudget / 1024).toFixed(1)} KB budget`)
}

if (failures.length > 0) {
  console.log(`\n❌ ${failures.length} budget(s) exceeded:\n`)
  for (const f of failures) console.log(`  • ${f}`)
  process.exit(1)
} else {
  console.log('\n✅ All bundles within budget.\n')
}
