import { memo, useEffect, useRef, useState } from 'react'
import { ipc } from '@/lib/ipc'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import { useTaskStore } from '@/stores/taskStore'

/**
 * TASK-115: Renders the configured Claude statusline command's stdout as a
 * thin status bar. Re-runs whenever the active task or message count changes.
 * Sandboxing (PATH-only env, 2s timeout, 1KB stdout cap) is handled by the
 * Rust `run_statusline_command` Tauri command.
 */
export const Statusline = memo(function Statusline() {
  const config = useClaudeConfigStore((s) => s.config?.statusline ?? null)
  const task = useTaskStore((s) =>
    s.selectedTaskId ? s.tasks[s.selectedTaskId] : null
  )
  const [output, setOutput] = useState<string>('')
  const lastSig = useRef<string>('')

  useEffect(() => {
    if (!config) {
      setOutput('')
      return
    }
    let cancelled = false
    const sig = `${task?.id ?? ''}|${task?.messages?.length ?? 0}|${''}`
    if (sig === lastSig.current) return
    lastSig.current = sig
    const ctx = JSON.stringify({
      cwd: task?.workspace ?? '',
      model: '',
      taskId: task?.id ?? '',
      messageCount: task?.messages?.length ?? 0,
    })
    ipc
      .runStatuslineCommand(config.command, ctx)
      .then((res) => {
        if (!cancelled) setOutput(res)
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setOutput(`[statusline error: ${msg.slice(0, 80)}]`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [config, task?.id, task?.messages?.length, task?.workspace])

  if (!config || !output) return null
  return (
    <div className="border-t border-border bg-background/60 px-3 py-1 text-[11px] font-mono text-muted-foreground truncate">
      {output}
    </div>
  )
})
