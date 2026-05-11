import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { IconX, IconRefresh, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFileTreeStore } from '@/stores/fileTreeStore'
import { useTaskStore } from '@/stores/taskStore'
import { useResizeHandle } from '@/hooks/useResizeHandle'
import { buildTree, type TreeNode } from './build-tree'
import { FilePreviewModal } from './FilePreviewModal'
import { FileTypeIcon } from './FileTypeIcon'
import { setInAppDragActive, setInAppDragData } from '@/hooks/useAttachments'
import { cn } from '@/lib/utils'

const GIT_STATUS_COLORS: Record<string, string> = {
  M: 'bg-amber-400',
  A: 'bg-emerald-400',
  D: 'bg-red-400',
  R: 'bg-blue-400',
}

const TreeItem = memo(function TreeItem({ node, depth, expanded, onToggleDir, onClickFile, onDragStart }: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggleDir: (path: string) => void
  onClickFile: (path: string) => void
  onDragStart: (e: React.DragEvent, node: TreeNode) => void
}) {
  const isExpanded = expanded.has(node.path)
  const gitStatus = node.file?.gitStatus
  const isDeleted = gitStatus === 'D'

  const handleClick = useCallback(() => {
    if (isDeleted) return
    if (node.isDir) onToggleDir(node.path)
    else onClickFile(node.path)
  }, [node, isDeleted, onToggleDir, onClickFile])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (isDeleted) {
      e.preventDefault()
      return
    }
    onDragStart(e, node)
  }, [node, isDeleted, onDragStart])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        draggable={!isDeleted}
        onDragStart={handleDragStart}
        className={cn(
          'flex w-full items-center gap-1 rounded-md px-1.5 py-[3px] text-[12px] transition-colors select-none',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
          isDeleted
            ? 'text-muted-foreground/40 cursor-default line-through decoration-muted-foreground/30'
            : 'text-foreground/80 hover:bg-accent/60',
        )}
        style={{ paddingLeft: `${depth * 10 + 6}px` }}
        aria-expanded={node.isDir ? isExpanded : undefined}
        aria-disabled={isDeleted || undefined}
        title={isDeleted ? `${node.name} (deleted)` : undefined}
      >
        {node.isDir ? (
          <>
            {isExpanded ? <IconChevronDown className="size-3 shrink-0 text-muted-foreground" /> : <IconChevronRight className="size-3 shrink-0 text-muted-foreground" />}
            <FileTypeIcon name={node.name} isDir isExpanded={isExpanded} className="size-3.5" />
          </>
        ) : (
          <>
            <span className="size-3 shrink-0" />
            <FileTypeIcon name={node.name} isDir={false} className={cn('size-3.5', isDeleted && 'opacity-40')} />
          </>
        )}
        <span className="min-w-0 truncate">{node.name}</span>
        {gitStatus && GIT_STATUS_COLORS[gitStatus] && (
          <span className={cn('ml-auto size-1.5 shrink-0 rounded-full', GIT_STATUS_COLORS[gitStatus])} title={gitStatus} />
        )}
      </button>
      {node.isDir && isExpanded && node.children.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggleDir={onToggleDir}
          onClickFile={onClickFile}
          onDragStart={onDragStart}
        />
      ))}
    </>
  )
})

interface FileTreePanelProps {
  onClose: () => void
  workspace?: string
}

export const FileTreePanel = memo(function FileTreePanel({ onClose, workspace: workspaceProp }: FileTreePanelProps) {
  const [width, setWidth] = useState(260)
  const files = useFileTreeStore((s) => s.files)
  const loading = useFileTreeStore((s) => s.loading)
  const expandedDirs = useFileTreeStore((s) => s.expandedDirs)
  const previewFile = useFileTreeStore((s) => s.previewFile)
  const toggleDir = useFileTreeStore((s) => s.toggleDir)
  const loadFiles = useFileTreeStore((s) => s.loadFiles)
  const setPreviewFile = useFileTreeStore((s) => s.setPreviewFile)

  const selectedTaskId = useTaskStore((s) => s.selectedTaskId)
  const taskWorkspace = useTaskStore((s) => selectedTaskId ? (s.tasks[selectedTaskId]?.originalWorkspace ?? s.tasks[selectedTaskId]?.workspace) : undefined)
  const effectiveWorkspace = taskWorkspace ?? workspaceProp

  useEffect(() => {
    if (effectiveWorkspace) loadFiles(effectiveWorkspace)
  }, [effectiveWorkspace, loadFiles])

  const tree = useMemo(() => {
    if (!effectiveWorkspace || files.length === 0) return []
    return buildTree(files, effectiveWorkspace)
  }, [files, effectiveWorkspace])

  const handleResizeStart = useResizeHandle({
    axis: 'horizontal', size: width, onResize: setWidth, min: 180, max: 500, reverse: true,
  })

  const handleRefresh = useCallback(() => {
    if (effectiveWorkspace) loadFiles(effectiveWorkspace)
  }, [effectiveWorkspace, loadFiles])

  const handleClickFile = useCallback((path: string) => {
    setPreviewFile(path)
  }, [setPreviewFile])

  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.dataTransfer.effectAllowed = 'copy'
    setInAppDragActive(true)
    if (node.isDir) {
      e.dataTransfer.setData('application/x-klaudex-folder', node.path)
      setInAppDragData({ type: 'folder', path: node.path })
    } else {
      e.dataTransfer.setData('application/x-klaudex-file', JSON.stringify(node.file))
      if (node.file) setInAppDragData({ type: 'file', data: node.file })
    }
    e.dataTransfer.setData('text/plain', node.path)
  }, [])

  // Esc closes preview first, then panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If preview modal is open, it handles Esc via capture phase — skip here
        if (previewFile) return
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewFile, onClose])

  return (
    <>
      <div className="relative flex h-full shrink-0 flex-col border-l border-border bg-background" style={{ width }}>
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
          onMouseDown={handleResizeStart}
        />
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Files</span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleRefresh} className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <IconRefresh className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={onClose} className="flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <IconX className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Tree content */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1.5">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {!loading && tree.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">No files found</p>
            )}
            {!loading && tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                expanded={expandedDirs}
                onToggleDir={toggleDir}
                onClickFile={handleClickFile}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      {previewFile && (
        <FilePreviewModal filePath={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  )
})
