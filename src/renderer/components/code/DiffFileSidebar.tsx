import { FileTypeIcon } from '@/components/file-tree/FileTypeIcon'
import { cn } from '@/lib/utils'
import type { FileStats } from './diff-viewer-utils'

interface DiffFileSidebarProps {
  fileStats: FileStats[]
  selectedFileIdx: number | null
  sidebarWidth: number
  onSelectFile: (idx: number | null) => void
  onDragStart: (e: React.MouseEvent) => void
}

export const DiffFileSidebar = ({ fileStats, selectedFileIdx, sidebarWidth, onSelectFile, onDragStart }: DiffFileSidebarProps) => (
  <div className="shrink-0 flex min-h-0" style={{ width: sidebarWidth }}>
    <div className="flex flex-1 min-w-0 flex-col overflow-y-auto">
      <button
        type="button"
        onClick={() => onSelectFile(null)}
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-medium border-b transition-colors',
          selectedFileIdx === null ? 'bg-accent/30 text-foreground' : 'text-muted-foreground hover:bg-accent/10',
        )}
      >
        All files ({fileStats.length})
      </button>
      {fileStats.map((file, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelectFile(i)}
          className={cn(
            'flex items-center gap-1 w-full px-2 py-1 text-[10px] hover:bg-accent/10 truncate transition-colors',
            selectedFileIdx === i && 'bg-accent/30 text-foreground',
          )}
        >
          <FileTypeIcon name={file.name.split('/').pop() ?? file.name} isDir={false} className="size-3" />
          <span className="min-w-0 flex-1 truncate">{file.name.split('/').pop()}</span>
          <span className="shrink-0 flex gap-1">
            {file.additions > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>}
            {file.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>}
          </span>
        </button>
      ))}
    </div>
    <div
      onMouseDown={onDragStart}
      className="w-1 shrink-0 cursor-col-resize border-r hover:bg-primary/20 active:bg-primary/30 transition-colors"
    />
  </div>
)
