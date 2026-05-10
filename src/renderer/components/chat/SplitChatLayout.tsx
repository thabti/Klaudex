import { memo, useCallback } from 'react'
import { ChatPanel } from './ChatPanel'
import { SplitDivider } from './SplitDivider'
import { SplitPanelHeader } from './SplitPanelHeader'
import { usePanelContext, type PanelKey } from './PanelContext'

/**
 * SplitChatLayout — orchestrates the two-pane chat container.
 *
 * Reads panel bindings, the active panel, and the split ratio from
 * `PanelContext`. In single-panel mode (right panel has no thread bound) it
 * renders `<ChatPanel />` full-width with no divider or split header so the
 * UI is visually identical to the pre-split Klaudex behavior. In split mode,
 * it renders a left panel + `<SplitDivider />` + right panel; each panel has
 * its own `<SplitPanelHeader />` and an independently scrollable chat region.
 *
 * NOTE on per-panel task scoping:
 * Klaudex's `<ChatPanel />` currently reads the active task from the global
 * `useTaskStore.selectedTaskId` selector and does not accept a `taskId` prop.
 * In split mode both panel subtrees therefore render the same selected task
 * until ChatPanel is refactored to accept a `taskId` prop (or wrapped in a
 * panel-scoped task store). Wiring that up is intentionally deferred: it
 * spans ChatPanel + every child that reads `selectedTaskId` and is out of
 * scope for TASK-042.
 *
 * TODO(TASK-043): plumb `panels[panel].threadId` into ChatPanel so each
 * split panel renders its own bound thread independently.
 */

interface PanelSubtreeProps {
  readonly panel: PanelKey
  readonly showHeader: boolean
}

/**
 * Wraps a single panel column: optional header + an independently scrolling
 * ChatPanel container. Clicking anywhere in the column makes this the active
 * panel so keyboard / focus traversal lands here.
 */
const PanelSubtree = memo(function PanelSubtree({ panel, showHeader }: PanelSubtreeProps) {
  const { setActivePanel } = usePanelContext()
  const handleFocus = useCallback(() => {
    setActivePanel(panel)
  }, [panel, setActivePanel])

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      onMouseDownCapture={handleFocus}
      role="region"
      aria-label={panel === 'left' ? 'Left chat panel' : 'Right chat panel'}
    >
      {showHeader && <SplitPanelHeader panel={panel} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <ChatPanel />
      </div>
    </div>
  )
})

export const SplitChatLayout = memo(function SplitChatLayout() {
  const { panels, ratio, setRatio } = usePanelContext()
  const isSplit = panels.left.threadId !== null && panels.right.threadId !== null

  const handleResetRatio = useCallback(() => {
    setRatio(0.5)
  }, [setRatio])

  // Single-panel mode: render ChatPanel full-width with no split chrome so
  // the layout is byte-identical to the pre-split Klaudex experience.
  if (!isSplit) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <ChatPanel />
      </div>
    )
  }

  // Split mode: left | divider | right. Each side gets a flex-basis derived
  // from the persisted ratio so the divider drag updates layout in real time.
  // Using flex (not grid) matches the SplitDivider implementation, which
  // measures `dividerRef.current.parentElement.getBoundingClientRect()` to
  // compute the new ratio on drag — that requires a flex container.
  const leftWidth = `${ratio * 100}%`
  const rightWidth = `${(1 - ratio) * 100}%`

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flexBasis: leftWidth, maxWidth: leftWidth }}
      >
        <PanelSubtree panel="left" showHeader />
      </div>

      <SplitDivider ratio={ratio} onRatioChange={setRatio} onReset={handleResetRatio} />

      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flexBasis: rightWidth, maxWidth: rightWidth }}
      >
        <PanelSubtree panel="right" showHeader />
      </div>
    </div>
  )
})
