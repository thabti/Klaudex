import { describe, it, expect } from 'vitest'
import {
  tasksEqual,
  contextUsagesEqual,
  permissionsEqual,
  plansEqual,
  toolCallsEqual,
  toolCallArraysEqual,
  messagesEqual,
  stringArraysEqual,
} from './structural-equality'
import type { AgentTask, TaskMessage, ToolCall, PlanStep } from '@/types'

const makeTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: 'test-1',
  name: 'Test',
  workspace: '/home/user/project',
  status: 'paused',
  createdAt: '2024-01-01',
  messages: [],
  ...overrides,
})

const makePlanStep = (overrides: Partial<PlanStep> = {}): PlanStep => ({
  content: 'step 1',
  status: 'pending',
  priority: 'medium',
  ...overrides,
})

describe('contextUsagesEqual', () => {
  it('returns true for same reference', () => {
    const a = { used: 10, size: 100 }
    expect(contextUsagesEqual(a, a)).toBe(true)
  })

  it('returns true for equal values', () => {
    expect(contextUsagesEqual({ used: 50, size: 200 }, { used: 50, size: 200 })).toBe(true)
  })

  it('returns false for different used', () => {
    expect(contextUsagesEqual({ used: 50, size: 200 }, { used: 60, size: 200 })).toBe(false)
  })

  it('returns true for both null', () => {
    expect(contextUsagesEqual(null, null)).toBe(true)
  })

  it('returns false for one null', () => {
    expect(contextUsagesEqual({ used: 10, size: 100 }, null)).toBe(false)
  })
})

describe('permissionsEqual', () => {
  it('returns true for same requestId and fields', () => {
    const a = { requestId: 'r1', toolName: 'write', description: 'Write file' }
    const b = { requestId: 'r1', toolName: 'write', description: 'Write file' }
    expect(permissionsEqual(a, b)).toBe(true)
  })

  it('returns false for different requestId', () => {
    const a = { requestId: 'r1', toolName: 'write', description: 'Write file' }
    const b = { requestId: 'r2', toolName: 'write', description: 'Write file' }
    expect(permissionsEqual(a, b)).toBe(false)
  })

  it('returns true for both null', () => {
    expect(permissionsEqual(null, null)).toBe(true)
  })
})

describe('plansEqual', () => {
  it('returns true for same reference', () => {
    const plan: PlanStep[] = [makePlanStep()]
    expect(plansEqual(plan, plan)).toBe(true)
  })

  it('returns true for equal content', () => {
    const a: PlanStep[] = [makePlanStep({ content: 'step 1', status: 'pending' })]
    const b: PlanStep[] = [makePlanStep({ content: 'step 1', status: 'pending' })]
    expect(plansEqual(a, b)).toBe(true)
  })

  it('returns false for different status', () => {
    const a: PlanStep[] = [makePlanStep({ content: 'step 1', status: 'pending' })]
    const b: PlanStep[] = [makePlanStep({ content: 'step 1', status: 'completed' })]
    expect(plansEqual(a, b)).toBe(false)
  })

  it('returns true for both undefined', () => {
    expect(plansEqual(undefined, undefined)).toBe(true)
  })

  it('returns false for different lengths', () => {
    const a: PlanStep[] = [makePlanStep()]
    const b: PlanStep[] = [makePlanStep(), makePlanStep({ content: 'step 2' })]
    expect(plansEqual(a, b)).toBe(false)
  })
})

