'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiOutlinePhone } from 'react-icons/hi2'

interface CallActivityProps {
  sampleMode: boolean
}

interface CallLog {
  id: string
  timestamp: string
  caller: string
  phone: string
  duration: string
  outcome: string
  agent: string
  followUp: string
  sentiment: number
  direction: string
}

const SAMPLE_CALLS: CallLog[] = [
  { id: '1', timestamp: '10:42 AM', caller: 'Rajesh Mehta', phone: '+91 98765 43210', duration: '8:32', outcome: 'Appointment Set', agent: 'Voice Orchestrator', followUp: 'Viewing on Apr 24', sentiment: 8.1, direction: 'Inbound' },
  { id: '2', timestamp: '10:28 AM', caller: 'Priya Sharma', phone: '+91 87654 32109', duration: '12:15', outcome: 'Qualified', agent: 'Lead Qualification', followUp: 'Financial review pending', sentiment: 6.3, direction: 'Outbound' },
  { id: '3', timestamp: '10:15 AM', caller: 'Amit Patel', phone: '+91 76543 21098', duration: '5:44', outcome: 'Not Interested', agent: 'Voice Orchestrator', followUp: 'Re-engage in 30 days', sentiment: 4.2, direction: 'Inbound' },
  { id: '4', timestamp: '9:58 AM', caller: 'Sunita Rao', phone: '+91 65432 10987', duration: '15:03', outcome: 'Appointment Set', agent: 'Calendar Scheduling', followUp: 'Visit on Apr 25', sentiment: 7.8, direction: 'Outbound' },
  { id: '5', timestamp: '9:40 AM', caller: 'Vikram Singh', phone: '+91 54321 09876', duration: '9:22', outcome: 'Follow-up Required', agent: 'Financial Advisory', followUp: 'EMI clarification call', sentiment: 5.5, direction: 'Inbound' },
  { id: '6', timestamp: '9:25 AM', caller: 'Meera Joshi', phone: '+91 43210 98765', duration: '11:48', outcome: 'Qualified', agent: 'Lead Qualification', followUp: 'Property matching', sentiment: 7.2, direction: 'Outbound' },
  { id: '7', timestamp: '9:10 AM', caller: 'Karan Desai', phone: '+91 32109 87654', duration: '18:05', outcome: 'Converted', agent: 'Post-Call Sync', followUp: 'Documentation started', sentiment: 9.2, direction: 'Inbound' },
  { id: '8', timestamp: '8:55 AM', caller: 'Anita Gupta', phone: '+91 21098 76543', duration: '7:33', outcome: 'Voicemail', agent: 'Voice Orchestrator', followUp: 'Retry in 2 hrs', sentiment: 0, direction: 'Outbound' },
  { id: '9', timestamp: '8:38 AM', caller: 'Deepak Nair', phone: '+91 10987 65432', duration: '6:15', outcome: 'Not Interested', agent: 'Voice Orchestrator', followUp: 'Closed', sentiment: 3.8, direction: 'Inbound' },
  { id: '10', timestamp: '8:20 AM', caller: 'Riya Kapoor', phone: '+91 99887 66554', duration: '13:42', outcome: 'Appointment Set', agent: 'Calendar Scheduling', followUp: 'Viewing on Apr 26', sentiment: 8.5, direction: 'Outbound' },
]

function outcomeBadge(outcome: string) {
  switch (outcome) {
    case 'Converted': return 'bg-emerald-50 text-emerald-600 border-emerald-300'
    case 'Appointment Set': return 'bg-blue-50 text-blue-600 border-blue-300'
    case 'Qualified': return 'bg-purple-50 text-purple-600 border-purple-300'
    case 'Follow-up Required': return 'bg-amber-50 text-amber-600 border-amber-300'
    case 'Voicemail': return 'bg-gray-100 text-gray-500 border-gray-300'
    case 'Not Interested': return 'bg-red-50 text-red-500 border-red-300'
    default: return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

export default function CallActivitySection({ sampleMode }: CallActivityProps) {
  const [filterOutcome, setFilterOutcome] = useState('all')
  const [filterDirection, setFilterDirection] = useState('all')

  const allCalls = sampleMode ? SAMPLE_CALLS : []
  const calls = allCalls.filter(c => {
    if (filterOutcome !== 'all' && c.outcome !== filterOutcome) return false
    if (filterDirection !== 'all' && c.direction !== filterDirection) return false
    return true
  })

  const outcomes = Array.from(new Set(SAMPLE_CALLS.map(c => c.outcome)))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Call Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">Automated call logs and outcomes</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterOutcome} onValueChange={setFilterOutcome}>
          <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Filter by outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {outcomes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Filter by direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="Inbound">Inbound</SelectItem>
            <SelectItem value="Outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{calls.length} calls</span>
      </div>

      {calls.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <HiOutlinePhone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No call data available. Enable sample data to preview.</p>
          </CardContent>
        </Card>
      )}

      {calls.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <ScrollArea className="h-[520px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caller</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dir</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sentiment</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outcome</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 text-xs">{call.timestamp}</td>
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium text-sm">{call.caller}</p>
                          <p className="text-[10px] text-muted-foreground">{call.phone}</p>
                        </div>
                      </td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{call.direction}</Badge></td>
                      <td className="py-2.5 text-xs font-mono">{call.duration}</td>
                      <td className="py-2.5">
                        {call.sentiment > 0 ? (
                          <span className={`text-xs font-bold ${call.sentiment >= 7 ? 'text-emerald-500' : call.sentiment >= 5 ? 'text-amber-500' : 'text-red-400'}`}>{call.sentiment.toFixed(1)}</span>
                        ) : <span className="text-xs text-muted-foreground">--</span>}
                      </td>
                      <td className="py-2.5"><Badge variant="outline" className={`text-[10px] ${outcomeBadge(call.outcome)}`}>{call.outcome}</Badge></td>
                      <td className="py-2.5 text-xs" style={{ color: 'hsl(25, 70%, 50%)' }}>{call.agent}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{call.followUp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
