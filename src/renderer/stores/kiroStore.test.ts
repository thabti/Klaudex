import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    getKiroConfig: vi.fn().mockResolvedValue({ agents: [], skills: [], steeringRules: [], mcpServers: [] }),
    onMcpConnecting: vi.fn().mockReturnValue(() => {}),
    onMcpUpdate: vi.fn().mockReturnValue(() => {}),
  },
}))

import { useKiroStore } from './kiroStore'

beforeEach(() => {
  useKiroStore.setState({
    config: {
      agents: [], skills: [], steeringRules: [],
      mcpServers: [
        { name: 'Slack', enabled: true, transport: 'stdio', command: 'slack-mcp', filePath: '/p' },
        { name: 'GitHub', enabled: true, transport: 'http', url: 'https://gh.mcp', filePath: '/p2' },
      ],
    },
    loading: false, loaded: true,
  })
})

describe('kiroStore', () => {
  it('has initial empty config before setup', () => {
    useKiroStore.setState({ config: { agents: [], skills: [], steeringRules: [], mcpServers: [] }, loaded: false })
    expect(useKiroStore.getState().config.agents).toEqual([])
    expect(useKiroStore.getState().loaded).toBe(false)
  })

  it('setMcpError patches matching server', () => {
    useKiroStore.getState().setMcpError('Slack', 'OAuth failed')
    const slack = useKiroStore.getState().config.mcpServers?.find((s) => s.name === 'Slack')
    expect(slack?.error).toBe('OAuth failed')
    expect(slack?.status).toBe('error')
  })

  it('setMcpError is case-insensitive', () => {
    useKiroStore.getState().setMcpError('slack', 'broken')
    const slack = useKiroStore.getState().config.mcpServers?.find((s) => s.name === 'Slack')
    expect(slack?.error).toBe('broken')
  })

  it('setMcpError no-op for unknown server', () => {
    const before = useKiroStore.getState().config.mcpServers
    useKiroStore.getState().setMcpError('Unknown', 'err')
    expect(useKiroStore.getState().config.mcpServers).toEqual(before)
  })

  it('updateMcpServer patches matching server', () => {
    useKiroStore.getState().updateMcpServer('GitHub', { status: 'ready' })
    const gh = useKiroStore.getState().config.mcpServers?.find((s) => s.name === 'GitHub')
    expect(gh?.status).toBe('ready')
  })

  it('updateMcpServer is case-insensitive', () => {
    useKiroStore.getState().updateMcpServer('github', { status: 'connecting' })
    const gh = useKiroStore.getState().config.mcpServers?.find((s) => s.name === 'GitHub')
    expect(gh?.status).toBe('connecting')
  })
})
