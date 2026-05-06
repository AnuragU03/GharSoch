/**
 * Live Agent Monitoring Component
 * Real-time display of agent execution events using Server-Sent Events
 * Phase 7: Real-time monitoring UI
 */

'use client'

import { useState, useEffect } from 'react'
import { useRealtimeAgentMonitoring, AgentExecutionEvent } from '@/hooks/useRealtimeAgentMonitoring'
import { formatDistanceToNow } from 'date-fns'

interface LiveAgentMonitoringProps {
  runId?: string
  agentId?: string
  title?: string
  autoScroll?: boolean
}

export function LiveAgentMonitoring({
  runId,
  agentId,
  title = 'Live Agent Monitoring',
  autoScroll = true,
}: LiveAgentMonitoringProps) {
  const { events, isConnected, error, clear } = useRealtimeAgentMonitoring({
    runId,
    agentId,
    autoStart: true,
  })

  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())

  const toggleExpanded = (index: number) => {
    const newSet = new Set(expandedEvents)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setExpandedEvents(newSet)
  }

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'execution_started':
        return 'bg-blue-900'
      case 'thinking':
        return 'bg-purple-900'
      case 'action':
        return 'bg-amber-900'
      case 'execution_completed':
        return 'bg-green-900'
      case 'execution_error':
        return 'bg-red-900'
      default:
        return 'bg-slate-900'
    }
  }

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'execution_started':
        return '▶️'
      case 'thinking':
        return '💭'
      case 'action':
        return '⚡'
      case 'execution_completed':
        return '✅'
      case 'execution_error':
        return '❌'
      default:
        return '📋'
    }
  }

  return (
    <div className="w-full bg-slate-950 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {runId && `Run: ${runId.substring(0, 8)}...`}
            {agentId && `Agent: ${agentId.substring(0, 8)}...`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {events.length > 0 && (
            <button
              onClick={clear}
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-800 text-red-300 text-sm">{error}</div>
      )}

      {/* Events List */}
      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">Waiting for events...</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {events.map((event, idx) => (
              <div
                key={idx}
                className={`px-4 py-3 ${getEventColor(event.type)} bg-opacity-10 hover:bg-opacity-20 transition-colors cursor-pointer`}
                onClick={() => toggleExpanded(idx)}
              >
                {/* Event Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-lg">{getEventIcon(event.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        {event.type === 'execution_started' && 'Execution Started'}
                        {event.type === 'thinking' && 'Reasoning Step'}
                        {event.type === 'action' && 'Action Taken'}
                        {event.type === 'execution_completed' && 'Execution Complete'}
                        {event.type === 'execution_error' && 'Error'}
                        {event.type === 'connected' && 'Connected'}
                      </p>
                      {event.timestamp && (
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-500">{expandedEvents.has(idx) ? '▼' : '▶'}</span>
                </div>

                {/* Agent Info */}
                {(event.agent_name || event.agent_id) && (
                  <p className="text-xs text-slate-400 mt-2 ml-6">
                    {event.agent_name} {event.agent_id && `(${event.agent_id.substring(0, 8)}...)`}
                  </p>
                )}

                {/* Event Details (Expanded) */}
                {expandedEvents.has(idx) && event.data && (
                  <div className="mt-3 ml-6 text-xs text-slate-300 bg-black bg-opacity-30 p-3 rounded font-mono max-h-40 overflow-y-auto">
                    {event.data.step_type && (
                      <p>
                        <span className="text-purple-300">step_type:</span> {event.data.step_type}
                      </p>
                    )}
                    {event.data.content && (
                      <p className="whitespace-pre-wrap">
                        <span className="text-purple-300">content:</span> {event.data.content}
                      </p>
                    )}
                    {event.data.confidence && (
                      <p>
                        <span className="text-purple-300">confidence:</span>{' '}
                        {(event.data.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                    {event.data.action_type && (
                      <p>
                        <span className="text-amber-300">action_type:</span> {event.data.action_type}
                      </p>
                    )}
                    {event.data.status && (
                      <p>
                        <span className="text-blue-300">status:</span> {event.data.status}
                      </p>
                    )}
                    {event.data.error_message && (
                      <p className="text-red-300">
                        <span className="text-red-400">error:</span> {event.data.error_message}
                      </p>
                    )}
                    {event.data.execution_time_ms && (
                      <p>
                        <span className="text-green-300">execution_time:</span> {event.data.execution_time_ms}ms
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-400">
        {events.length} event{events.length !== 1 ? 's' : ''} received
      </div>
    </div>
  )
}
