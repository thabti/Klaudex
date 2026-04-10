import { memo, useEffect, useRef, useCallback, useState } from 'react'
import { SquareSplitHorizontal, Plus, Trash2 } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ipc } from '@/lib/ipc'
import { useResizeHandle } from '@/hooks/useResizeHandle'
import 'xterm/css/xterm.css'

interface TerminalDrawerProps {
  cwd: string
}

interface TermInstance {
  id: string
  term: Terminal
  fit: FitAddon
  containerRef: React.RefObject<HTMLDivElement>
}

let termCounter = 0
function nextId() { return `pty-${++termCounter}` }

export const TerminalDrawer = memo(function TerminalDrawer({ cwd }: TerminalDrawerProps) {
  const [instances, setInstances] = useState<TermInstance[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [height, setHeight] = useState(280)
  const drawerRef = useRef<HTMLElement>(null)
  const readyPtys = useRef<Set<string>>(new Set())
  const instancesRef = useRef<TermInstance[]>([])

  // Keep refs in sync
  instancesRef.current = instances

  const createTerminal = useCallback(async () => {
    const id = nextId()
    const isDark = document.documentElement.classList.contains('dark')
    const term = new Terminal({
      fontFamily: '"SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 12,
      theme: isDark ? {
        background: 'rgb(14, 18, 24)',
        foreground: 'rgb(237, 241, 247)',
        cursor: 'rgb(180, 203, 255)',
        selectionBackground: 'rgba(180, 203, 255, 0.25)',
        black: 'rgb(24, 30, 38)',
        red: 'rgb(255, 122, 142)',
        green: 'rgb(134, 231, 149)',
        yellow: 'rgb(244, 205, 114)',
        blue: 'rgb(137, 190, 255)',
        magenta: 'rgb(208, 176, 255)',
        cyan: 'rgb(124, 232, 237)',
        white: 'rgb(210, 218, 230)',
        brightBlack: 'rgb(110, 120, 136)',
        brightRed: 'rgb(255, 168, 180)',
        brightGreen: 'rgb(176, 245, 186)',
        brightYellow: 'rgb(255, 224, 149)',
        brightBlue: 'rgb(174, 210, 255)',
        brightMagenta: 'rgb(229, 203, 255)',
        brightCyan: 'rgb(167, 244, 247)',
        brightWhite: 'rgb(244, 247, 252)',
      } : {
        background: 'rgb(255, 255, 255)',
        foreground: 'rgb(28, 33, 41)',
        cursor: 'rgb(38, 56, 78)',
        selectionBackground: 'rgba(37, 63, 99, 0.2)',
        black: 'rgb(44, 53, 66)',
        red: 'rgb(191, 70, 87)',
        green: 'rgb(60, 126, 86)',
        yellow: 'rgb(146, 112, 35)',
        blue: 'rgb(72, 102, 163)',
        magenta: 'rgb(132, 86, 149)',
        cyan: 'rgb(53, 127, 141)',
        white: 'rgb(210, 215, 223)',
        brightBlack: 'rgb(112, 123, 140)',
        brightRed: 'rgb(212, 95, 112)',
        brightGreen: 'rgb(85, 148, 111)',
        brightYellow: 'rgb(173, 133, 45)',
        brightBlue: 'rgb(91, 124, 194)',
        brightMagenta: 'rgb(153, 107, 172)',
        brightCyan: 'rgb(70, 149, 164)',
        brightWhite: 'rgb(236, 240, 246)',
      },
      cursorBlink: true,
      allowTransparency: false,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    const containerRef = { current: null } as unknown as React.RefObject<HTMLDivElement>

    const instance: TermInstance = { id, term, fit, containerRef }
    setInstances((prev) => [...prev, instance])
    setActiveId(id)

    term.onData((data) => { void ipc.ptyWrite(id, data) })

    await ipc.ptyCreate(id, cwd)
    readyPtys.current.add(id)
    if (instance.containerRef.current && instance.term.element) {
      instance.fit.fit()
      void ipc.ptyResize(id, instance.term.cols, instance.term.rows)
    }
    return instance
  }, [cwd])

  // Create initial terminal on mount, cleanup all on unmount
  useEffect(() => {
    void createTerminal()
    return () => {
      instancesRef.current.forEach((inst) => { void ipc.ptyKill(inst.id); inst.term.dispose() })
      readyPtys.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to PTY data/exit once — use ref to find instances without re-subscribing
  useEffect(() => {
    const unsub = ipc.onPtyData(({ id, data }) => {
      const inst = instancesRef.current.find((i) => i.id === id)
      inst?.term.write(data)
    })
    const unsubExit = ipc.onPtyExit(({ id }) => {
      const inst = instancesRef.current.find((i) => i.id === id)
      inst?.term.write('\r\n[Process exited]\r\n')
    })
    return () => { unsub(); unsubExit() }
  }, [])

  // Open terminal into DOM when instances change
  useEffect(() => {
    instances.forEach((inst) => {
      if (inst.containerRef.current && !inst.term.element) {
        inst.term.open(inst.containerRef.current)
        inst.fit.fit()
        if (readyPtys.current.has(inst.id)) {
          const { cols, rows } = inst.term
          void ipc.ptyResize(inst.id, cols, rows)
        }
      }
    })
  }, [instances])

  // ResizeObserver for active terminal
  useEffect(() => {
    const active = instances.find((i) => i.id === activeId)
    if (!active?.containerRef.current) return
    const ro = new ResizeObserver(() => {
      if (!readyPtys.current.has(active.id)) return
      active.fit.fit()
      void ipc.ptyResize(active.id, active.term.cols, active.term.rows)
    })
    ro.observe(active.containerRef.current)
    return () => ro.disconnect()
  }, [activeId, instances])

  // Use ref for height to avoid re-creating drag handler on every height change
  const handleDragStart = useResizeHandle({
    axis: 'vertical', size: height, onResize: setHeight, min: 120, max: 600, reverse: true,
  })

  const handleClose = useCallback((id: string) => {
    const inst = instancesRef.current.find((i) => i.id === id)
    if (inst) { void ipc.ptyKill(id); inst.term.dispose(); readyPtys.current.delete(id) }
    setInstances((prev) => {
      const next = prev.filter((i) => i.id !== id)
      setActiveId((cur) => cur === id ? (next[next.length - 1]?.id ?? null) : cur)
      return next
    })
  }, [])

  const handleSplit = useCallback(() => { void createTerminal() }, [createTerminal])

  return (
    <aside
      ref={drawerRef}
      className="thread-terminal-drawer relative flex min-w-0 shrink-0 flex-col overflow-hidden border-t border-border/80 bg-background"
      style={{ height }}
    >
      <div
        className="absolute inset-x-0 top-0 z-20 h-1.5 cursor-row-resize"
        onMouseDown={handleDragStart}
      />

      <div className="pointer-events-none absolute right-2 top-2 z-20">
        <div className="pointer-events-auto inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-background/70">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Split Terminal"
                onClick={handleSplit}
                className="p-1 text-foreground/90 transition-colors hover:bg-accent"
              >
                <SquareSplitHorizontal className="size-3.25" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Split terminal</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border/80" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="New Terminal"
                onClick={handleSplit}
                className="p-1 text-foreground/90 transition-colors hover:bg-accent"
              >
                <Plus className="size-3.25" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New terminal</TooltipContent>
          </Tooltip>
          <div className="h-4 w-px bg-border/80" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Close Terminal"
                onClick={() => activeId && handleClose(activeId)}
                className="p-1 text-foreground/90 transition-colors hover:bg-accent"
              >
                <Trash2 className="size-3.25" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close terminal</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 w-full flex-1">
        <div className="flex h-full min-h-0">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="min-w-0 flex-1"
              style={{ display: inst.id === activeId ? 'block' : 'none' }}
            >
              <div className="h-full p-1">
                <div className="relative h-full w-full overflow-hidden rounded-[4px]">
                  <div
                    ref={(el) => { (inst.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
})
