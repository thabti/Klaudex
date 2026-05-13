import type { ComponentType } from 'react'
import {
  IconBook,
  IconBrain,
  IconHammer,
  IconRobot,
  IconSearch,
} from '@tabler/icons-react'

/**
 * Role-based styling for subagent cards.
 *
 * Mirrors the gradient + tint palette used by `ContextRing.tsx`: each role
 * gets a `from`/`to` pair for SVG/CSS gradients, a `bg` tint for card
 * surfaces, and a Tailwind `text` class for foreground accents.
 *
 * The mapping is purely a presentation concern — no React hooks, no state.
 * The kiro_* role aliases preserve backwards compatibility with the legacy
 * Kiro role taxonomy (see `AcpSubagentDisplay.tsx` ROLE_LABELS).
 */

export type SubagentRoleStyle = {
  readonly from: string
  readonly to: string
  readonly bg: string
  readonly text: string
}

/**
 * The full subagent role taxonomy, including legacy `kiro_*` aliases.
 *
 * The first five entries are the canonical roles. `kiro_default`,
 * `kiro_planner`, and `kiro_guide` are aliases retained so older ACP
 * payloads continue to render with consistent styling.
 */
export const SUBAGENT_ROLES = [
  'default',
  'plan',
  'guide',
  'research',
  'builder',
  'kiro_default',
  'kiro_planner',
  'kiro_guide',
] as const

export type SubagentRole = (typeof SUBAGENT_ROLES)[number]

// Distinct gradient stops per canonical role. Aliases reuse the canonical
// palette so kiro_planner === plan, etc.
const ROLE_STYLES: Record<SubagentRole, SubagentRoleStyle> = {
  // Slate / cyan — neutral fallback for unclassified agents.
  default: {
    from: '#94a3b8',
    to: '#22d3ee',
    bg: 'rgba(148,163,184,0.12)',
    text: 'text-slate-400',
  },
  // Indigo → violet — planning / reasoning.
  plan: {
    from: '#6366f1',
    to: '#a855f7',
    bg: 'rgba(99,102,241,0.14)',
    text: 'text-indigo-400',
  },
  // Sky → teal — guides / docs surfacing.
  guide: {
    from: '#38bdf8',
    to: '#14b8a6',
    bg: 'rgba(56,189,248,0.14)',
    text: 'text-sky-400',
  },
  // Amber → rose — exploratory research.
  research: {
    from: '#fbbf24',
    to: '#f43f5e',
    bg: 'rgba(251,191,36,0.14)',
    text: 'text-amber-400',
  },
  // Emerald → lime — builders that produce artifacts.
  builder: {
    from: '#10b981',
    to: '#84cc16',
    bg: 'rgba(16,185,129,0.14)',
    text: 'text-emerald-400',
  },

  // Kiro aliases — reuse canonical palettes so the legacy roles stay
  // visually identical to their modern counterparts.
  kiro_default: {
    from: '#94a3b8',
    to: '#22d3ee',
    bg: 'rgba(148,163,184,0.12)',
    text: 'text-slate-400',
  },
  kiro_planner: {
    from: '#6366f1',
    to: '#a855f7',
    bg: 'rgba(99,102,241,0.14)',
    text: 'text-indigo-400',
  },
  kiro_guide: {
    from: '#38bdf8',
    to: '#14b8a6',
    bg: 'rgba(56,189,248,0.14)',
    text: 'text-sky-400',
  },
}

const ROLE_ICONS: Record<SubagentRole, ComponentType> = {
  default: IconRobot,
  plan: IconBrain,
  guide: IconBook,
  research: IconSearch,
  builder: IconHammer,
  kiro_default: IconRobot,
  kiro_planner: IconBrain,
  kiro_guide: IconBook,
}

const isKnownRole = (role: string): role is SubagentRole =>
  (SUBAGENT_ROLES as readonly string[]).includes(role)

/**
 * Returns the gradient + tint style for the given subagent role.
 *
 * Unknown roles fall back to the `default` palette rather than throwing,
 * so it is always safe to feed arbitrary strings from the ACP payload.
 */
export const getSubagentRoleColor = (role: string): SubagentRoleStyle => {
  if (isKnownRole(role)) {
    return ROLE_STYLES[role]
  }
  return ROLE_STYLES.default
}

/**
 * Returns the Tabler icon component for the given subagent role.
 *
 * Unknown roles fall back to `IconRobot` (the default role's icon).
 */
export const getSubagentRoleIcon = (role: string): ComponentType => {
  if (isKnownRole(role)) {
    return ROLE_ICONS[role]
  }
  return ROLE_ICONS.default
}
