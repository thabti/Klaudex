import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import { useDiffStore } from './diffStore'
import type { ProjectFile } from '@/types'

interface FileTreeStore {
  isOpen: boolean
  files: ProjectFile[]
  loading: boolean
  expandedDirs: Set<string>
  previewFile: string | null

  toggle: () => void
  setOpen: (open: boolean) => void
  loadFiles: (workspace: string) => Promise<void>
  toggleDir: (dir: string) => void
  setPreviewFile: (path: string | null) => void
}

export const useFileTreeStore = create<FileTreeStore>((set, get) => ({
  isOpen: false,
  files: [],
  loading: false,
  expandedDirs: new Set<string>(),
  previewFile: null,

  toggle: () => {
    const next = !get().isOpen
    if (next) useDiffStore.getState().setOpen(false)
    set({ isOpen: next })
  },

  setOpen: (open) => {
    if (open === get().isOpen) return
    if (open) useDiffStore.getState().setOpen(false)
    set({ isOpen: open })
  },

  loadFiles: async (workspace: string) => {
    set({ loading: true })
    try {
      const files = await ipc.listProjectFiles(workspace, true)
      set({ files, loading: false })
    } catch {
      set({ files: [], loading: false })
    }
  },

  toggleDir: (dir: string) => set((s) => {
    const next = new Set(s.expandedDirs)
    if (next.has(dir)) next.delete(dir)
    else next.add(dir)
    return { expandedDirs: next }
  }),

  setPreviewFile: (path) => set({ previewFile: path }),
}))
