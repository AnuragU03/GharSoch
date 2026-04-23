'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FiCpu } from 'react-icons/fi'

interface AgentStatusProps {
  sampleMode: boolean
}

const AGENTS = [
  {
    id: '69e8f73cd8820b5d0188ed99',
    name: 'Voice Conversation Orchestrator',
    role: 'Manages live voice calls, routes buyer intent to specialists, handles escalation and voicemail',
    type: 'voice',
    status: 'active',
    lastAction: '2 min ago',
    actionsToday: 47,
    model: 'GPT-4.1',
    provider: 'OpenAI',
  },
  {
    id: '69e8f707f89cad5d4b752d22',
    name: 'Lead Qualification & Objection Agent',
    role: 'Analyzes and qualifies leads, handles buyer objections with data-driven responses',
    type: 'json',
    status: 'active',
    lastAction: '5 min ago',
    actionsToday: 32,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
  },
  {
    id: '69e8f7086aa016932b1c1a83',
    name: 'GharSoch Financial Advisory Agent',
    role: 'Provides financial guidance on affordability, EMI, taxes, and budget planning for buyers',
    type: 'json',
    status: 'active',
    lastAction: '8 min ago',
    actionsToday: 18,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
  },
  {
    id: '69e8f709d2531e39b8b15889',
    name: 'Property Search Agent',
    role: 'Searches property knowledge base to find matching listings based on buyer criteria',
    type: 'json',
    status: 'idle',
    lastAction: '28 min ago',
    actionsToday: 24,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
    hasKB: true,
  },
  {
    id: '69e8f71ed8820b5d0188ed95',
    name: 'Calendar Scheduling Agent',
    role: 'Manages Google Calendar integration for booking property viewings and consultations',
    type: 'json',
    status: 'active',
    lastAction: '8 min ago',
    actionsToday: 11,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
    hasTools: true,
  },
  {
    id: '69e8f709f89cad5d4b752d24',
    name: 'Post-Call Sync Agent',
    role: 'Syncs call data, sentiment scores, and lead status to CRM after each conversation',
    type: 'json',
    status: 'active',
    lastAction: '12 min ago',
    actionsToday: 29,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
  },
  {
    id: '69e8f70a86926aed0100ba92',
    name: 'Property Re-engagement Agent',
    role: 'Runs scheduled campaigns to re-engage dormant leads with new property matches',
    type: 'json',
    status: 'processing',
    lastAction: '15 min ago',
    actionsToday: 8,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
    scheduled: true,
  },
  {
    id: '69e8f709f89cad5d4b752d26',
    name: 'GharSoch Self-Service Advisor',
    role: 'Interactive affordability calculator and property advisory tool for end users',
    type: 'json',
    status: 'idle',
    lastAction: '35 min ago',
    actionsToday: 15,
    model: 'Claude Sonnet',
    provider: 'Anthropic',
  },
]

function statusBadge(status: string) {
  if (status === 'active') return { text: 'Active', cls: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' }
  if (status === 'processing') return { text: 'Processing', cls: 'text-amber-500 border-amber-500/30 bg-amber-500/10' }
  return { text: 'Idle', cls: 'text-gray-400 border-gray-400/30 bg-gray-400/10' }
}

function statusDot(status: string) {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'processing') return 'bg-amber-500 animate-pulse'
  return 'bg-gray-400'
}

export default function AgentStatusSection({ sampleMode }: AgentStatusProps) {
  const agents = sampleMode ? AGENTS : AGENTS.map(a => ({ ...a, status: 'idle', lastAction: '--', actionsToday: 0 }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Agent Status</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor all 8 automation agents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const sb = statusBadge(agent.status)
          return (
            <Card key={agent.id} className="border-border bg-card hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(agent.status)}`} />
                    <h3 className="text-sm font-semibold">{agent.name}</h3>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.text}</Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{agent.role}</p>

                <div className="grid grid-cols-3 gap-3 text-center border-t border-border pt-3">
                  <div>
                    <p className="text-lg font-bold">{agent.actionsToday}</p>
                    <p className="text-[10px] text-muted-foreground">Actions Today</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium">{agent.lastAction}</p>
                    <p className="text-[10px] text-muted-foreground">Last Action</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium">{agent.model}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.provider}</p>
                  </div>
                </div>

                <div className="flex gap-1.5 mt-3">
                  <Badge variant="outline" className="text-[10px]">{agent.type}</Badge>
                  {(agent as any).hasKB && <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">KB</Badge>}
                  {(agent as any).hasTools && <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-400/30">Tools</Badge>}
                  {(agent as any).scheduled && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Scheduled</Badge>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
