/**
 * useRealtimeAgentMonitoring Hook
 * Client-side hook for subscribing to real-time agent execution events
 * Uses Server-Sent Events (SSE) for browser compatibility
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface AgentExecutionEvent {
  type: 'execution_started' | 'thinking' | 'action' | 'execution_completed' | 'execution_error' | 'connected'
  run_id?: string
  agent_id?: string
  agent_name?: string
  timestamp?: string
  data?: Record<string, any>
  message?: string
}

interface UseRealtimeAgentMonitoringOptions {
  runId?: string
  agentId?: string
  onEvent?: (event: AgentExecutionEvent) => void
  autoStart?: boolean
}

export function useRealtimeAgentMonitoring({
  runId,
  agentId,
  onEvent,
  autoStart = true,
}: UseRealtimeAgentMonitoringOptions) {
  const [events, setEvents] = useState<AgentExecutionEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return
    }

    if (!runId && !agentId) {
      setError('Either runId or agentId must be provided')
      return
    }

    try {
      const params = new URLSearchParams()
      if (runId) params.append('run_id', runId)
      if (agentId) params.append('agent_id', agentId)

      const url = `/api/agent/ws?${params.toString()}`
      const eventSource = new EventSource(url)

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      eventSource.onmessage = (event) => {
        try {
          // Skip heartbeat messages
          if (event.data === ': heartbeat') {
            return
          }

          const parsedEvent: AgentExecutionEvent = JSON.parse(event.data)
          setEvents((prev) => [...prev, parsedEvent])

          if (onEvent) {
            onEvent(parsedEvent)
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        setError('Connection closed or lost')
        eventSource.close()
        eventSourceRef.current = null
      }

      eventSourceRef.current = eventSource
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      setIsConnected(false)
    }
  }, [runId, agentId, onEvent])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    if (autoStart) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoStart, connect, disconnect])

  return {
    events,
    isConnected,
    error,
    connect,
    disconnect,
    clear: () => setEvents([]),
  }
}
