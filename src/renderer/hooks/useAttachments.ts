import { useState, useCallback, useEffect, useRef } from 'react'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { processDroppedFile, processNativePath } from '@/components/chat/attachment-utils'
import type { Attachment } from '@/types'

export function useAttachments(initialAttachments?: Attachment[]) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments ?? [])
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

  const clearAttachments = useCallback(() => setAttachments([]), [])

  // Tauri native drag-drop listener
  useEffect(() => {
    let cancelled = false
    const appWindow = getCurrentWebviewWindow()
    const unlistenPromise = appWindow.onDragDropEvent(async (event) => {
      if (cancelled) return
      if (event.payload.type === 'over') {
        setIsDragOver(true)
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false)
        const paths = event.payload.paths ?? []
        const results = await Promise.all(paths.map((p) => processNativePath(p)))
        const valid = results.filter((a): a is Attachment => a !== null)
        if (valid.length > 0 && !cancelled) setAttachments((prev) => [...prev, ...valid])
      } else {
        setIsDragOver(false)
      }
    })
    return () => {
      cancelled = true
      unlistenPromise.then((fn) => fn())
    }
  }, [])

  return {
    attachments,
    isDragOver,
    fileInputRef,
    handleRemoveAttachment,
    handlePaste,
    handleFilePickerClick,
    handleFileInputChange,
    clearAttachments,
  } as const
}
