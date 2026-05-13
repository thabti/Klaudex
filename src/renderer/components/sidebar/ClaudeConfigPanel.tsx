import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { IconRobot, IconBolt, IconCompass, IconSearch, IconPlug, IconEdit, IconHandFinger, IconPlus, IconAlignLeft, IconCommand } from '@tabler/icons-react'
import { AnthropicIcon } from '@/lib/model-icons'
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
import { ClaudeCommandRow } from './ClaudeCommandRow'
import { AddMcpServerDialog } from './AddMcpServerDialog'

export const ClaudeConfigPanel = memo(function ClaudeConfigPanel({
  collapsed,
  onToggleCollapse,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const agents = useClaudeConfigStore((s) => s.config.agents)
  const commands = useClaudeConfigStore((s) => s.config.commands)
  const skills = useClaudeConfigStore((s) => s.config.skills)
  const steeringRules = useClaudeConfigStore((s) => s.config.steeringRules)
  const memoryFiles = useClaudeConfigStore((s) => s.config.memoryFiles)
  const mcpServersRaw = useClaudeConfigStore((s) => s.config.mcpServers)
  const mcpServers = mcpServersRaw ?? EMPTY_ARRAY
  const prompts = useClaudeConfigStore((s) => s.config.prompts)
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
  const [skillsSectionOpen, setSkillsSectionOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [mcpOpen, setMcpOpen] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [addMcpOpen, setAddMcpOpen] = useState(false)

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
  const filteredSkills = useMemo(() =>
    skills.filter((s) => !lowerSearch || s.name.toLowerCase().includes(lowerSearch)), [skills, lowerSearch])
  const filteredRules = useMemo(() =>
    steeringRules.filter((r) => !lowerSearch || r.name.toLowerCase().includes(lowerSearch) || r.excerpt.toLowerCase().includes(lowerSearch)), [steeringRules, lowerSearch])
  const filteredMemory = useMemo(() =>
    memoryFiles.filter((r: { name: string; excerpt: string }) => !lowerSearch || r.name.toLowerCase().includes(lowerSearch) || r.excerpt.toLowerCase().includes(lowerSearch)), [memoryFiles, lowerSearch])
  const filteredMcp = useMemo(() =>
    mcpServers.filter((m) => !lowerSearch || m.name.toLowerCase().includes(lowerSearch)), [mcpServers, lowerSearch])
  const filteredPrompts = useMemo(() =>
    prompts.filter((p) => !lowerSearch || p.name.toLowerCase().includes(lowerSearch) || p.content.toLowerCase().includes(lowerSearch)), [prompts, lowerSearch])

  const totalAgents = agentGroups.reduce((n, [, a]) => n + a.length, 0)
  const mcpErrorCount = filteredMcp.filter((m) => m.status === 'error' || m.status === 'needs-auth').length
  const openViewer = useCallback((v: ViewerState) => setViewer(v), [])
  const closeViewer = useCallback(() => setViewer(null), [])

  if (!loaded) {
    return (
      <div className="flex flex-col gap-1.5 px-2 py-2">
        {[1, 2, 3].map((i) => <div key={`skel-${i}`} className="h-7 w-full rounded-lg skeleton" />)}
      </div>
    )
  }

  // Always render the panel once loaded — even with no items, the user needs
  // the "Add MCP server" button. The panel is hidden by the parent sidebar
  // when the workspace has no .claude directory at all.
  if (agents.length === 0 && skills.length === 0 && steeringRules.length === 0 && mcpServers.length === 0 && prompts.length === 0) {
    // Nothing configured yet — show just the "Add MCP server" affordance
    // so a fresh install isn't a dead end.
    return (
      <>
        <div className="flex w-full min-w-0 flex-col">
          <div className="mb-0.5 flex items-center justify-between pr-1.5">
            <button type="button" onClick={onToggleCollapse}
              className="flex h-6 flex-1 cursor-pointer items-center gap-1.5 pl-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-muted-foreground transition-colors">
              <AnthropicIcon size={12} className="shrink-0 text-muted-foreground" />
              Claude
            </button>
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setAddMcpOpen(true)}
              className="flex w-full h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-left text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <IconPlus className="size-3.5 shrink-0" aria-hidden />
              <IconPlug className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <span className="flex-1 truncate">Add MCP server…</span>
            </button>
          )}
        </div>
        <AddMcpServerDialog open={addMcpOpen} onOpenChange={setAddMcpOpen} workspace={activeWorkspace} />
      </>
    )
  }

  const noResults = !!search && totalAgents === 0 && filteredSkills.length === 0 && filteredRules.length === 0 && filteredMcp.length === 0 && filteredPrompts.length === 0

  return (
    <>
      <div className="flex w-full min-w-0 flex-col">
        <div className="mb-0.5 flex items-center justify-between pr-1.5">
          <button type="button" onClick={onToggleCollapse}
            className="flex h-6 flex-1 cursor-pointer items-center gap-1.5 pl-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-muted-foreground transition-colors">
              <AnthropicIcon size={12} className="shrink-0 text-muted-foreground" />
              Claude
          </button>
          {!collapsed && (
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex size-5 items-center justify-center text-muted-foreground/70" aria-label="Drag tip">
                    <IconHandFinger className="size-3" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  <p className="text-[11px] font-medium">Drag into chat</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">Drop any agent, skill, or steering rule into the message box to attach it as context.</p>
                </TooltipContent>
              </Tooltip>
              {(agents.length + skills.length + steeringRules.length + mcpServers.length) > 10 && (
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

            {(commands.length > 0 || !search) && (
              <SectionToggle icon={IconCommand} iconColor="text-amber-600 dark:text-amber-400" label="Commands" count={filteredCommands.length} expanded={skillsOpen} onToggle={() => setSkillsOpen((v) => !v)} />
            )}
            {skillsOpen && filteredCommands.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredCommands.map((cmd) => (
                  <ClaudeCommandRow key={`${cmd.source}:${cmd.filePath}`} command={cmd} />
                ))}
              </ul>
            )}
            {skillsOpen && commands.length === 0 && !search && (
              <p className="border-l mx-1 px-2 py-1.5 text-[10px] text-muted-foreground" style={{ borderColor: 'var(--border)' }}>
                No slash commands
              </p>
            )}

            {skills.length > 0 && (filteredSkills.length > 0 || !search) && (
              <SectionToggle icon={IconBolt} iconColor="text-amber-600 dark:text-amber-400" label="Skills" count={filteredSkills.length} expanded={skillsSectionOpen} onToggle={() => setSkillsSectionOpen((v) => !v)} />
            )}
            {skillsSectionOpen && filteredSkills.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredSkills.map((skill) => <SkillRow key={`${skill.source}-${skill.name}`} skill={skill} onOpen={openViewer} />)}
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
              <div className="flex items-center">
                <SectionToggle icon={IconPlug} iconColor="text-sky-600 dark:text-sky-400" label="MCP" count={filteredMcp.length} errorCount={mcpErrorCount} expanded={mcpOpen} onToggle={() => setMcpOpen((v) => !v)} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setAddMcpOpen(true)}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <IconPlus className="size-3" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add MCP server</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        const fp = mcpServers[0]?.filePath
                        if (fp) openViewer({ filePath: fp, title: 'MCP Config' })
                      }}
                      className="mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <IconEdit className="size-3" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Edit mcp.json</TooltipContent>
                </Tooltip>
              </div>
            )}
            {/* Show an "Add MCP server" affordance even when there are zero servers configured. */}
            {mcpServers.length === 0 && (
              <button
                type="button"
                onClick={() => setAddMcpOpen(true)}
                className="flex w-full h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-left text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <IconPlus className="size-3.5 shrink-0" aria-hidden />
                <IconPlug className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                <span className="flex-1 truncate">Add MCP server…</span>
              </button>
            )}
            {mcpOpen && filteredMcp.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredMcp.map((server) => <McpRow key={server.name} server={server} onOpen={openViewer} />)}
              </ul>
            )}

            {prompts.length > 0 && (filteredPrompts.length > 0 || !search) && (
              <SectionToggle icon={IconAlignLeft} iconColor="text-indigo-600 dark:text-indigo-400" label="Prompts" count={filteredPrompts.length} expanded={promptsOpen} onToggle={() => setPromptsOpen((v) => !v)} />
            )}
            {promptsOpen && filteredPrompts.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-px border-l mx-1 px-1.5 py-px" style={{ borderColor: 'var(--border)' }}>
                {filteredPrompts.map((prompt) => (
                  <li key={`${prompt.source}-${prompt.name}`}>
                    <button
                      type="button"
                      onClick={() => openViewer({ filePath: prompt.filePath, title: prompt.name })}
                      className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <IconAlignLeft className="size-3 shrink-0 text-indigo-500 dark:text-indigo-400" aria-hidden />
                      <span className="flex-1 truncate">{prompt.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">{prompt.source}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {noResults && <p className="px-2 py-3 text-center text-[10px] text-muted-foreground">No matches</p>}
          </>
        )}
      </div>

      {viewer && <ClaudeFileViewer filePath={viewer.filePath} title={viewer.title} onClose={closeViewer} />}
      <AddMcpServerDialog open={addMcpOpen} onOpenChange={setAddMcpOpen} workspace={activeWorkspace} />
    </>
  )
})
