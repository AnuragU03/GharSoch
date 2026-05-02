'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { FiTerminal, FiCpu, FiClock, FiCheckCircle } from 'react-icons/fi'

interface AgentLog {
  _id: string
  agent_name: string
  action: string
  status: string
  created_at: string
}

export default function AgentActivitySection() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/agent-activities')
      const data = await res.json()
      if (data.success) {
        setLogs(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch agent logs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FiCpu className="text-primary" />
            AI Operations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time monitoring of autonomous background agents</p>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
          System Active
        </Badge>
      </div>

      <div className="bg-[#0D1117] border border-border/40 rounded-xl overflow-hidden shadow-2xl relative">
        {/* Terminal Header */}
        <div className="flex items-center px-4 py-2.5 bg-[#161B22] border-b border-border/40">
          <div className="flex gap-1.5 mr-4">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="text-xs font-mono text-muted-foreground/80 flex items-center gap-2">
            <FiTerminal />
            <span>agent-ops-monitor ~ tail -f /var/log/ai_agents.log</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-5 font-mono text-sm h-[600px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <span className="animate-pulse">Initializing connection to agent matrix...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
              <FiTerminal className="w-12 h-12 mb-3" />
              <p>No agent operations logged yet.</p>
              <p className="text-xs mt-1">Background agents will appear here when they execute.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
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
                      {log.status === 'success' && (
                        <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                      )}
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
                <span className="w-2 h-4 bg-muted-foreground/30 block"></span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0D1117;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #30363D;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #484F58;
        }
      `}} />
    </div>
  )
}
