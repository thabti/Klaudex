import { useState, useEffect, useCallback, useMemo } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { IconX, IconArrowLeft, IconBrandGithub, IconSearch, IconRotate, IconShield, IconBolt } from '@tabler/icons-react'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { handleExternalLinkClick, handleExternalLinkKeyDown } from '@/lib/open-external'
import type { AppSettings } from '@/types'
import { applyTheme, persistTheme } from '@/lib/theme'
import { AboutDialog } from './AboutDialog'
import { NAV as SHARED_NAV, SEARCHABLE_SETTINGS, type Section as SharedSection } from './settings-shared'
import { AccountSection } from './account-section'
import { GeneralSection } from './general-section'
import { AppearanceSection } from './appearance-section'
import { KeymapSection } from './keymap-section'
import { AdvancedSection } from './advanced-section'
import { ArchivesSection } from './archives-section'
import { PermissionsSection } from './permissions-section'
import { HooksSection } from './hooks-section'

// Local Section union extends the shared one with TASK-106's `permissions`
// entry and TASK-114's `hooks` entry without modifying settings-shared.tsx
// (owned by parallel agents).
type Section = SharedSection | 'permissions' | 'hooks'

interface NavItem {
  id: Section
  label: string
  icon: typeof IconShield
  description: string
  sectionDescription: string
  group?: string
}

// Indices in `SHARED_NAV` (settings-shared.tsx):
//   0: account, 1: general, 2: appearance, 3: keymap, 4: advanced, 5: archives
// Insert `permissions` between `general` (idx 1) and `appearance` (idx 2),
// and `hooks` right after `advanced` (idx 4) so it sits in the Advanced
// cluster — TASK-114 explicitly asks for "under Advanced".
const NAV: readonly NavItem[] = [
  ...(SHARED_NAV.slice(0, 2) as readonly NavItem[]), // account, general
  {
    id: 'permissions',
    label: 'Permissions',
    icon: IconShield,
    description: 'Mode, allow, deny',
    sectionDescription: 'Control how Klaudex handles tool-call approval and which patterns auto-approve.',
    group: 'settings',
  },
  ...(SHARED_NAV.slice(2, 5) as readonly NavItem[]), // appearance, keymap, advanced
  {
    id: 'hooks',
    label: 'Hooks',
    icon: IconBolt,
    description: 'Read-only viewer',
    sectionDescription: 'Inspect Claude CLI hooks loaded from settings.json. Read-only.',
    group: 'settings',
  },
  ...(SHARED_NAV.slice(5) as readonly NavItem[]), // archives
]

const defaultSettings: AppSettings = {
  claudeBin: 'claude',
  agentProfiles: [],
  fontSize: 14,
  sidebarPosition: 'left',
  analyticsEnabled: true,
}

