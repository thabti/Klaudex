import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    getClaudeConfig: vi.fn().mockResolvedValue({ agents: [], commands: [], memoryFiles: [], mcpServers: [] }),
    saveMcpServerConfig: vi.fn().mockResolvedValue(undefined),
    onMcpConnecting: vi.fn().mockReturnValue(() => {}),
    onMcpUpdate: vi.fn().mockReturnValue(() => {}),
    onClaudeConfigChanged: vi.fn().mockReturnValue(() => {}),
  },
}))

import { useClaudeConfigStore, initClaudeConfigListeners } from './claudeConfigStore'
import { ipc } from '@/lib/ipc'

const makeMcpServers = () => [
  { name: 'Slack', enabled: true, transport: 'stdio' as const, command: 'slack-mcp', filePath: '/p' },
  { name: 'GitHub', enabled: true, transport: 'http' as const, url: 'https://gh.mcp', filePath: '/p2' },
  { name: 'Disabled', enabled: false, transport: 'stdio' as const, command: 'x', filePath: '/p3' },
]

beforeEach(() => {
  vi.clearAllMocks()
  useClaudeConfigStore.setState({
    configs: {},
    activeProject: null,
    config: { agents: [], commands: [], memoryFiles: [], mcpServers: makeMcpServers() },
    loading: false,
    loaded: true,
  })
})

