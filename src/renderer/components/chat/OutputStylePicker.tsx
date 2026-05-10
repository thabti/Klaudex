import { memo, useCallback } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTaskStore } from '@/stores/taskStore'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'

const DEFAULT_LABEL = 'Default'

export const OutputStylePicker = memo(function OutputStylePicker() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const currentStyle = useTaskStore((s) =>
    s.selectedTaskId ? s.tasks[s.selectedTaskId]?.outputStyle : undefined
  )
  const styles = useClaudeConfigStore((s) => s.config?.outputStyles ?? [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!selectedTaskId) return
      const value = e.target.value || undefined
      useTaskStore.setState((state) => ({
        tasks: {
          ...state.tasks,
          [selectedTaskId]: { ...state.tasks[selectedTaskId], outputStyle: value },
        },
      }))
    },
    [selectedTaskId]
  )

  if (!selectedTaskId || styles.length === 0) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <IconSparkles className="size-3.5" aria-hidden />
          <select
            aria-label="Output style"
            value={currentStyle ?? ''}
            onChange={handleChange}
            className="bg-transparent outline-none cursor-pointer pr-1"
          >
            <option value="">{DEFAULT_LABEL}</option>
            {styles.map((s) => (
              <option key={`${s.source}:${s.filePath}`} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px]">
        Output style
      </TooltipContent>
    </Tooltip>
  )
})
