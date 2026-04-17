import { memo } from 'react'
import { FRAMEWORK_ICONS } from '@/lib/framework-icons'
import type { ProjectIconResult } from '@/hooks/useProjectIcon'

interface ProjectIconProps {
  readonly icon: ProjectIconResult
}

/** Renders a small circular project icon (favicon image or framework SVG). */
export const ProjectIcon = memo(function ProjectIcon({ icon }: ProjectIconProps) {
  if (!icon) return null

  if (icon.type === 'favicon') {
    return (
      <img
        src={icon.dataUrl}
        alt=""
        aria-hidden
        className="size-3.5 shrink-0 rounded-full object-cover"
      />
    )
  }

  const FrameworkSvg = FRAMEWORK_ICONS[icon.id]
  if (!FrameworkSvg) return null

  return <FrameworkSvg className="size-3.5 shrink-0 rounded-full" aria-hidden />
})
