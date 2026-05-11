import { memo, useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useFileTreeStore, type TreeEntry } from '@/stores/fileTreeStore'
import {
  IconFile, IconFolder, IconTrash, IconCopy, IconClipboard,
  IconPencil, IconExternalLink, IconTerminal, IconSearch,
  IconScissors, IconCopyPlus, IconGitBranch,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface ContextMenuProps {
  x: number
  y: number
  entry: TreeEntry | null  // null = background (root level)
  workspace: string
  onClose: () => void
}

interface MenuItem {
  label: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
  separator?: boolean
  disabled?: boolean
  danger?: boolean
}

export const TreeContextMenu = memo(function TreeContextMenu({
  x, y, entry, workspace, onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const store = useFileTreeStore

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) {
      ref.current.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > vh) {
      ref.current.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  const handleNewFile = useCallback(() => {
    const parentDir = entry?.isDir ? entry.path : (entry?.path.split('/').slice(0, -1).join('/') ?? '')
    // Auto-expand the directory if it's collapsed
    if (entry?.isDir && !useFileTreeStore.getState().expandedDirs.has(entry.path)) {
      useFileTreeStore.getState().expandDir(entry.path).then(() => {
        store.getState().setRenamingPath(`__new_file__:${parentDir}`)
      })
    } else {
      store.getState().setRenamingPath(`__new_file__:${parentDir}`)
    }
    onClose()
  }, [entry, onClose])

  const handleNewFolder = useCallback(() => {
    const parentDir = entry?.isDir ? entry.path : (entry?.path.split('/').slice(0, -1).join('/') ?? '')
    // Auto-expand the directory if it's collapsed
    if (entry?.isDir && !useFileTreeStore.getState().expandedDirs.has(entry.path)) {
      useFileTreeStore.getState().expandDir(entry.path).then(() => {
        store.getState().setRenamingPath(`__new_folder__:${parentDir}`)
      })
    } else {
      store.getState().setRenamingPath(`__new_folder__:${parentDir}`)
    }
    onClose()
  }, [entry, onClose])

  const handleReveal = useCallback(() => {
    if (!entry) return
    invoke('reveal_in_finder', { workspace, relPath: entry.path }).catch(console.error)
    onClose()
  }, [entry, workspace, onClose])

  const handleOpenDefault = useCallback(() => {
    if (!entry) return
    invoke('open_in_default_app', { workspace, relPath: entry.path }).catch(console.error)
    onClose()
  }, [entry, workspace, onClose])

  const handleOpenTerminal = useCallback(() => {
    const path = entry?.path ?? ''
    invoke('open_terminal_at', { workspace, relPath: path }).catch(console.error)
    onClose()
  }, [entry, workspace, onClose])

  const handleCut = useCallback(() => {
    if (!entry) return
    store.getState().setClipboard({ path: entry.path, operation: 'cut' })
    onClose()
  }, [entry, onClose])

  const handleCopy = useCallback(() => {
    if (!entry) return
    store.getState().setClipboard({ path: entry.path, operation: 'copy' })
    onClose()
  }, [entry, onClose])

  const handleDuplicate = useCallback(() => {
    if (!entry) return
    store.getState().duplicateEntry(entry.path).catch(console.error)
    onClose()
  }, [entry, onClose])

  const handlePaste = useCallback(() => {
    const destDir = entry?.isDir ? entry.path : (entry?.path.split('/').slice(0, -1).join('/') ?? '')
    store.getState().pasteEntry(destDir).catch(console.error)
    onClose()
  }, [entry, onClose])

  const handleCopyPath = useCallback(async () => {
    if (!entry) return
    const path: string = await invoke('copy_entry_path', { workspace, relPath: entry.path, relative: false })
    await navigator.clipboard.writeText(path)
    onClose()
  }, [entry, workspace, onClose])

  const handleCopyRelPath = useCallback(async () => {
    if (!entry) return
    const path: string = await invoke('copy_entry_path', { workspace, relPath: entry.path, relative: true })
    await navigator.clipboard.writeText(path)
    onClose()
  }, [entry, workspace, onClose])

  const handleAddToGitignore = useCallback(() => {
    if (!entry) return
    invoke('add_to_gitignore', { workspace, relPath: entry.path }).catch(console.error)
    onClose()
  }, [entry, workspace, onClose])

  const handleRename = useCallback(() => {
    if (!entry) return
    store.getState().setRenamingPath(entry.path)
    onClose()
  }, [entry, onClose])

  const handleTrash = useCallback(() => {
    if (!entry) return
    store.getState().deleteEntry(entry.path, false).catch(console.error)
    onClose()
  }, [entry, onClose])

  const handleDelete = useCallback(() => {
    if (!entry) return
    store.getState().deleteEntry(entry.path, true).catch(console.error)
    onClose()
  }, [entry, onClose])

  const clipboard = useFileTreeStore((s) => s.clipboard)

  // Build menu items
  const items: MenuItem[] = []

  // New file/folder (always available)
  items.push({ label: 'New File', icon: <IconFile className="size-3.5" />, shortcut: '⌘N', action: handleNewFile })
  items.push({ label: 'New Folder', icon: <IconFolder className="size-3.5" />, shortcut: '⇧⌘N', action: handleNewFolder, separator: true })

  if (entry) {
    // Reveal / Open
    items.push({ label: 'Reveal in Finder', icon: <IconExternalLink className="size-3.5" />, shortcut: '⌥⌘R', action: handleReveal })
    items.push({ label: 'Open in Default App', icon: <IconExternalLink className="size-3.5" />, shortcut: '⌃⇧↵', action: handleOpenDefault })
    items.push({ label: 'Open in Terminal', icon: <IconTerminal className="size-3.5" />, action: handleOpenTerminal, separator: true })

    // Find in folder (for directories) — opens Finder search scoped to folder
    if (entry.isDir) {
      items.push({ label: 'Find in Folder...', icon: <IconSearch className="size-3.5" />, shortcut: '⌥⌘⇧F', action: () => {
        const absPath = `${workspace}/${entry.path}`
        // Open a Finder window with search active in this folder
        invoke('open_finder_search', { path: absPath }).catch(() => {
          // Fallback: just reveal the folder
          invoke('reveal_in_finder', { workspace, relPath: entry.path }).catch(console.error)
        })
        onClose()
      }, separator: true })
    }

    // Cut/Copy/Duplicate/Paste
    items.push({ label: 'Cut', icon: <IconScissors className="size-3.5" />, shortcut: '⌘X', action: handleCut })
    items.push({ label: 'Copy', icon: <IconCopy className="size-3.5" />, shortcut: '⌘C', action: handleCopy })
    items.push({ label: 'Duplicate', icon: <IconCopyPlus className="size-3.5" />, shortcut: '⌘D', action: handleDuplicate })
    items.push({ label: 'Paste', icon: <IconClipboard className="size-3.5" />, shortcut: '⌘V', action: handlePaste, disabled: !clipboard, separator: true })

    // Copy path
    items.push({ label: 'Copy Path', icon: <IconCopy className="size-3.5" />, shortcut: '⌥⌘C', action: handleCopyPath })
    items.push({ label: 'Copy Relative Path', icon: <IconCopy className="size-3.5" />, shortcut: '⌥⇧⌘C', action: handleCopyRelPath, separator: true })

    // Gitignore
    items.push({ label: 'Add to .gitignore', icon: <IconGitBranch className="size-3.5" />, action: handleAddToGitignore, separator: true })

    // Rename / Delete
    items.push({ label: 'Rename', icon: <IconPencil className="size-3.5" />, shortcut: 'F2', action: handleRename })
    items.push({ label: 'Trash', icon: <IconTrash className="size-3.5" />, action: handleTrash })
    items.push({ label: 'Delete', icon: <IconTrash className="size-3.5" />, shortcut: '⌥⌘⌫', action: handleDelete, danger: true })
  } else {
    // Background context menu
    items.push({ label: 'Open in Terminal', icon: <IconTerminal className="size-3.5" />, action: handleOpenTerminal })
    items.push({ label: 'Paste', icon: <IconClipboard className="size-3.5" />, shortcut: '⌘V', action: handlePaste, disabled: !clipboard })
  }

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            disabled={item.disabled}
            onClick={item.action}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
              item.disabled
                ? 'text-muted-foreground/40 cursor-default'
                : item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-foreground/80 hover:bg-accent/60',
            )}
          >
            {item.icon && <span className="shrink-0 text-muted-foreground">{item.icon}</span>}
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-[10px] text-muted-foreground/60">{item.shortcut}</span>
            )}
          </button>
          {item.separator && <div className="my-1 h-px bg-border/50" />}
        </div>
      ))}
    </div>
  )
})
