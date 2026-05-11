import { useState, useCallback } from 'react'
import { IconUpload, IconRotate } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/types'
import { ipc } from '@/lib/ipc'
import { Switch } from '@/components/ui/switch'
import { SectionHeader, SettingsCard, SettingRow, SettingsGrid, Divider } from './settings-shared'
import ThemeSelector from './ThemeSelector'
import defaultAppIcon from '../../../../src-tauri/icons/prod/icon.png'

const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 22
const MAX_ICON_BYTES = 2 * 1024 * 1024

interface AppearanceSectionProps {
  draft: AppSettings
  updateDraft: (patch: Partial<AppSettings>) => void
}

export const AppearanceSection = ({ draft, updateDraft }: AppearanceSectionProps) => {
  const fontSize = draft.fontSize ?? 14
  const chatFontSize = draft.chatFontSize ?? draft.fontSize ?? 14
  const [iconError, setIconError] = useState<string | null>(null)
  const [isIconLoading, setIsIconLoading] = useState(false)
  const hasCustomIcon = !!draft.customAppIcon

  const handleFontSizeInput = (value: string) => {
    const num = Number(value)
    if (Number.isNaN(num)) return
    updateDraft({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, num)) })
  }

  const handleChatFontSizeInput = (value: string) => {
    const num = Number(value)
    if (Number.isNaN(num)) return
    updateDraft({ chatFontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, num)) })
  }

  const handleResetChatFontSize = () => {
    // Setting to undefined makes it fall back to the UI font size.
    updateDraft({ chatFontSize: undefined })
  }

  const handleUploadIcon = useCallback(async () => {
    setIconError(null)
    try {
      const filePath = await ipc.pickImage()
      if (!filePath) return
      setIsIconLoading(true)
      const base64 = await ipc.readFileBase64(filePath)
      if (!base64) { setIconError('Could not read file.'); setIsIconLoading(false); return }
      if (Math.ceil(base64.length * 3 / 4) > MAX_ICON_BYTES) { setIconError('Max 2 MB.'); setIsIconLoading(false); return }
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
      updateDraft({ customAppIcon: `data:${mime};base64,${base64}` })
      setIsIconLoading(false)
    } catch (err) {
      setIconError(err instanceof Error ? err.message : 'Failed to load image.')
      setIsIconLoading(false)
    }
  }, [updateDraft])

  const handleResetIcon = useCallback(() => {
    setIconError(null)
    updateDraft({ customAppIcon: null })
  }, [updateDraft])

  const displayIcon = hasCustomIcon ? draft.customAppIcon! : defaultAppIcon

  return (
    <>
      <SectionHeader section="appearance" />

      {/* ── Look & feel ─────────────────────────────────────── */}
      <SettingsGrid label="Look & feel" description="Theme, icon, and color scheme">
        <SettingsCard>
          {/* App icon row */}
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div className="flex items-center gap-3.5">
              <img
                src={displayIcon}
                alt="App icon"
                className="size-12 rounded-xl border border-border/60 bg-background/50 object-cover shadow-sm"
                draggable={false}
              />
              <div>
                <p className="text-[12.5px] font-medium text-foreground">App icon</p>
                <p className="text-[11px] text-muted-foreground">
                  {hasCustomIcon ? 'Custom icon' : 'Default Klaudex icon'} · About dialog & dock
                </p>
                {iconError && <p className="mt-0.5 text-[10px] text-red-500" role="alert">{iconError}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {hasCustomIcon && (
                <button
                  type="button"
                  onClick={handleResetIcon}
                  aria-label="Reset to default app icon"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <IconRotate className="size-3" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleUploadIcon}
                disabled={isIconLoading}
                aria-label="Upload custom app icon"
                className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <IconUpload className="size-3" />
                {isIconLoading ? 'Loading…' : 'Change'}
              </button>
            </div>
          </div>

          <Divider />

          {/* Theme row */}
          <div className="py-3">
            <p className="mb-2 text-[12.5px] font-medium text-foreground">Theme</p>
            <ThemeSelector
              value={draft.theme ?? 'dark'}
              onChange={(mode) => updateDraft({ theme: mode })}
            />
          </div>
        </SettingsCard>
      </SettingsGrid>

      {/* ── Display ─────────────────────────────────────────── */}
      <SettingsGrid label="Display" description="Font size and layout">
        <SettingsCard>
          {/* UI font size */}
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12.5px] font-medium text-foreground">UI font size</p>
                <p className="text-[11px] text-muted-foreground">Sidebar, file tree, header, dialogs</p>
              </div>
              <input
                type="number"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={fontSize}
                onChange={(e) => handleFontSizeInput(e.target.value)}
                aria-label="UI font size value"
                className="w-12 rounded-md border border-input bg-background/50 px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-primary outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{FONT_SIZE_MIN}</span>
              <input
                type="range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={fontSize}
                onChange={(e) => updateDraft({ fontSize: Number(e.target.value) })}
                aria-label="UI font size"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border/60 accent-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
              />
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{FONT_SIZE_MAX}</span>
            </div>
            <div className="mt-2 rounded-md border border-border/40 bg-background/30 px-3 py-1.5">
              <p className="text-foreground/70 leading-relaxed" style={{ fontSize }}>The quick brown fox jumps over the lazy dog</p>
            </div>
          </div>

          <Divider />

          {/* Chat font size */}
          <div className="py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12.5px] font-medium text-foreground">Chat font size</p>
                <p className="text-[11px] text-muted-foreground">
                  Chat messages, markdown rendering, and the message input
                  {draft.chatFontSize == null && <span className="ml-1 text-muted-foreground/70">· following UI font size</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {draft.chatFontSize != null && (
                  <button
                    type="button"
                    onClick={handleResetChatFontSize}
                    aria-label="Reset chat font size to follow UI font size"
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <IconRotate className="size-3" />
                    Reset
                  </button>
                )}
                <input
                  type="number"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={chatFontSize}
                  onChange={(e) => handleChatFontSizeInput(e.target.value)}
                  aria-label="Chat font size value"
                  className="w-12 rounded-md border border-input bg-background/50 px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-primary outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{FONT_SIZE_MIN}</span>
              <input
                type="range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={chatFontSize}
                onChange={(e) => updateDraft({ chatFontSize: Number(e.target.value) })}
                aria-label="Chat font size"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border/60 accent-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
              />
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{FONT_SIZE_MAX}</span>
            </div>
            <div className="mt-2 rounded-md border border-border/40 bg-background/30 px-3 py-1.5">
              <p className="text-foreground/70 leading-[1.7]" style={{ fontSize: chatFontSize }}>
                Markdown preview rendered at the chat font size.
              </p>
            </div>
          </div>

          <Divider />

          {/* Sidebar position */}
          <SettingRow label="Sidebar position" description="Place the sidebar on the left or right">
            <div className="flex gap-1.5">
              {(['left', 'right'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => updateDraft({ sidebarPosition: pos })}
                  className={cn(
                    'rounded-md border px-4 py-1.5 text-[11px] font-medium capitalize transition-colors',
                    (draft.sidebarPosition ?? 'left') === pos
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>
          </SettingRow>
        </SettingsCard>
      </SettingsGrid>

      {/* ── Chat layout ─────────────────────────────────────── */}
      <SettingsGrid label="Chat layout" description="How tool activity appears in threads">
        <SettingsCard>
          <SettingRow
            label="Inline tool calls"
            description="Show each tool entry between paragraphs at the moment the agent ran it. When off, tool activity collapses into a single card after the assistant's reply."
          >
            <Switch
              checked={draft.inlineToolCalls === true}
              onCheckedChange={(checked) => updateDraft({ inlineToolCalls: checked })}
              aria-label="Toggle inline tool calls"
            />
          </SettingRow>
        </SettingsCard>
      </SettingsGrid>
    </>
  )
}
