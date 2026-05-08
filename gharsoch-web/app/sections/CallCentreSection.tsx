'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HiOutlinePhone, HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2'
import { FiUsers, FiClock, FiAlertTriangle, FiBarChart2, FiDownload, FiZap, FiActivity, FiTrendingUp, FiPhoneCall, FiPhoneOff, FiPhone } from 'react-icons/fi'

interface CallCentreProps {
  sampleMode: boolean
}

const SAMPLE_LIVE_CALLS = [
  { id: 'C001', caller: 'Rajesh Mehta', phone: '+91 98765 43210', duration: 245, agent: 'Voice Orchestrator', status: 'connected', sentiment: 'positive' },
  { id: 'C002', caller: 'Priya Sharma', phone: '+91 87654 32109', duration: 120, agent: 'Lead Qualifier', status: 'connected', sentiment: 'neutral' },
  { id: 'C003', caller: 'Amit Patel', phone: '+91 76543 21098', duration: 15, agent: 'Financial Advisor', status: 'ringing', sentiment: 'unknown' },
  { id: 'C004', caller: 'Sunita Rao', phone: '+91 65432 10987', duration: 380, agent: 'Voice Orchestrator', status: 'on-hold', sentiment: 'negative' },
  { id: 'C005', caller: 'Vikram Singh', phone: '+91 54321 09876', duration: 42, agent: 'Property Search', status: 'wrapping-up', sentiment: 'positive' },
  { id: 'C006', caller: 'Meera Joshi', phone: '+91 43210 98765', duration: 88, agent: 'Self-Service', status: 'connected', sentiment: 'positive' },
]

const SAMPLE_QUEUE = [
  { id: 'Q001', caller: 'Karan Malhotra', phone: '+91 32109 87654', waitTime: 45, priority: 'high' },
  { id: 'Q002', caller: 'Anjali Desai', phone: '+91 21098 76543', waitTime: 22, priority: 'normal' },
  { id: 'Q003', caller: 'Rohit Gupta', phone: '+91 10987 65432', waitTime: 8, priority: 'normal' },
]

const SAMPLE_AGENTS = [
  { name: 'Voice Orchestrator', callsToday: 47, avgHandleTime: '8:32', successRate: 92, status: 'on-call' },
  { name: 'Lead Qualifier', callsToday: 32, avgHandleTime: '5:15', successRate: 88, status: 'on-call' },
  { name: 'Financial Advisor', callsToday: 18, avgHandleTime: '12:45', successRate: 95, status: 'on-call' },
  { name: 'Property Search', callsToday: 24, avgHandleTime: '6:20', successRate: 85, status: 'available' },
  { name: 'Calendar', callsToday: 11, avgHandleTime: '3:10', successRate: 97, status: 'available' },
  { name: 'Post-Call Sync', callsToday: 29, avgHandleTime: '2:05', successRate: 99, status: 'processing' },
  { name: 'Re-engagement', callsToday: 8, avgHandleTime: '7:40', successRate: 78, status: 'available' },
  { name: 'Self-Service', callsToday: 15, avgHandleTime: '4:55', successRate: 90, status: 'on-call' },
]

const SAMPLE_ESCALATIONS = [
  { time: '5 min ago', caller: 'Sunita Rao', reason: 'Pricing dispute on Sobha Dream Acres', severity: 'high' },
  { time: '18 min ago', caller: 'Ravi Kumar', reason: 'Legal documentation concern', severity: 'medium' },
  { time: '32 min ago', caller: 'Deepa Nair', reason: 'Loan rejection follow-up', severity: 'low' },
]

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    'connected': { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    'ringing': { bg: 'bg-blue-500/10', text: 'text-blue-600' },
    'on-hold': { bg: 'bg-amber-500/10', text: 'text-amber-600' },
    'wrapping-up': { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  }
  const s = map[status] ?? { bg: 'bg-gray-500/10', text: 'text-gray-500' }
  return <Badge variant="outline" className={`text-[10px] capitalize ${s.text} border-current/20`}>{status}</Badge>
}

function sentimentDot(sentiment: string) {
  if (sentiment === 'positive') return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Positive" />
  if (sentiment === 'negative') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Negative" />
  if (sentiment === 'neutral') return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Neutral" />
  return <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" title="Unknown" />
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function LiveCallTimer({ initialSeconds, active }: { initialSeconds: number; active: boolean }) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active])

  return <span className="text-xs font-mono tabular-nums">{formatDuration(seconds)}</span>
}

