'use client'

import { useEffect, useState } from 'react'

import { AgentCard } from '@/components/AgentCard'
import { RunDetailDrawer } from '@/components/RunDetailDrawer'
import { StatStrip } from '@/components/StatStrip'
import { SystemMap } from '@/components/SystemMap'
import { LiveActivityFeed } from '@/components/LiveActivityFeed'
import { CostsTab } from '@/components/CostsTab'
import { getAgentVisual } from '@/lib/ui/agentVisuals'
import type {
  AgentDashboardRun,
  AgentDashboardSummary,
  HealthStripData,
} from '@/lib/services/agentDashboardService'
import { useUserRole } from '@/lib/auth/useUserRole'
import type { LucideIcon } from 'lucide-react'

type AgentConfig = {
  id: string
  name: string
  purpose: string
  triggerLabel: string
  icon: LucideIcon
  iconVariant?: 'default' | 'green' | 'amber' | 'violet' | 'warm'
  callsLabel: string
}

const AGENTS: AgentConfig[] = [
  {
    id: 'matchmaker',
    name: 'The Matchmaker',
    purpose: 'Pairs fresh demand with active inventory and escalates the hottest pairings into outbound calls.',
    triggerLabel: 'Event / cron',
    icon: getAgentVisual('matchmaker').icon,
    iconVariant: 'default',
    callsLabel: 'Matches',
  },
  {
    id: 'follow_up_agent',
    name: 'The Follow-Up Agent',
    purpose: 'Reactivates scheduled follow-ups and pushes stalled buyers back into the conversation loop.',
    triggerLabel: 'Cron · hourly',
    icon: getAgentVisual('follow_up_agent').icon,
    iconVariant: 'green',
    callsLabel: 'Calls',
  },
  {
    id: 'appointment_guardian',
    name: 'The Appointment Guardian',
    purpose: 'Scans the next 24 hours of appointments and issues reminder calls before brokers lose the slot.',
    triggerLabel: 'Cron · 09:00 IST',
    icon: getAgentVisual('appointment_guardian').icon,
    iconVariant: 'amber',
    callsLabel: 'Reminders',
  },
  {
    id: 'dead_lead_reengager',
    name: 'The Dead Lead Re-engager',
    purpose: 'Finds cold or forgotten demand that still has signal and reopens the thread with a lighter touch.',
    triggerLabel: 'Cron · 10:00 IST',
    icon: getAgentVisual('dead_lead_reengager').icon,
    iconVariant: 'violet',
    callsLabel: 'Re-engage',
  },
  {
    id: 'price_drop_negotiator',
    name: 'The Price Drop Negotiator',
    purpose: 'Responds to property price events and resurfaces buyers whose objections were budget-driven.',
    triggerLabel: 'Event',
    icon: getAgentVisual('price_drop_negotiator').icon,
    iconVariant: 'warm',
    callsLabel: 'Calls',
  },
]

const VOICE_ORCHESTRATOR: AgentConfig = {
  id: 'voice_orchestrator',
  name: 'Voice Orchestrator',
  purpose: 'Routes Vapi tool-calls mid-call and keeps per-lead shared memory coherent across sessions.',
  triggerLabel: 'Live · Vapi webhook',
  icon: getAgentVisual('voice_orchestrator').icon,
  iconVariant: 'default',
  callsLabel: 'Tool calls',
}

function buildCounters(summary?: AgentDashboardSummary, run?: AgentDashboardRun | null, callsLabel?: string) {
  const output = run?.output_data || {}
  const lastOutputValue =
    typeof output.matches_found === 'number'
      ? output.matches_found
      : typeof output.triggered_calls === 'number'
        ? output.triggered_calls
        : Array.isArray((output as any).lead_details)
          ? (output as any).lead_details.length
          : typeof output.total_scanned === 'number'
            ? output.total_scanned
            : 0

  return [
    { label: 'Runs 24h', value: String(summary?.runs_24h ?? 0) },
    { label: 'Success', value: `${summary?.success_rate ?? 0}%` },
    { label: 'KB hits', value: String(summary?.kb_hits_24h ?? 0) },
    { label: callsLabel || 'Output', value: String(lastOutputValue) },
  ]
}

function tabPanel(title: string) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">{title}</div>
          <div className="panel-sub">Coming in Phase 4E.</div>
        </div>
      </div>
      <div className="panel-body">This surface is reserved for the next Phase 4 iteration.</div>
    </div>
  )
}

