'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiOutlineUserGroup, HiOutlinePhone, HiOutlineCalendarDays, HiOutlineMegaphone } from 'react-icons/hi2'
import { FiTrendingUp, FiActivity } from 'react-icons/fi'

interface DashStats {
  totalLeads: number; newLeadsToday: number; hotLeads: number; qualifiedLeads: number
  totalCalls: number; callsToday: number; avgCallDuration: number
  totalAppointments: number; upcomingAppointments: number
  activeCampaigns: number; totalCampaigns: number; dncCount: number
  funnel: { total: number; contacted: number; qualified: number; appointed: number }
}

export default function DashboardSection({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [agentLogs, setAgentLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, actRes, agentRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/activities'),
          fetch('/api/agent-activities')
        ])
        const sd = await statsRes.json()
        const ad = await actRes.json()
        const agd = await agentRes.json()
        if (sd.success) setStats(sd.stats)
        if (ad.success) setActivities(ad.activities)
        if (agd.success) setAgentLogs(agd.data || [])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading dashboard...</div>
  if (!stats) return <div className="py-12 text-center text-destructive">Failed to load dashboard data.</div>

  const funnelData = [
    { label: 'Total Leads', val: stats.funnel.total, pct: 100, color: '#3b82f6' },
    { label: 'Contacted', val: stats.funnel.contacted, pct: stats.funnel.total ? Math.round(stats.funnel.contacted / stats.funnel.total * 100) : 0, color: '#f59e0b' },
    { label: 'Qualified', val: stats.funnel.qualified, pct: stats.funnel.contacted ? Math.round(stats.funnel.qualified / stats.funnel.contacted * 100) : 0, color: '#10b981' },
    { label: 'Appointments', val: stats.funnel.appointed, pct: stats.funnel.qualified ? Math.round(stats.funnel.appointed / stats.funnel.qualified * 100) : 0, color: '#8b5cf6' },
  ]

  const latestAgentLog = agentLogs.length > 0 ? agentLogs[0] : null

  return (
    <div className="space-y-6">
      {/* AI Pulse Pro-Max Banner */}
      <div 
        className="w-full relative overflow-hidden rounded-xl border border-primary/20 bg-card cursor-pointer group"
        onClick={() => onNavigate('agent_ops')}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50"></div>
        <div className="relative p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/30 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
              <FiActivity className="w-5 h-5 text-primary relative z-10" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                Autonomous AI Systems Online
                <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">Optimal Health</span>
              </h3>
              {latestAgentLog ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  <span className="text-primary font-medium">{latestAgentLog.agent_name}</span> completed at {new Date(latestAgentLog.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: <span className="text-muted-foreground/80">{latestAgentLog.action}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Background agents are standing by. Awaiting scheduled CRON triggers...</p>
              )}
            </div>
          </div>
          <button className="shrink-0 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-4 py-2 rounded-lg border border-primary/20 flex items-center gap-2 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
            View Live Logs
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('leads')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Leads</CardTitle>
            <HiOutlineUserGroup className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-emerald-500 font-medium">+{stats.newLeadsToday}</span> today • {stats.hotLeads} hot</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('calls')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Calls Made</CardTitle>
            <HiOutlinePhone className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-emerald-500 font-medium">+{stats.callsToday}</span> today • {Math.round(stats.avgCallDuration / 60)}m avg</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('appointments')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Appointments</CardTitle>
            <HiOutlineCalendarDays className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground mt-1">Upcoming • {stats.totalAppointments} total scheduled</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('campaigns')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Campaigns</CardTitle>
            <HiOutlineMegaphone className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground mt-1">Active out of {stats.totalCampaigns} total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FiTrendingUp className="text-primary" /> Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-2">
              {funnelData.map((f, i) => (
                <div key={f.label} className="relative">
                  <div className="flex justify-between text-sm mb-1.5 font-medium">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">{f.val} ({f.pct}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${f.pct}%`, backgroundColor: f.color }} />
                  </div>
                  {i < funnelData.length - 1 && <div className="absolute -bottom-4 left-1/2 w-px h-3 bg-border" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FiActivity className="text-primary" /> Live Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="h-[280px] overflow-y-auto px-6 space-y-4">
              {activities.length === 0 ? <p className="text-xs text-muted-foreground text-center">No recent activity</p> :
                activities.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="mt-0.5">
                      {a.icon === 'user' ? <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><HiOutlineUserGroup className="w-3.5 h-3.5" /></div> :
                       a.icon === 'phone' ? <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><HiOutlinePhone className="w-3.5 h-3.5" /></div> :
                       <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><HiOutlineCalendarDays className="w-3.5 h-3.5" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
