import type { ProjectFile } from '@/types'

export interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
  file?: ProjectFile
}

export function buildTree(files: ProjectFile[], rootPath: string): TreeNode[] {
  const root: TreeNode = { name: '', path: rootPath, isDir: true, children: [] }
  const dirMap = new Map<string, TreeNode>()
  dirMap.set('', root)

  const normalize = (p: string) => p.startsWith(rootPath) ? p.slice(rootPath.length).replace(/^\//, '') : p

  // Ensure parent dirs exist
  const ensureDir = (relDir: string): TreeNode => {
    if (dirMap.has(relDir)) return dirMap.get(relDir)!
    const parts = relDir.split('/')
    const parentRel = parts.slice(0, -1).join('/')
    const parent = ensureDir(parentRel)
    const node: TreeNode = {
      name: parts[parts.length - 1],
      path: rootPath + '/' + relDir,
      isDir: true,
      children: [],
    }
    dirMap.set(relDir, node)
    parent.children.push(node)
    return node
  }

  for (const file of files) {
    const rel = normalize(file.path)
    if (file.isDir) {
      ensureDir(rel)
    } else {
      const dirRel = normalize(file.dir)
      const parent = ensureDir(dirRel)
      parent.children.push({
        name: file.name,
        path: rootPath + '/' + rel,
        isDir: false,
        children: [],
        file,
      })
    }
  }

  // Sort: dirs first, then alphabetical
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    for (const n of nodes) {
      if (n.children.length > 0) sortNodes(n.children)
    }
  }

  sortNodes(root.children)
  return root.children
}