describe('toolCallsEqual', () => {
  it('returns true for equal tool calls with same content reference', () => {
    const content = [{ type: 'content' as const, text: 'done' }]
    const a: ToolCall = { toolCallId: 'tc1', status: 'completed', title: 'Edit', content, kind: 'edit' }
    const b: ToolCall = { toolCallId: 'tc1', status: 'completed', title: 'Edit', content, kind: 'edit' }
    expect(toolCallsEqual(a, b)).toBe(true)
  })

  it('returns true for tool calls with no content', () => {
    const a: ToolCall = { toolCallId: 'tc1', status: 'completed', title: 'Edit', kind: 'edit' }
    const b: ToolCall = { toolCallId: 'tc1', status: 'completed', title: 'Edit', kind: 'edit' }
    expect(toolCallsEqual(a, b)).toBe(true)
  })

  it('returns false for different status', () => {
    const a: ToolCall = { toolCallId: 'tc1', status: 'in_progress', title: 'Edit' }
    const b: ToolCall = { toolCallId: 'tc1', status: 'completed', title: 'Edit' }
    expect(toolCallsEqual(a, b)).toBe(false)
  })
})

describe('toolCallArraysEqual', () => {
  it('returns true for same reference', () => {
    const arr: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit' }]
    expect(toolCallArraysEqual(arr, arr)).toBe(true)
  })

  it('returns true for equal arrays with same content reference', () => {
    const content = [{ type: 'content' as const, text: 'x' }]
    const a: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit', content, kind: 'edit' }]
    const b: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit', content, kind: 'edit' }]
    expect(toolCallArraysEqual(a, b)).toBe(true)
  })

  it('returns false when content arrays are different references', () => {
    const a: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit', content: [{ type: 'content', text: 'x' }], kind: 'edit' }]
    const b: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit', content: [{ type: 'content', text: 'x' }], kind: 'edit' }]
    // Reference equality for content arrays — different instances are not equal
    expect(toolCallArraysEqual(a, b)).toBe(false)
  })

  it('returns false for different lengths', () => {
    const a: ToolCall[] = [{ toolCallId: 'tc1', status: 'completed', title: 'Edit' }]
    const b: ToolCall[] = []
    expect(toolCallArraysEqual(a, b)).toBe(false)
  })
})

describe('messagesEqual', () => {
  it('returns true for same reference', () => {
    const msgs: TaskMessage[] = [{ role: 'user', content: 'hi', timestamp: '2024-01-01' }]
    expect(messagesEqual(msgs, msgs)).toBe(true)
  })

  it('returns true for both empty', () => {
    expect(messagesEqual([], [])).toBe(true)
  })

  it('returns false for different lengths', () => {
    const a: TaskMessage[] = [{ role: 'user', content: 'hi', timestamp: '2024-01-01' }]
    expect(messagesEqual(a, [])).toBe(false)
  })

  it('returns true when last messages match', () => {
    const a: TaskMessage[] = [{ role: 'user', content: 'hi', timestamp: '2024-01-01' }]
    const b: TaskMessage[] = [{ role: 'user', content: 'hi', timestamp: '2024-01-01' }]
    expect(messagesEqual(a, b)).toBe(true)
  })

  it('returns false when last messages differ', () => {
    const a: TaskMessage[] = [{ role: 'user', content: 'hi', timestamp: '2024-01-01' }]
    const b: TaskMessage[] = [{ role: 'user', content: 'hello', timestamp: '2024-01-01' }]
    expect(messagesEqual(a, b)).toBe(false)
  })
})

describe('stringArraysEqual', () => {
  it('returns true for same reference', () => {
    const arr = ['a', 'b']
    expect(stringArraysEqual(arr, arr)).toBe(true)
  })

  it('returns true for equal arrays', () => {
    expect(stringArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
  })

  it('returns false for different arrays', () => {
    expect(stringArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(stringArraysEqual(['a'], ['a', 'b'])).toBe(false)
  })
})

describe('tasksEqual', () => {
  it('returns true for identical tasks', () => {
    const task = makeTask()
    expect(tasksEqual(task, { ...task })).toBe(true)
  })

  it('returns false when status changes', () => {
    const a = makeTask({ status: 'paused' })
    const b = makeTask({ status: 'running' })
    expect(tasksEqual(a, b)).toBe(false)
  })

  it('returns false when name changes', () => {
    const a = makeTask({ name: 'Old' })
    const b = makeTask({ name: 'New' })
    expect(tasksEqual(a, b)).toBe(false)
  })
})
