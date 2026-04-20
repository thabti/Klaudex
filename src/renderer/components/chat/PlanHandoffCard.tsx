import { memo, useCallback, useState } from 'react'
import { IconRocket, IconArrowRight } from '@tabler/icons-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import { ipc } from '@/lib/ipc'

const HANDOFF_PATTERN = /ready to exit \[plan\] agent/i
const HANDOFF_MESSAGE = 'Go ahead working on the plan'

/** Returns true when assistant text contains the plan-agent handoff prompt */
export const isPlanHandoff = (text: string): boolean =>
  HANDOFF_PATTERN.test(text)

export const PlanHandoffCard = memo(function PlanHandoffCard() {
  const currentModeId = useSettingsStore((s) => s.currentModeId)
  const isPlan = currentModeId === 'plan'
  const [isSwitching, setIsSwitching] = useState(false)

  const handleSwitch = useCallback(() => {
    const taskId = useTaskStore.getState().selectedTaskId
    if (!taskId || isSwitching) return
    setIsSwitching(true)
    useSettingsStore.setState({ currentModeId: 'default' })
    useTaskStore.getState().setTaskMode(taskId, 'default')
    ipc.setMode(taskId, 'default').then(() => {
      const state = useTaskStore.getState()
      const task = state.tasks[taskId]
      if (!task) return
      const userMsg = { role: 'user' as const, content: HANDOFF_MESSAGE, timestamp: new Date().toISOString() }
      state.upsertTask({ ...task, status: 'running', messages: [...task.messages, userMsg] })
      state.clearTurn(taskId)
      ipc.sendMessage(taskId, HANDOFF_MESSAGE)
    }).catch(() => setIsSwitching(false))
  }, [isSwitching])

  if (!isPlan) return null

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={isSwitching}
      data-testid="plan-handoff-card"
      aria-label="Start building from this plan"
      className="mt-3 flex w-full items-center gap-3 rounded-lg border border-teal-400/20 bg-teal-400/5 px-4 py-3 text-left transition-colors hover:border-teal-400/40 hover:bg-teal-400/10 disabled:opacity-50 disabled:pointer-events-none"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-400/15">
        <IconRocket className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">
          {isSwitching ? 'Switching...' : 'Start building'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Switch to the coding agent and execute this plan
        </p>
      </div>
      <IconArrowRight className="size-4 shrink-0 text-teal-600/60 dark:text-teal-400/60" aria-hidden />
    </button>
  )
})
