import { memo } from "react"
import { IconTerminal2, IconFiles, IconLayoutColumns, IconGitCompare } from "@tabler/icons-react"

export const HeaderGhostToolbar = memo(function HeaderGhostToolbar() {
  return (
    <div
      className="flex shrink-0 items-center gap-2 pointer-events-none"
      aria-hidden
    >
      {/* Editor + Terminal + File Tree + Split group */}
      <div className="flex items-center rounded-lg bg-muted/40">
        <div className="inline-flex size-7 items-center justify-center">
          <span className="size-3.5 rounded-sm bg-muted-foreground/10" />
        </div>
        <div className="h-4 w-px bg-foreground/[0.06]" />
        <div className="inline-flex size-7 items-center justify-center">
          <IconTerminal2 className="size-3.5 text-muted-foreground/30" />
        </div>
        <div className="h-4 w-px bg-foreground/[0.06]" />
        <div className="inline-flex size-7 items-center justify-center">
          <IconFiles className="size-3.5 text-muted-foreground/30" />
        </div>
        <div className="h-4 w-px bg-foreground/[0.06]" />
        <div className="inline-flex size-7 items-center justify-center">
          <IconLayoutColumns className="size-3.5 text-muted-foreground/30" />
        </div>
      </div>

      {/* Git section */}
      <div className="flex items-center rounded-lg bg-emerald-500/[0.06]">
        <div className="inline-flex h-7 items-center gap-1.5 rounded-l-lg px-2">
          <IconGitCompare className="size-3 text-emerald-400/40" />
        </div>
        <div className="inline-flex h-7 w-6 items-center justify-center rounded-r-lg">
          <span className="size-2 rounded-sm bg-emerald-400/20" />
        </div>
      </div>
    </div>
  )
})
