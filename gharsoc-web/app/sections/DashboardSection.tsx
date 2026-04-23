'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HiOutlinePhone, HiOutlineUsers, HiOutlineCalendarDays } from 'react-icons/hi2'
import { FiTrendingUp, FiActivity, FiCpu, FiAlertCircle } from 'react-icons/fi'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'

interface DashboardProps {
  sampleMode: boolean
  onNavigate: (screen: string) => void
}

const DONUT_DATA = [
  { name: 'Go', value: 45, color: 'hsl(142, 71%, 45%)' },
  { name: 'Reconsider', value: 35, color: 'hsl(38, 92%, 50%)' },
  { name: 'No-Go', value: 20, color: 'hsl(0, 84%, 60%)' },
]

const AGENTS_SUMMARY = [
  { name: 'Voice Orchestrator', status: 'active', actions: 47 },
  { name: 'Lead Qualification', status: 'active', actions: 32 },
  { name: 'Financial Advisory', status: 'active', actions: 18 },
  { name: 'Property Search', status: 'idle', actions: 24 },
  { name: 'Calendar Scheduling', status: 'active', actions: 11 },
  { name: 'Post-Call Sync', status: 'active', actions: 29 },
  { name: 'Re-engagement', status: 'processing', actions: 8 },
  { name: 'Self-Service Advisor', status: 'idle', actions: 15 },
]

const RECENT_ACTIVITY = [
  { time: '2 min ago', event: 'Call completed with Rajesh Mehta', agent: 'Voice Orchestrator', type: 'call', signal: 'Go' },
  { time: '5 min ago', event: 'Lead qualified: Priya Sharma (Score: 87)', agent: 'Lead Qualification', type: 'lead' },
  { time: '8 min ago', event: 'Appointment set: April 24, 3:00 PM', agent: 'Calendar Scheduling', type: 'calendar' },
  { time: '12 min ago', event: 'CRM synced for Amit Patel', agent: 'Post-Call Sync', type: 'sync' },
  { time: '15 min ago', event: 'Re-engagement campaign triggered', agent: 'Re-engagement', type: 'campaign' },
  { time: '22 min ago', event: 'Financial assessment: Sunita Rao', agent: 'Financial Advisory', type: 'finance', signal: 'Reconsider' },
]

function statusColor(status: string) {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'processing') return 'bg-amber-500 animate-pulse'
  return 'bg-gray-400'
}

function signalBadge(signal?: string) {
  if (!signal) return null
  const colors = {
    'Go': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Reconsider': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'No-Go': 'bg-red-500/10 text-red-500 border-red-500/20'
  }
  return <Badge variant="outline" className={`text-[10px] ml-2 ${(colors as any)[signal]}`}>{signal}</Badge>
}

export default function DashboardSection({ sampleMode, onNavigate }: DashboardProps) {
  const stats = sampleMode
    ? { activeCalls: 4, callsToday: 47, avgSentiment: 82, meetingsBooked: 11 }
    : { activeCalls: 0, callsToday: 0, avgSentiment: 0, meetingsBooked: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-serif tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time affordability & voice analytics</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => onNavigate('affordability')} variant="outline" className="border-primary/20 hover:bg-primary/5">
             <FiTrendingUp className="w-4 h-4 mr-2" /> Run GharSoch
           </Button>
        </div>
      </div>

      {sampleMode && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <FiAlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Escalation Alert</p>
              <p className="text-xs text-muted-foreground">Negative sentiment detected during call with Amit Patel. Requires immediate broker intervention.</p>
            </div>
          </div>
          <Button size="sm" className="bg-destructive text-white hover:bg-destructive/90 px-6">Join Call</Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Active Calls', value: stats.activeCalls, icon: HiOutlinePhone, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Calls Today', value: stats.callsToday, icon: FiActivity, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Avg Sentiment', value: stats.avgSentiment + '%', icon: FiTrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Meetings Booked', value: stats.meetingsBooked, icon: HiOutlineCalendarDays, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map((s, i) => (
          <Card key={i} className="border-white/5 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-bold mt-2 text-white">{s.value}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-white/5 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-2 right-2">
             <PieChart width={60} height={60}>
               <Pie data={DONUT_DATA} innerRadius={18} outerRadius={28} dataKey="value" stroke="none">
                 {DONUT_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
               </Pie>
             </PieChart>
          </div>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Signal Mix</p>
            <p className="text-2xl font-bold mt-2 text-white">45:35</p>
            <p className="text-[10px] text-emerald-400 mt-1 uppercase font-bold tracking-tighter">Go : Reconsider</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 border-white/5 bg-card/50">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FiActivity className="w-4 h-4" /> Live Call Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
             <div className="space-y-1">
                {RECENT_ACTIVITY.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                      <HiOutlinePhone className={`w-4 h-4 ${a.type === 'call' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center">
                         <span className="text-sm font-semibold text-white truncate">{a.event}</span>
                         {signalBadge(a.signal)}
                       </div>
                       <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[10px] text-muted-foreground">{a.time}</span>
                         <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">{a.agent}</span>
                       </div>
                    </div>
                    {a.type === 'call' && (
                      <div className="flex gap-1">
                        <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                        <div className="w-1 h-2 bg-emerald-500 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
             </div>
             <Button variant="ghost" size="sm" onClick={() => onNavigate('calls')} className="mt-4 ml-4 text-[11px] text-primary hover:text-primary hover:bg-primary/10">
               View All Call Logs &rarr;
             </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-white/5 bg-card/50">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FiCpu className="w-4 h-4" /> Agent Health Grid
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
             <div className="grid grid-cols-1 gap-2">
                {AGENTS_SUMMARY.map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${statusColor(a.status)}`} />
                       <span className="text-xs font-medium text-white">{a.name}</span>
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground">{a.actions} actions</div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
