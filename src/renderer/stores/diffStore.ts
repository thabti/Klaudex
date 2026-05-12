import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import { logStoreAction } from '@/lib/debug-logger'

interface DiffStats {
  additions: number
  deletions: number
  fileCount: number
}

interface DiffStore {
  isOpen: boolean
  diff: string
  stats: DiffStats
  loading: boolean
  selectedFiles: Set<string>
  focusFile: string | null
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  fetchDiff: (taskId: string) => Promise<void>
  clear: () => void
  toggleFileSelection: (filePath: string) => void
  clearSelection: () => void
  stageSelected: (taskId: string) => Promise<void>
  revertSelected: (taskId: string) => Promise<void>
  openToFile: (filePath: string) => void
}

const EMPTY_STATS: DiffStats = { additions: 0, deletions: 0, fileCount: 0 }

export const useDiffStore = create<DiffStore>((set, get) => ({
  isOpen: false,
  diff: '',
  stats: EMPTY_STATS,
  loading: false,
  selectedFiles: new Set<string>(),
  focusFile: null,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),

  fetchDiff: async (taskId: string) => {
    set({ loading: true })
    try {
      // Fetch the unified diff text and the structured stats in parallel.
      // Stats come from libgit2 directly (`task_diff_stats`), not from a
      // string scan of the diff body — single source of truth in Rust.
      const [diff, stats] = await Promise.all([
        ipc.getTaskDiff(taskId),
        ipc.getTaskDiffStats(taskId).catch(() => EMPTY_STATS),
      ])
      set({ diff, stats, loading: false })
    } catch {
      set({ diff: '', stats: EMPTY_STATS, loading: false })
    }
  },

  clear: () => set({ diff: '', stats: EMPTY_STATS, selectedFiles: new Set() }),

  toggleFileSelection: (filePath: string) => set((s) => {
    const next = new Set(s.selectedFiles)
    if (next.has(filePath)) next.delete(filePath)
    else next.add(filePath)
    return { selectedFiles: next }
  }),

  clearSelection: () => set({ selectedFiles: new Set() }),

  stageSelected: async (taskId: string) => {
    const files = Array.from(get().selectedFiles)
    logStoreAction('diffStore', 'stageSelected', { taskId, files })
    await Promise.all(files.map((f) => ipc.gitStage(taskId, f)))
    set({ selectedFiles: new Set() })
    await get().fetchDiff(taskId)
  },

  revertSelected: async (taskId: string) => {
    const files = Array.from(get().selectedFiles)
    logStoreAction('diffStore', 'revertSelected', { taskId, files })
    await Promise.all(files.map((f) => ipc.gitRevert(taskId, f)))
    set({ selectedFiles: new Set() })
    await get().fetchDiff(taskId)
  },

  openToFile: (filePath: string) => set({ isOpen: true, focusFile: filePath }),
}))
