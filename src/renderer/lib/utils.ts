import { type CxOptions, cx } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: CxOptions) {
  return twMerge(cx(inputs))
}

/**
 * Concatenate a new streaming chunk onto accumulated text, inserting a space
 * when the accumulated text ends with sentence-ending punctuation and the
 * new chunk starts with a non-whitespace character.
 */
export function joinChunk(accumulated: string, chunk: string): string {
  if (!accumulated || !chunk) return accumulated + chunk
  const lastChar = accumulated[accumulated.length - 1]
  const firstChar = chunk[0]
  if (/[.!?:]/.test(lastChar) && /\S/.test(firstChar)) {
    return accumulated + ' ' + chunk
  }
  return accumulated + chunk
}

const MAX_SLUG_LENGTH = 64 as const

/** Convert a thread name to a valid worktree slug. */
export const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
}

/** Validate a slug matches the Rust-side rules. */
export const isValidWorktreeSlug = (slug: string): boolean => {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) return false
  if (slug.includes('..')) return false
  return /^[a-zA-Z0-9._-]+$/.test(slug)
}
