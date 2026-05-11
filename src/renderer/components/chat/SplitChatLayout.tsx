import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { ChatPanel } from './ChatPanel'
import { SplitPanelHeader } from './SplitPanelHeader'
import { SplitDivider } from './SplitDivider'

const MIN_PANEL_PX = 400

export const SplitChatLayout = memo(function SplitChatLayout() {
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const splitTaskId = useTaskStore((s) => s.splitTaskId)
  const splitRatio = useTaskStore((s) => s.splitRatio)
  const focusedPanel = useTaskStore((s) => s.focusedPanel)
  const setSplitRatio = useTaskStore((s) => s.setSplitRatio)
  const setFocusedPanel = useTaskStore((s) => s.setFocusedPanel)
  const closeSplit = useTaskStore((s) => s.closeSplit)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth(width)
      if (width > 0 && width < MIN_PANEL_PX * 2) closeSplit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [closeSplit])

  const handleReset = useCallback(() => setSplitRatio(0.6), [setSplitRatio])

  // Use onMouseDown instead of onClick to set focus before any child handlers fire.
  // Bail-out guard: only call set if the panel isn't already focused.
  const handleFocusLeft = useCallback(() => {
    if (useTaskStore.getState().focusedPanel !== 'left') setFocusedPanel('left')
  }, [setFocusedPanel])
  const handleFocusRight = useCallback(() => {
    if (useTaskStore.getState().focusedPanel !== 'right') setFocusedPanel('right')
  }, [setFocusedPanel])

  if (!selectedTaskId || !splitTaskId) return null

  const leftWidth = `${splitRatio * 100}%`
  const rightWidth = `${(1 - splitRatio) * 100}%`

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flexBasis: leftWidth, maxWidth: leftWidth }}
        onMouseDown={handleFocusLeft}
        role="region"
        aria-label="Left chat panel"
      >
        <SplitPanelHeader
          taskId={selectedTaskId}
          isFocused={focusedPanel === 'left'}
          onClose={closeSplit}
          onFocus={handleFocusLeft}
        />
        <ChatPanel taskId={selectedTaskId} />
      </div>

      <SplitDivider
        containerWidth={containerWidth}
        ratio={splitRatio}
        onRatioChange={setSplitRatio}
        onReset={handleReset}
      />

      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flexBasis: rightWidth, maxWidth: rightWidth }}
        onMouseDown={handleFocusRight}
        role="region"
        aria-label="Right chat panel"
      >
        <SplitPanelHeader
          taskId={splitTaskId}
          isFocused={focusedPanel === 'right'}
          onClose={closeSplit}
          onFocus={handleFocusRight}
        />
        <ChatPanel taskId={splitTaskId} />
      </div>
    </div>
  )
})
