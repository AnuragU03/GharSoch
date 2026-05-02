'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { FiTerminal, FiCpu, FiClock, FiCheckCircle, FiSend, FiLoader, FiRefreshCw } from 'react-icons/fi'
import { HiOutlineSparkles, HiOutlineBolt, HiOutlineCalendarDays, HiOutlineArrowPath, HiOutlineCurrencyRupee, HiOutlineCheckBadge } from 'react-icons/hi2'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

interface AgentLog {
  _id: string
  agent_name: string
  action: string
  status: string
  created_at: string
}

const CRON_AGENTS = [
  {
    id: 'matchmaker',
    name: 'The Matchmaker',
    role: 'Scans new clients against all properties using GPT-4o. Promotes clients with ≥75% match score directly to the Lead Pipeline.',
    endpoint: '/api/agent/matchmaker',
    method: 'POST',
    icon: HiOutlineSparkles,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  {
    id: 'reminders',
    name: 'Appointment Guardian',
    role: 'Checks appointments scheduled for the next 24 hours and automatically triggers AI reminder calls via Vapi.',
    endpoint: '/api/cron/reminders',
    method: 'GET',
    icon: HiOutlineCalendarDays,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    id: 're-engage',
    name: 'Dead Lead Re-engager',
    role: 'Finds leads that have been cold for 60+ days and launches targeted re-engagement outreach campaigns.',
    endpoint: '/api/cron/re-engage',
    method: 'GET',
    icon: HiOutlineArrowPath,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    id: 'follow-up',
    name: 'Auto Follow-Up',
    role: 'Manages the communication cadence for pending follow-ups, ensuring no lead falls through the cracks.',
    endpoint: '/api/cron/follow-up',
    method: 'GET',
    icon: HiOutlineBolt,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'price-drop',
    name: 'Price Drop Negotiator',
    role: 'When a property price drops, proactively notifies all leads with budget objections and initiates AI negotiation calls.',
    endpoint: '/api/agent/price-drop',
    method: 'POST',
    icon: HiOutlineCurrencyRupee,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
]

export default function AgentActivitySection() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAgent, setActiveAgent] = useState<typeof CRON_AGENTS[0] | null>(null)
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<{ success: boolean; message: string } | null>(null)
  const [agentStats, setAgentStats] = useState<Record<string, number>>({})

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-activities')
      const data = await res.json()
      if (data.success) {
        setLogs(data.data)
        // Build per-agent stats
        const stats: Record<string, number> = {}
        data.data.forEach((log: AgentLog) => {
          stats[log.agent_name] = (stats[log.agent_name] || 0) + 1
        })
        setAgentStats(stats)
      }
    } catch (e) {
      console.error('Failed to fetch agent logs:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const handleRunAgent = async (agent: typeof CRON_AGENTS[0]) => {
    setRunningAgentId(agent.id)
    setRunResult(null)
    try {
      const cronSecret = ''
      const res = await fetch(agent.endpoint, {
        method: agent.method,
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setRunResult({ success: data.success, message: data.message || JSON.stringify(data) })
      // Refresh logs after run
      setTimeout(fetchLogs, 1500)
    } catch {
      setRunResult({ success: false, message: 'Network error. Is the server running?' })
    }
    setRunningAgentId(null)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiCpu className="text-primary" /> AI Operations Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, test, and manually trigger your 5 autonomous background agents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"
          >
            <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse inline-block" />
            All Systems Active
          </Badge>
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CRON_AGENTS.map(agent => {
          const Icon = agent.icon
          const runCount = agentStats[agent.name] || 0
          const lastLog = logs.find(l => l.agent_name === agent.name)
          const isRunning = runningAgentId === agent.id
          return (
            <Card
              key={agent.id}
              className={`border hover:shadow-md transition-all cursor-pointer group ${agent.border} hover:border-opacity-60`}
              onClick={() => { setActiveAgent(agent); setRunResult(null) }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${agent.bg} border ${agent.border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${agent.color}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">{runCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Runs Total</p>
                  </div>
                </div>
                <h3 className={`text-sm font-bold mb-1 group-hover:${agent.color} transition-colors`}>{agent.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{agent.role}</p>
                {lastLog ? (
                  <p className="text-[10px] text-muted-foreground line-clamp-1 italic border-t border-border pt-2">
                    Last: {lastLog.action}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground border-t border-border pt-2">Awaiting first CRON trigger...</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Live Terminal Feed */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FiTerminal className="text-primary" /> Live Activity Log
        </h3>
        <div className="bg-[#0D1117] border border-border/40 rounded-xl overflow-hidden shadow-2xl">
          {/* Terminal Header */}
          <div className="flex items-center px-4 py-2.5 bg-[#161B22] border-b border-border/40">
            <div className="flex gap-1.5 mr-4">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="text-xs font-mono text-muted-foreground/80 flex items-center gap-2">
              <FiTerminal />
              <span>agent-ops ~ tail -f /var/log/ai_agents.log</span>
            </div>
          </div>
          {/* Terminal Body */}
          <div className="p-5 font-mono text-sm h-[400px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <span className="animate-pulse">Initializing connection to agent matrix...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                <FiTerminal className="w-12 h-12 mb-3" />
                <p>No agent operations logged yet.</p>
                <p className="text-xs mt-1">Click an agent card above and run it manually to see logs here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map(log => (
                  <div key={log._id} className="flex gap-4 group">
                    <div className="w-24 shrink-0 text-muted-foreground/60 flex items-start gap-1.5 text-xs pt-0.5">
                      <FiClock className="w-3 h-3 mt-0.5 shrink-0" />
                      {new Date(log.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {log.agent_name}
                        </span>
                        {log.status === 'success' && <FiCheckCircle className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <p className="text-[#c9d1d9] leading-relaxed break-words">
                        <span className="text-muted-foreground/50 mr-2">{'>'}</span>
                        {log.action}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-muted-foreground/50 pt-4 animate-pulse">
                  <span>{'>'}</span>
                  <span className="w-2 h-4 bg-muted-foreground/30 block" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Run Sheet */}
      <Sheet open={!!activeAgent} onOpenChange={(open) => !open && setActiveAgent(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col border-l border-border bg-background p-0">
          {activeAgent && (() => {
            const Icon = activeAgent.icon
            const isRunning = runningAgentId === activeAgent.id
            return (
              <>
                <SheetHeader className="px-6 py-4 border-b border-border text-left">
                  <SheetTitle className="text-lg flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${activeAgent.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${activeAgent.color}`} />
                    </div>
                    {activeAgent.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs leading-relaxed">
                    {activeAgent.role}
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endpoint</p>
                    <p className="font-mono text-sm text-foreground">{activeAgent.method} {activeAgent.endpoint}</p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Runs Logged</p>
                    <p className="text-2xl font-bold">{agentStats[activeAgent.name] || 0}</p>
                  </div>

                  {runResult && (
                    <div className={`rounded-lg border p-4 text-sm ${runResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        {runResult.success ? <HiOutlineCheckBadge className="w-4 h-4" /> : null}
                        {runResult.success ? 'Agent ran successfully' : 'Agent run failed'}
                      </div>
                      <p className="text-xs opacity-80">{runResult.message}</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-border">
                  <button
                    onClick={() => handleRunAgent(activeAgent)}
                    disabled={isRunning}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${activeAgent.bg} ${activeAgent.color} border ${activeAgent.border} hover:opacity-80 disabled:opacity-60`}
                  >
                    {isRunning
                      ? <><AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" /> Running agent...</>
                      : <><FiSend className="w-4 h-4" /> Run {activeAgent.name} Now</>
                    }
                  </button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">This manually triggers the agent outside of the normal CRON schedule.</p>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0D1117; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363D; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #484F58; }
      `}} />
    </div>
  )
}