export function AIOperationsSection({
  summaries,
  health,
  recentRuns,
  showVoiceOrchestrator = false,
  initialTab = 'agents',
}: {
  summaries: AgentDashboardSummary[]
  health: HealthStripData
  recentRuns: AgentDashboardRun[]
  showVoiceOrchestrator?: boolean
  initialTab?: 'agents' | 'activity' | 'system' | 'costs'
}) {
  const [activeTab, setActiveTab] = useState<'agents' | 'activity' | 'system' | 'costs'>(initialTab)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null)
  const { can } = useUserRole()

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const summaryMap = new Map(summaries.map((summary) => [summary.agent_id, summary]))
  const runMap = new Map<string, AgentDashboardRun>()

  recentRuns.forEach((run) => {
    if (!runMap.has(run.agent_id)) {
      runMap.set(run.agent_id, run)
    }
  })

  const orderedAgents = showVoiceOrchestrator ? [...AGENTS, VOICE_ORCHESTRATOR] : AGENTS

  const dynamicAgents = summaries
    .filter(s => !orderedAgents.some(a => a.id === s.agent_id))
    .map(s => ({
      id: s.agent_id,
      name: s.agent_id === 'client_lead_converter' ? 'Client → Lead Converter' : s.agent_id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      purpose: s.agent_id === 'client_lead_converter' ? 'Qualifies raw clients into leads based on intent and missing data, then routes to Matchmaker.' : 'Dynamically discovered agent',
      triggerLabel: 'Event',
      icon: getAgentVisual(s.agent_id).icon,
      iconVariant: 'default' as const,
      callsLabel: 'Runs',
    }))

  const allAgents = [...orderedAgents, ...dynamicAgents]

  const selectedRun = selectedRunId
    ? recentRuns.find((run) => run.run_id === selectedRunId) || null
    : null

  return (
    <>
      <section className="page active">
        <div className="crumb">Intelligence · AI Operations</div>
        <div className="head">
          <div>
            <h1 className="title">AI Operations</h1>
            <p className="sub">
              Full traceability for the active automation fleet: health, recent runs, reasoning, and system flow in one place.
            </p>
          </div>
          <div className="actions">
            <button className="btn ghost" type="button">Refresh</button>
            {can.forceRun && (
              <button className="btn" type="button">Force run</button>
            )}
          </div>
        </div>

        <StatStrip health={health} />

        <div className="tabs" role="tablist" aria-label="AI Operations tabs">
          <button className={`tab${activeTab === 'agents' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('agents')}>Agents</button>
          <button className={`tab${activeTab === 'activity' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('activity')}>Live activity</button>
          <button className={`tab${activeTab === 'system' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('system')}>System map</button>
          <button className={`tab${activeTab === 'costs' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('costs')}>Costs</button>
        </div>

        {activeTab === 'agents' ? (
          <>
            <div className="agents">
              {allAgents.map((agent) => {
                const summary = summaryMap.get(agent.id)
                const run = runMap.get(agent.id) || null

                return (
                  <AgentCard
                    key={agent.id}
                    id={agent.id}
                    name={agent.name}
                    purpose={agent.purpose}
                    triggerLabel={agent.triggerLabel}
                    icon={agent.icon}
                    iconVariant={agent.iconVariant}
                    counters={buildCounters(summary, run, agent.callsLabel)}
                    summary={summary}
                    run={run}
                    liveLabel={agent.id === 'voice_orchestrator' ? 'Awaiting voice session' : undefined}
                    isExpanded={expandedAgentId === agent.id}
                    onToggle={() => setExpandedAgentId((prev) => prev === agent.id ? null : agent.id)}
                    onOpenRun={(runId) => {
                      setSelectedRunId(runId)
                      setDrawerOpen(true)
                    }}
                  />
                )
              })}
            </div>
          </>
        ) : null}

        {activeTab === 'activity' ? (
          <LiveActivityFeed initialRuns={recentRuns} showFilterChips={true} showPauseButton={true} />
        ) : null}
        {activeTab === 'system' ? (
          <div className="panel" style={{ padding: 24 }}>
            <div className="panel-title">System map</div>
            <div className="panel-sub">Visualize how agents connect and dispatch</div>
            <div style={{ marginTop: 16 }}>
              <SystemMap
                agents={allAgents.map((agent) => ({ id: agent.id, name: agent.name, triggerLabel: agent.triggerLabel }))}
                onNodeClick={(agentId) => {
                  const run = runMap.get(agentId)
                  if (run?.run_id) {
                    setSelectedRunId(run.run_id)
                    setDrawerOpen(true)
                  }
                }}
              />
            </div>
          </div>
        ) : null}
        {activeTab === 'costs' ? <CostsTab /> : null}
      </section>

      <RunDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        run={selectedRun}
      />
    </>
  )
}