export const SettingsPanel = () => {
  const open = useTaskStore((s) => s.isSettingsOpen)
  const setOpen = useTaskStore((s) => s.setSettingsOpen)
  const settingsInitialSection = useTaskStore((s) => s.settingsInitialSection)
  const { settings, saveSettings, claudeAuthChecked, checkAuth } = useSettingsStore()

  const [section, setSection] = useState<Section>('general')
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [appVersion, setAppVersion] = useState('')
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}) }, [])
  useEffect(() => { if (open && !claudeAuthChecked) checkAuth() }, [open, claudeAuthChecked, checkAuth])
  useEffect(() => { setDraft(settings) }, [settings])

  useEffect(() => {
    if (open && settingsInitialSection) setSection(settingsInitialSection as Section)
  }, [open, settingsInitialSection])

  useEffect(() => {
    if (!open) return
    setSearchQuery('')
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    if (!open) return
    applyTheme(draft.theme ?? 'dark')
  }, [open, draft.theme])

  const handleSave = useCallback(() => {
    const mode = draft.theme ?? 'dark'
    persistTheme(mode)
    applyTheme(mode)
    saveSettings(draft)
    setOpen(false)
  }, [draft, saveSettings, setOpen])

  const handleClose = useCallback(() => {
    applyTheme(settings.theme ?? 'dark')
    setOpen(false)
  }, [settings.theme, setOpen])

  const handleRestoreDefaults = useCallback(() => {
    setDraft(defaultSettings)
  }, [])

  const updateDraft = useCallback((patch: Partial<AppSettings>) => {
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return SEARCHABLE_SETTINGS.filter((item) => {
      const haystack = `${item.label} ${item.description} ${item.keywords}`.toLowerCase()
      return q.split(/\s+/).every((word) => haystack.includes(word))
    })
  }, [searchQuery])

  const handleSearchResultClick = useCallback((targetSection: Section) => {
    setSection(targetSection)
    setSearchQuery('')
  }, [])

  if (!open) return null

  return (
    <div data-testid="settings-panel" className="fixed inset-0 z-50 flex animate-in fade-in-0 duration-150">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />

      <div className="relative z-10 flex w-full">
        {/* Sidebar */}
        <nav data-testid="settings-nav" className="flex w-56 shrink-0 flex-col border-r border-border/60 px-3 pt-16 pb-4">
          <div className="mb-4 px-3">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Configure Klaudex</p>
          </div>

          {/* Search */}
          <div className="relative mb-3 px-3">
            <IconSearch className="pointer-events-none absolute left-5.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings…"
              aria-label="Search settings"
              className="flex h-8 w-full rounded-lg border border-input bg-background/50 pl-8 pr-3 text-[12px] placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Search results dropdown */}
          {searchResults !== null && searchResults.length > 0 ? (
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
              {searchResults.map((item) => {
                const navItem = NAV.find((n) => n.id === item.section)
                return (
                  <button
                    key={`${item.section}-${item.label}`}
                    onClick={() => handleSearchResultClick(item.section)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    {navItem && <navItem.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />}
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Normal nav */
            <div className="flex flex-1 flex-col gap-0.5">
              {NAV.map((item, idx) => (
                <div key={item.id}>
                  {idx > 0 && NAV[idx - 1].group !== item.group && (
                    <div className="my-2 border-t border-border/50" />
                  )}
                  <button
                    onClick={() => setSection(item.id)}
                    className={cn(
                      'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all',
                      section === item.id
                        ? 'bg-primary/10 text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    {section === item.id && (
                      <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <item.icon className={cn('size-4 shrink-0', section === item.id ? 'text-primary' : 'opacity-60')} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-tight">{item.label}</p>
                      <p className="truncate text-[10px] opacity-50">{item.description}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto px-3 pt-4 border-t border-border/70 space-y-2">
            <button
              onClick={handleClose}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconArrowLeft className="size-4" />
              Back
            </button>
            <div className="flex items-center justify-between px-3 py-1">
              <button type="button" onClick={() => setIsAboutOpen(true)} className="text-left transition-colors hover:text-foreground">
                <p className="text-[10px] text-muted-foreground">Klaudex {appVersion ? `v${appVersion}` : ''}</p>
              </button>
              <a href="https://github.com/thabti/klaudex" onClick={handleExternalLinkClick} onKeyDown={handleExternalLinkKeyDown} aria-label="Klaudex on GitHub" tabIndex={0} className="text-muted-foreground transition-colors hover:text-foreground">
                <IconBrandGithub className="size-3.5" />
              </a>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-6">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span>Settings</span>
              <span>/</span>
              <span className="text-foreground/80 font-medium">{searchResults !== null ? 'Search' : NAV.find((n) => n.id === section)?.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRestoreDefaults}
                    className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Restore default settings"
                  >
                    <IconRotate className="size-3.5" />
                    Defaults
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Restore all settings to defaults</TooltipContent>
              </Tooltip>
              <button onClick={handleClose} className="rounded-lg border border-border/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
              <button onClick={handleSave} data-testid="settings-save-button" className="rounded-lg bg-primary px-4 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">Save changes</button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleClose} data-testid="settings-close-button" className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground">
                    <IconX className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close <kbd className="ml-1 text-[10px] opacity-50">Esc</kbd></TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-2xl space-y-6">
              {searchResults !== null ? (
                searchResults.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <IconSearch className="size-5 text-muted-foreground/40" />
                    <p className="text-[13px] text-muted-foreground">No settings match "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="mb-3 text-[12px] text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                    {searchResults.map((item) => {
                      const navItem = NAV.find((n) => n.id === item.section)
                      return (
                        <button
                          key={`${item.section}-${item.label}`}
                          onClick={() => handleSearchResultClick(item.section)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/70 px-5 py-3.5 text-left transition-colors hover:bg-accent/50"
                        >
                          {navItem && <navItem.icon className="size-4 shrink-0 text-muted-foreground/60" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground">{item.description}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{navItem?.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              ) : (
                <>
                  {section === 'account' && <AccountSection />}
                  {section === 'general' && <GeneralSection draft={draft} updateDraft={updateDraft} />}
                  {section === 'permissions' && <PermissionsSection settings={draft} updateDraft={updateDraft} />}
                  {section === 'appearance' && <AppearanceSection draft={draft} updateDraft={updateDraft} />}
                  {section === 'keymap' && <KeymapSection />}
                  {section === 'advanced' && <AdvancedSection draft={draft} updateDraft={updateDraft} onClose={handleClose} />}
                  {section === 'hooks' && <HooksSection />}
                  {section === 'archives' && <ArchivesSection />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AboutDialog open={isAboutOpen} onOpenChange={setIsAboutOpen} />
    </div>
  )
}
