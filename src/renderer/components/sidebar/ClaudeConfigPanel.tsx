import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { IconRobot, IconBolt, IconCompass, IconChevronRight, IconSearch, IconPlug } from '@tabler/icons-react'
import { useClaudeConfigStore } from '@/stores/claudeConfigStore'
import { useTaskStore } from '@/stores/taskStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ClaudeFileViewer } from './ClaudeFileViewer'
import { type ViewerState, EMPTY_ARRAY, getAgentStack, SectionToggle, InlineSearch } from './claude-config-helpers'
import { AgentRow, AgentStackGroup } from './ClaudeAgentSection'
import { SkillRow } from './ClaudeSkillRow'
import { SteeringRow } from './ClaudeSteeringRow'
import { McpRow } from './ClaudeMcpRow'

export const ClaudeConfigPanel = memo(function ClaudeConfigPanel({
  collapsed,
  onToggleCollapse,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const agents = useClaudeConfigStore((s) => s.config.agents)
  const commands = useClaudeConfigStore((s) => s.config.commands)
  const memoryFiles = useClaudeConfigStore((s) => s.config.memoryFiles)
  const mcpServersRaw = useClaudeConfigStore((s) => s.config.mcpServers)
  const mcpServers = mcpServersRaw ?? EMPTY_ARRAY
  const loaded = useClaudeConfigStore((s) => s.loaded)
  const loadConfig = useClaudeConfigStore((s) => s.loadConfig)
  const activeWorkspace = useTaskStore((s) => {
    const id = s.selectedTaskId
    if (id) {
      const t = s.tasks[id]
      return t?.originalWorkspace ?? t?.workspace
    }
    return s.pendingWorkspace
  }) ?? null

  const [agentsOpen, setAgentsOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [viewer, setViewer] = useState<ViewerState | null>(null)

  useEffect(() => { void loadConfig(activeWorkspace ?? undefined) }, [loadConfig, activeWorkspace])

  const lowerSearch = search.toLowerCase()

  const agentGroups = useMemo(() => {
    const filtered = agents.filter((a) =>
      !lowerSearch || a.name.toLowerCase().includes(lowerSearch) || a.description.toLowerCase().includes(lowerSearch))
    const map = new Map<string, typeof agents>()
    for (const agent of filtered) {
      const stack = getAgentStack(agent.name)
      if (!map.has(stack)) map.set(stack, [])
      map.get(stack)!.push(agent)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] === 'custom' ? 1 : b[0] === 'custom' ? -1 : a[0].localeCompare(b[0]))
  }, [agents, lowerSearch])

  const filteredCommands = useMemo(() =>
    commands.filter((s: { name: string }) => !lowerSearch || s.name.toLowerCase().includes(lowerSearch)), [commands, lowerSearch])
  const filteredMemory = useMemo(() =>
    memoryFiles.filter((r: { name: string; excerpt: string }) => !lowerSearch || r.name.toLowerCase().includes(lowerSearch) || r.excerpt.toLowerCase().includes(lowerSearch)), [memoryFiles, lowerSearch])
  const filteredMcp = useMemo(() =>
    mcpServers.filter((m) => !lowerSearch || m.name.toLowerCase().includes(lowerSearch)), [mcpServers, lowerSearch])

  const totalAgents = agentGroups.reduce((n, [, a]) => n + a.length, 0)
  const mcpErrorCount = filteredMcp.filter((m) => m.status === 'error' || m.status === 'needs-auth').length
  const openViewer = useCallback((v: ViewerState) => setViewer(v), [])
  const closeViewer = useCallback(() => setViewer(null), [])

  if (!loaded) {
    return (
      <div className="flex flex-col gap-1.5 px-2 py-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-7 w-full rounded-lg skeleton" />)}
      </div>
    )
  }

  if (agents.length === 0 && commands.length === 0 && memoryFiles.length === 0 && mcpServers.length === 0) return null

  const noResults = !!search && totalAgents === 0 && filteredCommands.length === 0 && filteredMemory.length === 0 && filteredMcp.length === 0

  return (
    <>
      <div className="flex w-full min-w-0 flex-col">
        <div className="mb-0.5 flex items-center justify-between pr-1.5">
          <button type="button" onClick={onToggleCollapse}
            className="flex h-6 flex-1 items-center gap-1.5 pl-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-muted-foreground transition-colors">
            <IconChevronRight className={cn('size-3 shrink-0 transition-transform duration-150', !collapsed && 'rotate-90')} aria-hidden />
            Claude
          </button>
          {!collapsed && (agents.length + commands.length + memoryFiles.length + mcpServers.length) > 10 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => setSearching((v) => !v)}
                  className={cn('inline-flex size-5 cursor-pointer items-center justify-center rounded-md transition-colors',
                    searching ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                  <IconSearch className="size-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Filter</TooltipContent>
            </Tooltip>
          )}
        </div>

        {!collapsed && (
          <>
            {searching && <InlineSearch value={search} onChange={setSearch} onClose={() => setSearching(false)} />}

            {memoryFiles.length > 0 && (filteredMemory.length > 0 || !search) && (
              <SectionToggle icon={IconCompass} iconColor="text-emerald-600 dark:text-emerald-400" label="Memory" count={filteredMemory.length} expanded={rulesOpen} onToggle={() => setRulesOpen((v) => !v)} />
            )}
            {rulesOpen && filteredMemory.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredMemory.map((rule: any) => <SteeringRow key={`${rule.source}-${rule.name}`} rule={rule} onOpen={openViewer} />)}
              </ul>
            )}

            {commands.length > 0 && (filteredCommands.length > 0 || !search) && (
              <SectionToggle icon={IconBolt} iconColor="text-amber-600 dark:text-amber-400" label="Commands" count={filteredCommands.length} expanded={skillsOpen} onToggle={() => setSkillsOpen((v) => !v)} />
            )}
            {skillsOpen && filteredCommands.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredCommands.map((skill: any) => <SkillRow key={`${skill.source}-${skill.name}`} skill={skill} onOpen={openViewer} />)}
              </ul>
            )}

            {agents.length > 0 && (totalAgents > 0 || !search) && (
              <SectionToggle icon={IconRobot} iconColor="text-violet-600 dark:text-violet-400" label="Agents" count={totalAgents} expanded={agentsOpen} onToggle={() => setAgentsOpen((v) => !v)} />
            )}
            {agentsOpen && totalAgents > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {agentGroups.map(([stack, agentList]) =>
                  agentList.length === 1
                    ? <AgentRow key={`${agentList[0].source}-${agentList[0].name}`} agent={agentList[0]} onOpen={openViewer} />
                    : <AgentStackGroup key={stack} stack={stack} agents={agentList} onOpen={openViewer} />
                )}
              </ul>
            )}

            {mcpServers.length > 0 && (filteredMcp.length > 0 || !search) && (
              <SectionToggle icon={IconPlug} iconColor="text-sky-600 dark:text-sky-400" label="MCP" count={filteredMcp.length} errorCount={mcpErrorCount} expanded={mcpOpen} onToggle={() => setMcpOpen((v) => !v)} />
            )}
            {mcpOpen && filteredMcp.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredMcp.map((server) => <McpRow key={server.name} server={server} onOpen={openViewer} />)}
              </ul>
            )}

            {noResults && <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">No matches</p>}
          </>
        )}
      </div>

      {viewer && <ClaudeFileViewer filePath={viewer.filePath} title={viewer.title} onClose={closeViewer} />}
    </>
  )
})
