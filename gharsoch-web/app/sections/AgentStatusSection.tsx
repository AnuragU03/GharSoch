'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { FiCpu, FiMessageSquare, FiSend, FiLoader } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { callAIAgent } from '@/lib/aiAgent'

interface AgentStatusProps {
  sampleMode: boolean
}

const AGENTS = [
  {
    id: '69e8f73cd8820b5d0188ed99',
    name: 'Voice Conversation Orchestrator',
    role: 'Manages live voice calls, routes buyer intent to specialists, handles escalation and voicemail',
    type: 'voice',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
  },
  {
    id: '69e8f707f89cad5d4b752d22',
    name: 'Lead Qualification & Objection Agent',
    role: 'Analyzes and qualifies leads, handles buyer objections with data-driven responses',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
  },
  {
    id: '69e8f7086aa016932b1c1a83',
    name: 'GharSoch Financial Advisory Agent',
    role: 'Provides financial guidance on affordability, EMI, taxes, and budget planning for buyers',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
  },
  {
    id: '69e8f709d2531e39b8b15889',
    name: 'Property Search Agent',
    role: 'Searches property knowledge base to find matching listings based on buyer criteria',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    hasKB: true,
  },
  {
    id: '69e8f71ed8820b5d0188ed95',
    name: 'Calendar Scheduling Agent',
    role: 'Manages Google Calendar integration for booking property viewings and consultations',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    hasTools: true,
  },
  {
    id: '69e8f709f89cad5d4b752d24',
    name: 'Post-Call Sync Agent',
    role: 'Syncs call data, sentiment scores, and lead status to CRM after each conversation',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
  },
  {
    id: '69e8f70a86926aed0100ba92',
    name: 'Property Re-engagement Agent',
    role: 'Runs scheduled campaigns to re-engage dormant leads with new property matches',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    scheduled: true,
  },
  {
    id: '69e8f709f89cad5d4b752d26',
    name: 'GharSoch Self-Service Advisor',
    role: 'Interactive affordability calculator and property advisory tool for end users',
    type: 'json',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
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
  const [agentsData, setAgentsData] = useState<any[] | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  
  const [activeAgent, setActiveAgent] = useState<typeof AGENTS[0] | null>(null)
  const [messages, setMessages] = useState<{role: 'user' | 'agent', text: string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchAgentStats() {
      try {
        const res = await fetch('/api/dashboard/stats')
        const data = await res.json()
        const liveAgents = AGENTS.map(agent => {
          const stats = data.agentsSummary.find((s: any) => s.name === agent.name)
          return {
            ...agent,
            status: stats ? stats.status : 'idle',
            actionsToday: stats ? stats.actions : 0,
            lastAction: stats && stats.actions > 0 ? 'Recently' : '--'
          }
        })
        setAgentsData(liveAgents)
      } catch (err) {
        console.error('Failed to load agent stats', err)
      } finally {
        setLoadingStats(false)
      }
    }

    if (!sampleMode) {
      fetchAgentStats()
    } else {
      setAgentsData(AGENTS.map(a => ({
        ...a,
        status: ['Voice Conversation Orchestrator', 'Lead Qualification & Objection Agent'].includes(a.name) ? 'active' : 'idle',
        actionsToday: Math.floor(Math.random() * 50),
        lastAction: '2 min ago'
      })))
      setLoadingStats(false)
    }
  }, [sampleMode])

  const openAgentChat = (agent: typeof AGENTS[0]) => {
    setActiveAgent(agent)
    setMessages([
      { role: 'agent', text: `[Test Terminal Active]\n\nHello, I am the ${agent.name}. This is a text-based terminal to test my prompt. Note: For actual live voice interactions, please use the Voice Call Panel or trigger a campaign. How can I assist you?` }
    ])
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !activeAgent) return

    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setLoading(true)

    try {
      const result = await callAIAgent(userMessage, activeAgent.id)
      if (result.success) {
        let responseText = 'Task completed successfully.'
        const resultData = result.response?.result
        
        if (typeof resultData === 'string') {
          responseText = resultData
        } else if (resultData?.text) {
          responseText = resultData.text
        } else if (resultData?.message) {
          responseText = resultData.message
        } else if (resultData) {
          responseText = '```json\n' + JSON.stringify(resultData, null, 2) + '\n```'
        }
        
        setMessages(prev => [...prev, { role: 'agent', text: responseText }])
      } else {
        setMessages(prev => [...prev, { role: 'agent', text: `Error: ${result.error || 'Failed to communicate with agent.'}` }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'agent', text: 'Connection error. Please try again.' }])
    }
    
    setLoading(false)
  }

  if (loadingStats || !agentsData) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <FiLoader className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Agent Status</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor and interact with all 8 automation agents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentsData.map((agent) => {
          const sb = statusBadge(agent.status)
          return (
            <Card 
              key={agent.id} 
              className="border-border bg-card hover:shadow-md transition-all cursor-pointer group hover:border-primary/50"
              onClick={() => openAgentChat(agent)}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(agent.status)}`} />
                    <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{agent.name}</h3>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.text}</Badge>
                </div>

                <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">{agent.role}</p>

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

                <div className="flex gap-1.5 mt-3 items-center justify-between">
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{agent.type}</Badge>
                    {(agent as any).hasKB && <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">KB</Badge>}
                    {(agent as any).hasTools && <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-400/30">Tools</Badge>}
                    {(agent as any).scheduled && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Scheduled</Badge>}
                  </div>
                  <FiMessageSquare className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Sheet open={!!activeAgent} onOpenChange={(open) => !open && setActiveAgent(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col border-l border-border bg-background p-0">
          {activeAgent && (
            <>
              <SheetHeader className="px-6 py-4 border-b border-border text-left">
                <SheetTitle className="text-lg flex items-center gap-2">
                  <FiCpu className="w-5 h-5 text-primary" />
                  {activeAgent.name}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {activeAgent.role}
                </SheetDescription>
              </SheetHeader>
              
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-muted-foreground mb-1 px-1">
                        {msg.role === 'user' ? 'You' : 'Agent'}
                      </span>
                      <div className={`text-sm p-3 rounded-lg max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-muted text-foreground rounded-tl-none border border-border'
                      }`}>
                        {msg.text.includes('```') ? (
                          <pre className="text-xs whitespace-pre-wrap font-mono bg-black/20 p-2 rounded mt-1">
                            {msg.text.replace(/```(json)?\n?/g, '')}
                          </pre>
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.text}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] text-muted-foreground mb-1 px-1">Agent</span>
                      <div className="text-sm p-3 rounded-lg bg-muted text-foreground rounded-tl-none border border-border flex items-center gap-2">
                        <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs opacity-70">Processing...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border bg-card">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage() }}
                  className="flex gap-2"
                >
                  <Input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Send a message to the agent..."
                    className="flex-1 bg-background"
                    disabled={loading}
                  />
                  <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0">
                    <FiSend className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
