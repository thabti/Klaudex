import { useCallback, useRef, useState } from 'react'
import { IconGitBranch, IconPencil } from '@tabler/icons-react'
import { ipc } from '@/lib/ipc'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { slugify, isValidWorktreeSlug } from '@/lib/utils'
import { ChatInput } from './ChatInput'
import { EmptyThreadSplash } from './EmptyThreadSplash'

interface PendingChatProps {
  workspace: string
}

export function PendingChat({ workspace }: PendingChatProps) {
  const upsertTask = useTaskStore((s) => s.upsertTask)
  const setSelectedTask = useTaskStore((s) => s.setSelectedTask)
  const setPendingWorkspace = useTaskStore((s) => s.setPendingWorkspace)
  const draft = useTaskStore((s) => s.drafts[workspace])
  const setDraft = useTaskStore((s) => s.setDraft)
  const removeDraft = useTaskStore((s) => s.removeDraft)

  const settings = useSettingsStore((s) => s.settings)
  const projectPrefs = settings.projectPrefs?.[workspace]
  const [useWorktree, setUseWorktree] = useState(projectPrefs?.worktreeEnabled ?? false)
  const [worktreeSlug, setWorktreeSlug] = useState('')
  const [isSlugEdited, setIsSlugEdited] = useState(false)
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const slugInputRef = useRef<HTMLInputElement>(null)

  const handleDraftChange = useCallback((val: string) => {
    setDraft(workspace, val)
    // Auto-generate slug from message text if user hasn't manually edited it
    if (!isSlugEdited) {
      setWorktreeSlug(slugify(val.slice(0, 60)))
    }
  }, [workspace, setDraft, isSlugEdited])

  const handleSlugChange = useCallback((val: string) => {
    setWorktreeSlug(val)
    setIsSlugEdited(true)
  }, [])

  const handleWorktreeToggle = useCallback(() => {
    const next = !useWorktree
    setUseWorktree(next)
    // Persist preference
    useSettingsStore.getState().setProjectPref(workspace, { worktreeEnabled: next })
  }, [useWorktree, workspace])

  const handleEditSlug = useCallback(() => {
    setIsEditingSlug(true)
    setIsSlugEdited(true)
    requestAnimationFrame(() => slugInputRef.current?.focus())
  }, [])

  const handleSlugKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditingSlug(false)
    }
  }, [])

  const handleSend = useCallback(async (msg: string) => {
    removeDraft(workspace)
    const name = msg.length > 60 ? msg.slice(0, 57) + '\u2026' : msg
    const { settings: currentSettings, activeWorkspace, currentModeId } = useSettingsStore.getState()
    const prefs = activeWorkspace ? currentSettings.projectPrefs?.[activeWorkspace] : undefined
    const autoApprove = prefs?.autoApprove !== undefined ? prefs.autoApprove : currentSettings.autoApprove
    const modeId = currentModeId && currentModeId !== 'kiro_default' ? currentModeId : undefined

    if (useWorktree && worktreeSlug && isValidWorktreeSlug(worktreeSlug)) {
      // Create worktree first, then create task in it
      const symlinkDirs = prefs?.symlinkDirectories ?? ['node_modules']
      const wtResult = await ipc.gitWorktreeCreate(workspace, worktreeSlug)
      try {
        await ipc.gitWorktreeSetup(workspace, wtResult.worktreePath, symlinkDirs)
      } catch {
        // Cleanup orphaned worktree if setup fails
        void ipc.gitWorktreeRemove(workspace, wtResult.worktreePath).catch(() => {})
        throw new Error('Worktree setup failed')
      }
      const created = await ipc.createTask({ name, workspace: wtResult.worktreePath, prompt: msg, autoApprove, modeId })
      upsertTask({
        ...created,
        worktreePath: wtResult.worktreePath,
        originalWorkspace: workspace,
        messages: [
          ...created.messages,
          { role: 'system', content: `Working in worktree \`${wtResult.worktreePath}\` on branch \`${wtResult.branch}\``, timestamp: new Date().toISOString() },
        ],
      })
      if (currentModeId && currentModeId !== 'kiro_default') {
        useTaskStore.getState().setTaskMode(created.id, currentModeId)
      }
      setPendingWorkspace(null)
      setSelectedTask(created.id)
      return
    }

    const created = await ipc.createTask({ name, workspace, prompt: msg, autoApprove, modeId })
    upsertTask(created)
    if (currentModeId && currentModeId !== 'kiro_default') {
      useTaskStore.getState().setTaskMode(created.id, currentModeId)
    }
    setPendingWorkspace(null)
    setSelectedTask(created.id)
  }, [workspace, upsertTask, setSelectedTask, setPendingWorkspace, removeDraft, useWorktree, worktreeSlug])

  const kiroAuth = useSettingsStore((s) => s.kiroAuth)
  const kiroAuthChecked = useSettingsStore((s) => s.kiroAuthChecked)
  const openLogin = useSettingsStore((s) => s.openLogin)
  const isLoggedOut = kiroAuthChecked && !kiroAuth
  const isSlugValid = !worktreeSlug || isValidWorktreeSlug(worktreeSlug)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {isLoggedOut ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-amber-600 dark:text-amber-400" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V8a1 1 0 0 1 2 0v5Z" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/80">Sign in to start a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">Kiro authentication is required to use AI agents</p>
            </div>
            <button
              type="button"
              onClick={openLogin}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              Sign in to Kiro
            </button>
          </div>
        ) : (
          <EmptyThreadSplash />
        )}
      </div>
      {/* Worktree toggle */}
      {!isLoggedOut && (
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-1 px-4 pb-2">
          <div className="flex items-center justify-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground select-none" htmlFor="worktree-toggle">
              <input
                id="worktree-toggle"
                type="checkbox"
                checked={useWorktree}
                onChange={handleWorktreeToggle}
                className="size-3.5 rounded border-border accent-primary"
                aria-label="Use worktree for this thread"
              />
              <IconGitBranch className="size-3 text-violet-500 dark:text-violet-400" aria-hidden />
              <span>Use worktree</span>
            </label>
          </div>
          {useWorktree && (
            <div className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground/60">
              <span>Isolates this thread in</span>
              <span className="font-mono text-muted-foreground/80">.kiro/worktrees/</span>
              {isEditingSlug ? (
                <input
                  ref={slugInputRef}
                  type="text"
                  value={worktreeSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => setIsEditingSlug(false)}
                  onKeyDown={handleSlugKeyDown}
                  placeholder="slug"
                  className={`w-28 rounded border bg-background/50 px-1 py-0.5 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50 ${isSlugValid ? 'border-border/40 focus:border-border/80' : 'border-red-400/60'}`}
                  aria-label="Worktree slug"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleEditSlug}
                  className="group inline-flex items-center gap-0.5 rounded px-0.5 py-0.5 font-mono text-[11px] text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Edit worktree slug"
                  tabIndex={0}
                >
                  <span>{worktreeSlug || '<slug>'}</span>
                  <IconPencil className="size-2.5 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <ChatInput autoFocus disabled={isLoggedOut} initialValue={draft} onDraftChange={handleDraftChange} onSendMessage={handleSend} workspace={workspace} />
    </div>
  )
}
