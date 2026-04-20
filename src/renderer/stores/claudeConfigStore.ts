import { create } from 'zustand'
import type { ClaudeConfig, ClaudeMcpServer } from '@/types'
import { ipc } from '@/lib/ipc'
import { logStoreAction, logError } from '@/lib/debug-logger'

type McpStatus = ClaudeMcpServer['status']

const EMPTY_CONFIG: ClaudeConfig = { agents: [], commands: [], memoryFiles: [], mcpServers: [] }

interface ClaudeConfigStore {
  /** Per-project config cache keyed by workspace path */
  configs: Record<string, ClaudeConfig>
  /** Currently active project path */
  activeProject: string | null
  /** Derived config for the active project */
  config: ClaudeConfig
  loading: boolean
  loaded: boolean
  loadConfig: (projectPath?: string) => Promise<void>
  invalidateConfig: (projectPath: string) => void
  setMcpError: (serverName: string, error: string) => void
  updateMcpServer: (serverName: string, patch: Partial<{ status: McpStatus; error: string; oauthUrl: string }>) => void
}

const patchMcp = (config: ClaudeConfig, serverName: string, patch: object): ClaudeConfig => {
  const servers = config.mcpServers ?? []
  const idx = servers.findIndex((m) => m.name.toLowerCase() === serverName.toLowerCase())
  if (idx < 0) return config
  const updated = [...servers]
  updated[idx] = { ...updated[idx], ...patch }
  return { ...config, mcpServers: updated }
}

/** Apply an MCP patch to all cached configs (MCP servers are global) */
const patchAllConfigs = (configs: Record<string, ClaudeConfig>, serverName: string, patch: object): Record<string, ClaudeConfig> => {
  const next: Record<string, ClaudeConfig> = {}
  let changed = false
  for (const [key, cfg] of Object.entries(configs)) {
    const patched = patchMcp(cfg, serverName, patch)
    if (patched !== cfg) changed = true
    next[key] = patched
  }
  return changed ? next : configs
}

const sanitizeConfig = (config: ClaudeConfig): ClaudeConfig => ({
  agents: (config.agents ?? []).filter((a) => a.filePath),
  commands: (config.commands ?? []).filter((s) => s.filePath),
  memoryFiles: (config.memoryFiles ?? []).filter((r) => r.filePath),
  mcpServers: config.mcpServers ?? [],
})

export const useClaudeConfigStore = create<ClaudeConfigStore>((set, get) => {
  return {
    configs: {},
    activeProject: null,
    config: EMPTY_CONFIG,
    loading: false,
    loaded: false,

    loadConfig: async (projectPath?: string) => {
      const key = projectPath ?? '__global__'
      // Return cached if available
      const cached = get().configs[key]
      if (cached) {
        if (get().activeProject !== key || get().config !== cached) {
          set({ activeProject: key, config: cached, loaded: true })
        }
        return
      }
      if (get().loading) return
      logStoreAction('claudeConfigStore', 'loadConfig', { projectPath: key })
      set({ loading: true, activeProject: key })
      try {
        const raw = await ipc.getClaudeConfig(projectPath)
        const safe = sanitizeConfig(raw)
        logStoreAction('claudeConfigStore', 'loadConfig:done', { agents: safe.agents.length, commands: safe.commands.length, mcpServers: safe.mcpServers?.length ?? 0 })
        set((s) => ({
          configs: { ...s.configs, [key]: safe },
          config: safe,
          loaded: true,
        }))
      } catch (err) {
        logError('claudeConfigStore.loadConfig', err)
        set({ loaded: true })
      } finally {
        set({ loading: false })
      }
    },

    invalidateConfig: (projectPath) => {
      const key = projectPath ?? '__global__'
      set((s) => {
        const { [key]: _, ...rest } = s.configs
        return { configs: rest }
      })
    },

    setMcpError: (serverName, error) => set((s) => {
      logStoreAction('claudeConfigStore', 'setMcpError', { serverName, error })
      const configs = patchAllConfigs(s.configs, serverName, { error, status: 'error' as const })
      const config = patchMcp(s.config, serverName, { error, status: 'error' as const })
      return { configs, config }
    }),

    updateMcpServer: (serverName, patch) => set((s) => {
      const configs = patchAllConfigs(s.configs, serverName, patch)
      const config = patchMcp(s.config, serverName, patch)
      return { configs, config }
    }),
  }
})

export function initClaudeConfigListeners(): () => void {
  const unsub1 = ipc.onMcpConnecting(() => {
    useClaudeConfigStore.setState((s) => {
      const mcpPatch = (cfg: ClaudeConfig): ClaudeConfig => ({
        ...cfg,
        mcpServers: (cfg.mcpServers ?? []).map((m) =>
          m.enabled ? { ...m, status: 'connecting' as const, error: undefined, oauthUrl: undefined } : m
        ),
      })
      const configs: Record<string, ClaudeConfig> = {}
      for (const [key, cfg] of Object.entries(s.configs)) {
        configs[key] = mcpPatch(cfg)
      }
      return { configs, config: mcpPatch(s.config) }
    })
  })

  const unsub2 = ipc.onMcpUpdate(({ serverName, status, error, oauthUrl }) => {
    useClaudeConfigStore.setState((s) => {
      const patch = {
        status: status as McpStatus,
        ...(error !== undefined ? { error } : {}),
        ...(oauthUrl !== undefined ? { oauthUrl } : {}),
      }
      const configs = patchAllConfigs(s.configs, serverName, patch)
      const config = patchMcp(s.config, serverName, patch)
      return { configs, config }
    })
  })

  return () => { unsub1(); unsub2() }
}
