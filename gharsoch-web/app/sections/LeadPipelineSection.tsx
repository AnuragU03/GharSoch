'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HiOutlineUsers } from 'react-icons/hi2'

interface LeadPipelineProps {
  sampleMode: boolean
}

interface Lead {
  id: string
  name: string
  phone: string
  score: number
  stage: string
  assignedAgent: string
  lastContact: string
  property: string
  source: string
}

const SAMPLE_LEADS: Lead[] = [
  { id: '1', name: 'Rajesh Mehta', phone: '+91 98765 43210', score: 92, stage: 'Appointment Set', assignedAgent: 'Calendar Scheduling', lastContact: '2 min ago', property: 'Prestige Lakeside, 3BHK', source: 'Inbound Call' },
  { id: '2', name: 'Priya Sharma', phone: '+91 87654 32109', score: 87, stage: 'Qualified', assignedAgent: 'Lead Qualification', lastContact: '5 min ago', property: 'Brigade Utopia, 2BHK', source: 'Website' },
  { id: '3', name: 'Amit Patel', phone: '+91 76543 21098', score: 45, stage: 'Contacted', assignedAgent: 'Voice Orchestrator', lastContact: '12 min ago', property: 'Sobha Dream Acres', source: 'Referral' },
  { id: '4', name: 'Sunita Rao', phone: '+91 65432 10987', score: 78, stage: 'Qualified', assignedAgent: 'Financial Advisory', lastContact: '22 min ago', property: 'Godrej Eternity, 2BHK', source: 'Facebook Ad' },
  { id: '5', name: 'Vikram Singh', phone: '+91 54321 09876', score: 34, stage: 'New', assignedAgent: 'Unassigned', lastContact: '35 min ago', property: 'Puravankara Skydale', source: 'Google Ad' },
  { id: '6', name: 'Meera Joshi', phone: '+91 43210 98765', score: 88, stage: 'Appointment Set', assignedAgent: 'Calendar Scheduling', lastContact: '40 min ago', property: 'Embassy Springs, 3BHK', source: 'Inbound Call' },
  { id: '7', name: 'Karan Desai', phone: '+91 32109 87654', score: 95, stage: 'Converted', assignedAgent: 'Post-Call Sync', lastContact: '1 hr ago', property: 'Prestige Falcon, 2BHK', source: 'Referral' },
  { id: '8', name: 'Anita Gupta', phone: '+91 21098 76543', score: 62, stage: 'Contacted', assignedAgent: 'Voice Orchestrator', lastContact: '1.5 hrs ago', property: 'Godrej Reflections', source: 'Website' },
  { id: '9', name: 'Deepak Nair', phone: '+91 10987 65432', score: 25, stage: 'New', assignedAgent: 'Unassigned', lastContact: '2 hrs ago', property: 'Undecided', source: 'Walk-in' },
  { id: '10', name: 'Riya Kapoor', phone: '+91 99887 66554', score: 73, stage: 'Qualified', assignedAgent: 'Property Search', lastContact: '2.5 hrs ago', property: 'Brigade Cornerstone', source: 'Instagram' },
]

const STAGES = ['New', 'Contacted', 'Qualified', 'Appointment Set', 'Converted']

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-red-400'
}

function stageBadge(stage: string) {
  switch (stage) {
    case 'New': return 'bg-gray-100 text-gray-600 border-gray-300'
    case 'Contacted': return 'bg-blue-50 text-blue-600 border-blue-300'
    case 'Qualified': return 'bg-purple-50 text-purple-600 border-purple-300'
    case 'Appointment Set': return 'bg-amber-50 text-amber-600 border-amber-300'
    case 'Converted': return 'bg-emerald-50 text-emerald-600 border-emerald-300'
    default: return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

export default function LeadPipelineSection({ sampleMode }: LeadPipelineProps) {
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const leads = sampleMode ? SAMPLE_LEADS : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lead Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Track leads through qualification stages</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as 'kanban' | 'table')}>
          <TabsList className="bg-muted">
            <TabsTrigger value="kanban" className="text-xs">Board</TabsTrigger>
            <TabsTrigger value="table" className="text-xs">Table</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {leads.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <HiOutlineUsers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No leads in pipeline. Enable sample data to preview.</p>
          </CardContent>
        </Card>
      )}

      {leads.length > 0 && view === 'kanban' && (
        <div className="grid grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter(l => l.stage === stage)
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage}</h3>
                  <Badge variant="outline" className="text-[10px] h-5">{stageLeads.length}</Badge>
                </div>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2 pr-1">
                    {stageLeads.map((lead) => (
                      <Card key={lead.id} className="border-border bg-card hover:shadow-md transition-shadow cursor-default">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium leading-tight">{lead.name}</p>
                            <span className={`text-xs font-bold ${scoreColor(lead.score)}`}>{lead.score}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{lead.property}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{lead.lastContact}</span>
                            <span className="text-[10px] font-medium" style={{ color: 'hsl(25, 70%, 50%)' }}>{lead.assignedAgent}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      )}

      {leads.length > 0 && view === 'table' && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <ScrollArea className="h-[500px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                    <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{lead.name}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{lead.phone}</td>
                      <td className={`py-2.5 font-bold ${scoreColor(lead.score)}`}>{lead.score}</td>
                      <td className="py-2.5"><Badge variant="outline" className={`text-[10px] ${stageBadge(lead.stage)}`}>{lead.stage}</Badge></td>
                      <td className="py-2.5 text-xs">{lead.assignedAgent}</td>
                      <td className="py-2.5 text-xs">{lead.property}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{lead.source}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{lead.lastContact}</td>
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
