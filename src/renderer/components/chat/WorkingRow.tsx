import { memo, useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import { usePanelResolvedTaskId } from './PanelContext'
import type { WorkingRow as WorkingRowData } from '@/lib/timeline'

const LOADING_WORDS = [
  'Thinking',
  'Reasoning',
  'Analyzing',
  'Planning',
  'Processing',
  'Reflecting',
  'Considering',
  'Evaluating',
  'Synthesizing',
  'Crafting',
]

export const WorkingRow = memo(function WorkingRow({ row }: { row: WorkingRowData }) {
  const resolvedTaskId = usePanelResolvedTaskId()
  const globalModeId = useSettingsStore((s) => s.currentModeId)
  const taskModeId = useTaskStore((s) => resolvedTaskId ? s.taskModes[resolvedTaskId] ?? null : null)
  const isPlan = (taskModeId ?? globalModeId) === 'kiro_planner'
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * LOADING_WORDS.length),
  )
  const [visible, setVisible] = useState(true)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (row.hasStreamingContent) return
    const cycle = () => {
      setVisible(false)
      fadeRef.current = setTimeout(() => {
        setIdx((i) => (i + 1) % LOADING_WORDS.length)
        setVisible(true)
      }, 300)
    }
    const t = setInterval(cycle, 2200)
    return () => {
      clearInterval(t)
      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [row.hasStreamingContent])

  if (row.hasStreamingContent) {
    return (
      <div className="py-2 select-none" data-timeline-row-kind="working">
        <span
          className={`inline-block size-1.5 animate-pulse rounded-full ${isPlan ? 'bg-teal-500' : 'bg-primary'}`}
          aria-label="Agent is working"
        />
      </div>
    )
  }

  return (
    <div className="py-2 select-none" data-timeline-row-kind="working">
      <div className="flex items-center gap-2">
        <span
          className={`text-[13px] transition-opacity duration-300 ${isPlan ? 'text-teal-600 dark:text-teal-400' : 'text-primary'}`}
          style={{ opacity: visible ? 1 : 0 }}
        >
          {LOADING_WORDS[idx]}&hellip;
        </span>
      </div>
    </div>
  )
})
