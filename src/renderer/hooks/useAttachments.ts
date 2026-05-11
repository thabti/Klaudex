import { useState, useCallback, useEffect, useRef } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ipc } from '@/lib/ipc'
import { processDroppedFile, processNativePath } from '@/components/chat/attachment-utils'
import type { Attachment } from '@/types'

export function useAttachments(initialAttachments?: Attachment[], initialFolderPaths?: string[], isActive = true) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments ?? [])
  const [folderPaths, setFolderPaths] = useState<string[]>(initialFolderPaths ?? [])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addAttachments = useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(processDroppedFile))
    const valid = results.filter((a): a is Attachment => a !== null)
    if (valid.length > 0) setAttachments((prev) => [...prev, ...valid])
  }, [])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter((item) => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()
    const files = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null)
    if (files.length > 0) addAttachments(files)
  }, [addAttachments])

  const handleFilePickerClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) addAttachments(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [addAttachments])

  const clearAttachments = useCallback(() => {
    setAttachments([])
    setFolderPaths([])
  }, [])

  const handleRemoveFolder = useCallback((path: string) => {
    setFolderPaths((prev) => prev.filter((p) => p !== path))
  }, [])

  // Tauri native drag-drop listener
  useEffect(() => {
    let cancelled = false
    const appWindow = getCurrentWebviewWindow()
    const unlistenPromise = appWindow.onDragDropEvent(async (event) => {
      if (cancelled) return
      if (!isActive) {
        setIsDragOver(false)
        return
      }
      if (event.payload.type === 'over') {
        setIsDragOver(true)
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false)
        const paths = event.payload.paths ?? []
        const dirChecks = await Promise.all(paths.map(async (p) => ({ path: p, isDir: await ipc.isDirectory(p).catch(() => false) })))
        const folders = dirChecks.filter((d) => d.isDir).map((d) => d.path)
        const files = dirChecks.filter((d) => !d.isDir).map((d) => d.path)
        if (folders.length > 0 && !cancelled) {
          setFolderPaths((prev) => {
            const existing = new Set(prev)
            const newFolders = folders.filter((f) => !existing.has(f))
            return newFolders.length > 0 ? [...prev, ...newFolders] : prev
          })
        }
        if (files.length > 0) {
          const results = await Promise.all(files.map((p) => processNativePath(p)))
          const valid = results.filter((a): a is Attachment => a !== null)
          if (valid.length > 0 && !cancelled) setAttachments((prev) => [...prev, ...valid])
        }
      } else {
        setIsDragOver(false)
      }
    })
    return () => {
      cancelled = true
      unlistenPromise.then((fn) => fn())
    }
  }, [isActive])

  return {
    attachments,
    folderPaths,
    isDragOver,
    fileInputRef,
    handleRemoveAttachment,
    handleRemoveFolder,
    handlePaste,
    handleFilePickerClick,
    handleFileInputChange,
    clearAttachments,
  } as const
}
