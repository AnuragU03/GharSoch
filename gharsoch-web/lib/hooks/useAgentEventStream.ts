import { useCallback, useEffect, useRef } from 'react'

export type StreamOpts = {
  agentId?: string
  runId?: string
  onEvent: (event: any) => void
}

type KnownExecutionState = {
  startedSent: boolean
  actionCount: number
  terminalStatus?: string
}

function isTerminalStatus(status: string | undefined | null) {
  return status === 'success' || status === 'completed' || status === 'failed' || status === 'error'
}

function buildSyntheticEvents(executions: any[], knownStates: Map<string, KnownExecutionState>) {
  const events: any[] = []
  const nowMs = Date.now()

  const ordered = [...executions].sort((a, b) => {
    const aTime = Date.parse(a.started_at || a.created_at || '') || 0
    const bTime = Date.parse(b.started_at || b.created_at || '') || 0
    return aTime - bTime
  })

  for (const execution of ordered) {
    const runId = execution.run_id
    if (!runId) continue

    const state = knownStates.get(runId) || {
      startedSent: false,
      actionCount: 0,
      terminalStatus: undefined,
    }
    const startedAtMs = Date.parse(execution.started_at || execution.created_at || '') || 0
    const isHistoricalTerminal = !knownStates.has(runId) && isTerminalStatus(execution.status) && nowMs - startedAtMs > 5000

    if (!state.startedSent && !isHistoricalTerminal) {
      events.push({
        type: 'execution_started',
        run_id: runId,
        agent_id: execution.agent_id,
        agent_name: execution.agent_name,
        timestamp: execution.started_at || execution.created_at || new Date().toISOString(),
        data: {
          input_data: execution.input_data || {},
        },
      })
      state.startedSent = true
    } else if (!state.startedSent) {
      state.startedSent = true
    }

    const actions = Array.isArray(execution.actions) ? execution.actions : []
    for (let index = isHistoricalTerminal ? actions.length : state.actionCount; index < actions.length; index += 1) {
      const action = actions[index]
      events.push({
        type: 'action',
        run_id: runId,
        agent_id: execution.agent_id,
        agent_name: execution.agent_name,
        timestamp: action.timestamp || execution.updated_at || execution.started_at || new Date().toISOString(),
        data: {
          action_type: action.action_type,
          description: action.description,
          status: action.status,
          parameters: action.parameters,
          result: action.result,
          error: action.error,
        },
      })
    }
    state.actionCount = actions.length

    if (!state.terminalStatus && isTerminalStatus(execution.status) && !isHistoricalTerminal) {
      events.push({
        type: execution.status === 'failed' || execution.status === 'error' ? 'execution_error' : 'execution_completed',
        run_id: runId,
        agent_id: execution.agent_id,
        agent_name: execution.agent_name,
        timestamp: execution.updated_at || execution.completed_at || execution.started_at || new Date().toISOString(),
        data:
          execution.status === 'failed' || execution.status === 'error'
            ? {
                error_message: execution.errors?.[execution.errors.length - 1]?.error_message || 'Execution failed',
                error_type: execution.errors?.[execution.errors.length - 1]?.error_type || 'Error',
                status: 'failed',
              }
            : {
                output_data: execution.output_data || {},
                execution_time_ms: execution.execution_time_ms || 0,
                status: 'success',
              },
      })
      state.terminalStatus = execution.status
    } else if (!state.terminalStatus && isTerminalStatus(execution.status)) {
      state.terminalStatus = execution.status
    }

    knownStates.set(runId, state)
  }

  return events
}

export function useAgentEventStream({ agentId, runId, onEvent }: StreamOpts) {
  const onEventRef = useRef(onEvent)
  const retryCount = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const knownStatesRef = useRef<Map<string, KnownExecutionState>>(new Map())

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connectSse = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const params = new URLSearchParams()
    if (agentId) params.set('agentId', agentId)
    if (runId) params.set('runId', runId)

    const url = `/api/agent/events${params.toString() ? `?${params.toString()}` : ''}`
    const source = new EventSource(url)
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          retryCount.current = 0
        }
        onEventRef.current(data)
      } catch (e) {
        console.error('Failed to parse SSE data', e)
      }
    }

    source.onerror = () => {
      source.close()

      const timeout = Math.min(1000 * Math.pow(2, retryCount.current), 30000)
      retryCount.current += 1

      setTimeout(() => {
        connectSse()
      }, timeout)
    }
  }, [agentId, runId])

  useEffect(() => {
    if (!agentId && !runId) {
      connectSse()

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
      }
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const emitSyntheticEvents = async () => {
      try {
        const targetAgentId = agentId
        if (!targetAgentId) {
          return
        }

        const query = new URLSearchParams({
          limit: '12',
          skip: '0',
        })
        if (runId) {
          query.set('run_id', runId)
        }

        const response = await fetch(`/api/agent/${targetAgentId}/executions?${query.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error(`Execution poll failed with ${response.status}`)
        }

        const payload = await response.json()
        const executions = runId
          ? payload?.data
            ? [payload.data]
            : []
          : Array.isArray(payload?.data?.executions)
            ? payload.data.executions
            : []

        const events = buildSyntheticEvents(executions, knownStatesRef.current)
        for (const syntheticEvent of events) {
          if (syntheticEvent.type === 'execution_completed' || syntheticEvent.type === 'execution_error') {
            window.setTimeout(() => {
              if (!cancelled) {
                onEventRef.current(syntheticEvent)
              }
            }, 1200)
          } else {
            onEventRef.current(syntheticEvent)
          }
        }
      } catch (error) {
        console.error('Agent execution polling failed', error)
      } finally {
        if (!cancelled) {
          pollTimer = setTimeout(() => {
            void emitSyntheticEvents()
          }, 1000)
        }
      }
    }

    onEventRef.current({ type: 'connected', timestamp: new Date().toISOString() })
    void emitSyntheticEvents()

    return () => {
      cancelled = true
      if (pollTimer) {
        clearTimeout(pollTimer)
      }
    }
  }, [agentId, runId, connectSse])
}
