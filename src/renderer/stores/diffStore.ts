import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import { logStoreAction, logError } from '@/lib/debug-logger'

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

function computeStats(diff: string): DiffStats {
  let additions = 0
  let deletions = 0
  let fileCount = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++
    else if (line.startsWith('diff --git')) fileCount++
  }
  return { additions, deletions, fileCount }
}

export const useDiffStore = create<DiffStore>((set, get) => ({
  isOpen: false,
  diff: '',
  stats: { additions: 0, deletions: 0, fileCount: 0 },
  loading: false,
  selectedFiles: new Set<string>(),
  focusFile: null,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),

  fetchDiff: async (taskId: string) => {
    set({ loading: true })
    try {
      const diff = await ipc.getTaskDiff(taskId)
      const stats = computeStats(diff)
      logStoreAction('diffStore', 'fetchDiff', { taskId, fileCount: stats.fileCount, additions: stats.additions, deletions: stats.deletions })
      set({ diff, stats, loading: false })
    } catch (err) {
      logError('diffStore.fetchDiff', err, { taskId })
      set({ diff: '', stats: { additions: 0, deletions: 0, fileCount: 0 }, loading: false })
    }
  },

  clear: () => set({ diff: '', stats: { additions: 0, deletions: 0, fileCount: 0 }, selectedFiles: new Set() }),

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