export default function CallCentreSection({ sampleMode }: CallCentreProps) {
  const [activeTab, setActiveTab] = useState('live')
  const liveCalls = sampleMode ? SAMPLE_LIVE_CALLS : []
  const queue = sampleMode ? SAMPLE_QUEUE : []
  const agents = sampleMode ? SAMPLE_AGENTS : SAMPLE_AGENTS.map(a => ({ ...a, callsToday: 0, successRate: 0, status: 'available' }))
  const escalations = sampleMode ? SAMPLE_ESCALATIONS : []

  const slaMetrics = sampleMode
    ? { avgWait: '28s', avgHandle: '7:12', fcrRate: '84%', abandonRate: '3.2%' }
    : { avgWait: '--', avgHandle: '--:--', fcrRate: '--%', abandonRate: '--%' }

  const maxCalls = Math.max(...agents.map(a => a.callsToday), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FiPhoneCall className="w-6 h-6" style={{ color: 'hsl(25, 70%, 45%)' }} />
            Call Centre
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Autonomous call monitoring and agent performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <FiZap className="w-3.5 h-3.5" /> Start Campaign
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <HiOutlinePause className="w-3.5 h-3.5" /> Pause Outbound
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <FiDownload className="w-3.5 h-3.5" /> Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Wait Time', value: slaMetrics.avgWait, icon: FiClock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Avg Handle Time', value: slaMetrics.avgHandle, icon: FiActivity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'First Call Resolution', value: slaMetrics.fcrRate, icon: FiTrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Abandonment Rate', value: slaMetrics.abandonRate, icon: FiPhoneOff, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((m, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  <p className="text-2xl font-bold mt-1">{m.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.bg}`}>
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="live" className="text-xs gap-1.5"><HiOutlinePhone className="w-3.5 h-3.5" /> Live Calls ({liveCalls.length})</TabsTrigger>
          <TabsTrigger value="agents" className="text-xs gap-1.5"><FiUsers className="w-3.5 h-3.5" /> Agent Board</TabsTrigger>
          <TabsTrigger value="distribution" className="text-xs gap-1.5"><FiBarChart2 className="w-3.5 h-3.5" /> Distribution</TabsTrigger>
          <TabsTrigger value="escalations" className="text-xs gap-1.5"><FiAlertTriangle className="w-3.5 h-3.5" /> Escalations ({escalations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <HiOutlinePhone className="w-4 h-4" /> Active Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                {liveCalls.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FiPhoneOff className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No active calls. Enable sample data to preview.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {liveCalls.map((call) => (
                    <div key={call.id} className="p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {sentimentDot(call.sentiment)}
                          <span className="text-sm font-semibold">{call.caller}</span>
                        </div>
                        {statusBadge(call.status)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{call.phone}</span>
                          <LiveCallTimer initialSeconds={call.duration} active={call.status === 'connected' || call.status === 'on-hold'} />
                        </div>
                        <p className="text-[11px] font-medium" style={{ color: 'hsl(25, 70%, 50%)' }}>{call.agent}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FiClock className="w-4 h-4" /> Call Queue ({queue.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {queue.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Queue empty</p>
                )}
                <div className="space-y-2">
                  {queue.map((q) => (
                    <div key={q.id} className="p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{q.caller}</span>
                        <Badge variant={q.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{q.priority}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{q.phone}</span>
                        <span className="font-mono">{q.waitTime}s wait</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FiUsers className="w-4 h-4" /> Agent Performance Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Calls Today</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Handle</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{agent.name}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="outline" className={`text-[10px] capitalize ${agent.status === 'on-call' ? 'text-emerald-600 border-emerald-500/30' : agent.status === 'processing' ? 'text-amber-600 border-amber-500/30' : 'text-gray-500 border-gray-400/30'}`}>
                            {agent.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">{agent.callsToday}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs">{agent.avgHandleTime}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`font-semibold ${agent.successRate >= 90 ? 'text-emerald-600' : agent.successRate >= 80 ? 'text-amber-600' : 'text-red-500'}`}>
                            {agent.successRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FiBarChart2 className="w-4 h-4" /> Call Distribution Across Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agents.map((agent, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.callsToday} calls</span>
                    </div>
                    <div className="h-6 bg-muted/50 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                        style={{
                          width: `${Math.max((agent.callsToday / maxCalls) * 100, 2)}%`,
                          background: `hsl(${25 + i * 15}, 70%, ${45 + i * 3}%)`,
                        }}
                      >
                        {agent.callsToday > 5 && <span className="text-[10px] font-semibold text-white">{agent.callsToday}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total calls today</p>
                <p className="text-lg font-bold">{agents.reduce((sum, a) => sum + a.callsToday, 0)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalations">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FiAlertTriangle className="w-4 h-4" /> Recent Escalations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {escalations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No escalations. Enable sample data to preview.</p>
              )}
              <div className="space-y-3">
                {escalations.map((esc, i) => (
                  <div key={i} className={`p-3 rounded-lg border bg-background ${esc.severity === 'high' ? 'border-red-500/30' : esc.severity === 'medium' ? 'border-amber-500/30' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{esc.caller}</span>
                      <Badge variant={esc.severity === 'high' ? 'destructive' : 'outline'} className={`text-[10px] capitalize ${esc.severity === 'medium' ? 'text-amber-600 border-amber-500/30' : esc.severity === 'low' ? 'text-gray-500 border-gray-400/30' : ''}`}>
                        {esc.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{esc.reason}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{esc.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
