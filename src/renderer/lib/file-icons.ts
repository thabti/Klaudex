/**
 * File icon resolution using material-icon-theme.
 * Maps file names and extensions to SVG icon names from the VS Code Material Icon Theme.
 *
 * The manifest is loaded once via dynamic import and cached.
 * Until loaded, fallback icon names are used.
 */

interface IconManifest {
  fileExtensions: Record<string, string>
  fileNames: Record<string, string>
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
  file: string
  folder: string
  folderExpanded: string
}

let manifest: IconManifest = {
  fileExtensions: {},
  fileNames: {},
  folderNames: {},
  folderNamesExpanded: {},
  file: 'file',
  folder: 'folder',
  folderExpanded: 'folder-open',
}

let loaded = false

/** Load the manifest. Call once at app startup. */
export async function loadFileIconManifest(): Promise<void> {
  if (loaded) return
  try {
    const mod = await import('material-icon-theme/dist/material-icons.json')
    const m = mod.default ?? mod
    manifest = {
      fileExtensions: m.fileExtensions ?? {},
      fileNames: m.fileNames ?? {},
      folderNames: m.folderNames ?? {},
      folderNamesExpanded: m.folderNamesExpanded ?? {},
      file: m.file ?? 'file',
      folder: m.folder ?? 'folder',
      folderExpanded: m.folderExpanded ?? 'folder-open',
    }
    loaded = true
  } catch (e) {
    console.warn('[file-icons] Failed to load manifest:', e)
  }
}

// Eagerly start loading on module evaluation
loadFileIconManifest()

/**
 * Resolve the icon name for a given file name.
 * Checks exact file name first, then tries extensions (longest match first).
 */
export function getFileIconName(fileName: string): string {
  const lower = fileName.toLowerCase()

  // 1. Exact file name match
  if (manifest.fileNames[lower]) return manifest.fileNames[lower]

  // 2. Try compound extensions (e.g., "spec.ts", "test.tsx", "config.js")
  const parts = lower.split('.')
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.')
    if (manifest.fileExtensions[ext]) return manifest.fileExtensions[ext]
  }

  return manifest.file
}

/**
 * Resolve the icon name for a given folder name.
 */
export function getFolderIconName(folderName: string, isExpanded: boolean): string {
  const lower = folderName.toLowerCase()

  if (isExpanded) {
    if (manifest.folderNamesExpanded[lower]) return manifest.folderNamesExpanded[lower]
    return manifest.folderExpanded
  }

  if (manifest.folderNames[lower]) return manifest.folderNames[lower]
  return manifest.folder
}

/**
 * Get the URL path to the SVG icon file.
 * In dev, served by the Vite middleware plugin.
 * In production, icons are copied to dist/material-icons/.
 */
export function getIconPath(iconName: string): string {
  return `/material-icons/${iconName}.svg`
}