describe('claudeConfigStore', () => {
  describe('loadConfig', () => {
    it('loads config from IPC and caches it', async () => {
      vi.mocked(ipc.getClaudeConfig).mockResolvedValue({
        agents: [{ name: 'Agent1', description: 'desc', tools: [], source: 'local', filePath: '/a' }],
        commands: [],
        memoryFiles: [],
        mcpServers: [],
      } as never)
      useClaudeConfigStore.setState({ loaded: false, configs: {} })
      await useClaudeConfigStore.getState().loadConfig('/project')
      expect(ipc.getClaudeConfig).toHaveBeenCalledWith('/project')
      expect(useClaudeConfigStore.getState().config.agents).toHaveLength(1)
      expect(useClaudeConfigStore.getState().loaded).toBe(true)
      expect(useClaudeConfigStore.getState().configs['/project']).toBeDefined()
    })

    it('returns cached config without IPC call', async () => {
      const cachedConfig = {
        agents: [{ name: 'Cached', description: '', tools: [] as string[], source: 'local' as const, filePath: '/c' }],
        commands: [],
        memoryFiles: [],
        mcpServers: [],
      }
      useClaudeConfigStore.setState({ configs: { '/project-a': cachedConfig } })
      await useClaudeConfigStore.getState().loadConfig('/project-a')
      expect(ipc.getClaudeConfig).not.toHaveBeenCalled()
      expect(useClaudeConfigStore.getState().config.agents[0].name).toBe('Cached')
      expect(useClaudeConfigStore.getState().activeProject).toBe('/project-a')
    })

    it('caches separate configs per project', async () => {
      const configA = { agents: [{ name: 'A', description: '', tools: [] as string[], source: 'local' as const, filePath: '/a' }], commands: [], memoryFiles: [], mcpServers: [] }
      const configB = { agents: [{ name: 'B', description: '', tools: [] as string[], source: 'local' as const, filePath: '/b' }], commands: [], memoryFiles: [], mcpServers: [] }
      vi.mocked(ipc.getClaudeConfig)
        .mockResolvedValueOnce(configA as never)
        .mockResolvedValueOnce(configB as never)
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig('/project-a')
      await useClaudeConfigStore.getState().loadConfig('/project-b')
      expect(ipc.getClaudeConfig).toHaveBeenCalledTimes(2)
      // Switch back to A — should use cache
      await useClaudeConfigStore.getState().loadConfig('/project-a')
      expect(ipc.getClaudeConfig).toHaveBeenCalledTimes(2) // no extra call
      expect(useClaudeConfigStore.getState().config.agents[0].name).toBe('A')
    })

    it('filters out agents without filePath', async () => {
      vi.mocked(ipc.getClaudeConfig).mockResolvedValue({
        agents: [
          { name: 'Good', description: '', tools: [], source: 'local', filePath: '/a' },
          { name: 'Bad', description: '', tools: [], source: 'local', filePath: '' },
        ],
        commands: [],
        memoryFiles: [],
        mcpServers: [],
      } as never)
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig()
      expect(useClaudeConfigStore.getState().config.agents).toHaveLength(1)
      expect(useClaudeConfigStore.getState().config.agents[0].name).toBe('Good')
    })

    it('sets loaded on error', async () => {
      vi.mocked(ipc.getClaudeConfig).mockRejectedValue(new Error('fail'))
      useClaudeConfigStore.setState({ loaded: false, configs: {} })
      await useClaudeConfigStore.getState().loadConfig()
      expect(useClaudeConfigStore.getState().loaded).toBe(true)
    })

    it('prevents concurrent loads', async () => {
      useClaudeConfigStore.setState({ loading: true })
      await useClaudeConfigStore.getState().loadConfig()
      expect(ipc.getClaudeConfig).not.toHaveBeenCalled()
    })

    it('sets loading false after completion', async () => {
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig()
      expect(useClaudeConfigStore.getState().loading).toBe(false)
    })
  })

  describe('invalidateConfig', () => {
    it('removes cached config for a project', async () => {
      const config = { agents: [], commands: [], memoryFiles: [], mcpServers: [] }
      useClaudeConfigStore.setState({ configs: { '/project': config } })
      useClaudeConfigStore.getState().invalidateConfig('/project')
      expect(useClaudeConfigStore.getState().configs['/project']).toBeUndefined()
    })

    it('forces reload on next loadConfig', async () => {
      const config = { agents: [], commands: [], memoryFiles: [], mcpServers: [] }
      useClaudeConfigStore.setState({ configs: { '/project': config } })
      useClaudeConfigStore.getState().invalidateConfig('/project')
      await useClaudeConfigStore.getState().loadConfig('/project')
      expect(ipc.getClaudeConfig).toHaveBeenCalledWith('/project')
    })
  })

  describe('setMcpError', () => {
    it('patches matching server in active config and all caches', () => {
      const config = { agents: [], commands: [], memoryFiles: [], mcpServers: makeMcpServers() }
      useClaudeConfigStore.setState({ configs: { '/p': config }, config })
      useClaudeConfigStore.getState().setMcpError('Slack', 'OAuth failed')
      const slack = useClaudeConfigStore.getState().config.mcpServers?.find((s) => s.name === 'Slack')
      expect(slack?.error).toBe('OAuth failed')
      expect(slack?.status).toBe('error')
      const cachedSlack = useClaudeConfigStore.getState().configs['/p']?.mcpServers?.find((s) => s.name === 'Slack')
      expect(cachedSlack?.error).toBe('OAuth failed')
    })

    it('is case-insensitive', () => {
      useClaudeConfigStore.getState().setMcpError('slack', 'broken')
      const slack = useClaudeConfigStore.getState().config.mcpServers?.find((s) => s.name === 'Slack')
      expect(slack?.error).toBe('broken')
    })

    it('no-ops for unknown server', () => {
      const before = useClaudeConfigStore.getState().config.mcpServers
      useClaudeConfigStore.getState().setMcpError('Unknown', 'err')
      expect(useClaudeConfigStore.getState().config.mcpServers).toEqual(before)
    })
  })

  describe('updateMcpServer', () => {
    it('patches matching server', () => {
      useClaudeConfigStore.getState().updateMcpServer('GitHub', { status: 'ready' })
      const gh = useClaudeConfigStore.getState().config.mcpServers?.find((s) => s.name === 'GitHub')
      expect(gh?.status).toBe('ready')
    })

    it('patches with oauthUrl', () => {
      useClaudeConfigStore.getState().updateMcpServer('GitHub', { oauthUrl: 'https://auth.example.com' })
      const gh = useClaudeConfigStore.getState().config.mcpServers?.find((s) => s.name === 'GitHub')
      expect(gh?.oauthUrl).toBe('https://auth.example.com')
    })
  })

  describe('initClaudeConfigListeners', () => {
    it('registers MCP listeners and returns cleanup', () => {
      const cleanup = initClaudeConfigListeners()
      expect(ipc.onMcpConnecting).toHaveBeenCalled()
      expect(ipc.onMcpUpdate).toHaveBeenCalled()
      expect(typeof cleanup).toBe('function')
    })

    it('onMcpConnecting sets enabled servers to connecting in all caches', () => {
      const config = { agents: [], commands: [], memoryFiles: [], mcpServers: makeMcpServers() }
      useClaudeConfigStore.setState({ configs: { '/p': config }, config })
      initClaudeConfigListeners()
      const cb = vi.mocked(ipc.onMcpConnecting).mock.calls[0][0]
      cb()
      const servers = useClaudeConfigStore.getState().config.mcpServers ?? []
      const slack = servers.find((s) => s.name === 'Slack')
      const disabled = servers.find((s) => s.name === 'Disabled')
      expect(slack?.status).toBe('connecting')
      expect(disabled?.status).toBeUndefined()
      // Also check cache
      const cachedSlack = useClaudeConfigStore.getState().configs['/p']?.mcpServers?.find((s) => s.name === 'Slack')
      expect(cachedSlack?.status).toBe('connecting')
    })

    it('onMcpUpdate patches specific server in all caches', () => {
      const config = { agents: [], commands: [], memoryFiles: [], mcpServers: makeMcpServers() }
      useClaudeConfigStore.setState({ configs: { '/p': config }, config })
      initClaudeConfigListeners()
      const cb = vi.mocked(ipc.onMcpUpdate).mock.calls[0][0]
      cb({ serverName: 'Slack', status: 'ready' })
      const slack = useClaudeConfigStore.getState().config.mcpServers?.find((s) => s.name === 'Slack')
      expect(slack?.status).toBe('ready')
      const cachedSlack = useClaudeConfigStore.getState().configs['/p']?.mcpServers?.find((s) => s.name === 'Slack')
      expect(cachedSlack?.status).toBe('ready')
    })
  })

  describe('error handling and edge cases', () => {
    it('loadConfig sets loaded true even when IPC throws', async () => {
      vi.mocked(ipc.getClaudeConfig).mockRejectedValue(new Error('network error'))
      useClaudeConfigStore.setState({ loaded: false, configs: {} })
      await useClaudeConfigStore.getState().loadConfig('/broken')
      expect(useClaudeConfigStore.getState().loaded).toBe(true)
      expect(useClaudeConfigStore.getState().loading).toBe(false)
      // Config should remain the default empty config, not corrupted
      expect(useClaudeConfigStore.getState().config).toEqual({ agents: [], commands: [], memoryFiles: [], mcpServers: makeMcpServers() })
    })

    it('loadConfig does not cache failed loads', async () => {
      vi.mocked(ipc.getClaudeConfig).mockRejectedValue(new Error('fail'))
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig('/broken')
      expect(useClaudeConfigStore.getState().configs['/broken']).toBeUndefined()
      // Retry should call IPC again
      vi.mocked(ipc.getClaudeConfig).mockResolvedValue({ agents: [], commands: [], memoryFiles: [], mcpServers: [] } as never)
      await useClaudeConfigStore.getState().loadConfig('/broken')
      expect(ipc.getClaudeConfig).toHaveBeenCalledTimes(2)
    })

    it('loadConfig handles null/undefined fields in response', async () => {
      vi.mocked(ipc.getClaudeConfig).mockResolvedValue({
        agents: null,
        skills: undefined,
        steeringRules: null,
        mcpServers: undefined,
      } as never)
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig('/project')
      const config = useClaudeConfigStore.getState().config
      expect(config.agents).toEqual([])
      expect(config.commands).toEqual([])
      expect(config.memoryFiles).toEqual([])
      expect(config.mcpServers).toEqual([])
    })

    it('invalidateConfig on non-existent key is a no-op', () => {
      useClaudeConfigStore.setState({ configs: { '/a': { agents: [], commands: [], memoryFiles: [], mcpServers: [] } } })
      useClaudeConfigStore.getState().invalidateConfig('/nonexistent')
      // /a should still be there
      expect(useClaudeConfigStore.getState().configs['/a']).toBeDefined()
    })

    it('loadConfig with undefined projectPath uses __global__ key', async () => {
      vi.mocked(ipc.getClaudeConfig).mockResolvedValue({ agents: [], commands: [], memoryFiles: [], mcpServers: [] } as never)
      useClaudeConfigStore.setState({ configs: {} })
      await useClaudeConfigStore.getState().loadConfig(undefined)
      expect(useClaudeConfigStore.getState().configs['__global__']).toBeDefined()
      expect(useClaudeConfigStore.getState().activeProject).toBe('__global__')
    })

    it('setMcpError with empty configs record does not throw', () => {
      useClaudeConfigStore.setState({ configs: {} })
      expect(() => useClaudeConfigStore.getState().setMcpError('Slack', 'err')).not.toThrow()
    })

    it('updateMcpServer with empty configs record does not throw', () => {
      useClaudeConfigStore.setState({ configs: {} })
      expect(() => useClaudeConfigStore.getState().updateMcpServer('Slack', { status: 'ready' })).not.toThrow()
    })

    it('switching projects updates activeProject and config atomically', async () => {
      const configA = { agents: [{ name: 'A', description: '', tools: [] as string[], source: 'local' as const, filePath: '/a' }], commands: [], memoryFiles: [], mcpServers: [] }
      const configB = { agents: [{ name: 'B', description: '', tools: [] as string[], source: 'local' as const, filePath: '/b' }], commands: [], memoryFiles: [], mcpServers: [] }
      useClaudeConfigStore.setState({ configs: { '/a': configA, '/b': configB } })
      await useClaudeConfigStore.getState().loadConfig('/a')
      expect(useClaudeConfigStore.getState().activeProject).toBe('/a')
      expect(useClaudeConfigStore.getState().config.agents[0].name).toBe('A')
      await useClaudeConfigStore.getState().loadConfig('/b')
      expect(useClaudeConfigStore.getState().activeProject).toBe('/b')
      expect(useClaudeConfigStore.getState().config.agents[0].name).toBe('B')
    })
  })
})
