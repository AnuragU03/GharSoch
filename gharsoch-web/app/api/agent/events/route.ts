import { NextRequest } from 'next/server'

import type { AgentExecutionTrace } from '@/lib/agentLogger'
import { getCollection } from '@/lib/mongodb'
import { requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type StreamEvent =
  | { type: 'connected'; timestamp: string }
  | { type: 'heartbeat'; timestamp: string }
  | {
      type: 'execution_started' | 'thinking' | 'action' | 'execution_completed' | 'execution_error'
      run_id: string
      agent_id: string
      agent_name: string
      timestamp: string
      data: Record<string, any>
    }

type KnownRunState = {
  startedSent: boolean
  thinkingCount: number
  actionCount: number
  terminalStatus?: string
}

const SUCCESS_STATUSES = new Set(['success', 'completed'])
const FAILURE_STATUSES = new Set(['failed', 'error'])

function buildFilter(agentId: string | null, runId: string | null, cutoffIso: string) {
  if (runId) {
    return { run_id: runId }
  }

  if (agentId) {
    return {
      agent_id: agentId,
      updated_at: { $gte: cutoffIso },
    }
  }

  return {
    updated_at: { $gte: cutoffIso },
  }
}

async function fetchRecentRuns(agentId: string | null, runId: string | null) {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const cutoffIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const runs = await collection
    .find(
      buildFilter(agentId, runId, cutoffIso),
      {
        projection: {
          run_id: 1,
          agent_id: 1,
          agent_name: 1,
          started_at: 1,
          created_at: 1,
          updated_at: 1,
          status: 1,
          input_data: 1,
          output_data: 1,
          execution_time_ms: 1,
          reasoning_steps: 1,
          actions: 1,
          errors: 1,
        },
      }
    )
    .toArray()

  return runs.sort((a, b) => {
    const aTime = Date.parse(a.started_at || a.created_at || '') || 0
    const bTime = Date.parse(b.started_at || b.created_at || '') || 0
    return aTime - bTime
  })
}

function buildDeltaEvents(runs: AgentExecutionTrace[], seen: Map<string, KnownRunState>) {
  const events: StreamEvent[] = []

  for (const run of runs) {
    const state = seen.get(run.run_id) || {
      startedSent: false,
      thinkingCount: 0,
      actionCount: 0,
      terminalStatus: undefined,
    }
    const timestampBase = run.started_at || run.created_at || new Date().toISOString()

    if (!state.startedSent) {
      events.push({
        type: 'execution_started',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: timestampBase,
        data: {
          input_data: run.input_data || {},
        },
      })
      state.startedSent = true
    }

    const reasoningSteps = Array.isArray(run.reasoning_steps) ? run.reasoning_steps : []
    for (let index = state.thinkingCount; index < reasoningSteps.length; index += 1) {
      const step = reasoningSteps[index]
      events.push({
        type: 'thinking',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: step.timestamp || run.updated_at || timestampBase,
        data: {
          step_type: step.step_type,
          content: step.content,
          confidence: step.confidence ?? 0.8,
        },
      })
    }
    state.thinkingCount = reasoningSteps.length

    const actions = Array.isArray(run.actions) ? run.actions : []
    for (let index = state.actionCount; index < actions.length; index += 1) {
      const action = actions[index]
      events.push({
        type: 'action',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: action.timestamp || run.updated_at || timestampBase,
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

    if (!state.terminalStatus && SUCCESS_STATUSES.has(run.status)) {
      events.push({
        type: 'execution_completed',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: run.updated_at || timestampBase,
        data: {
          output_data: run.output_data || {},
          execution_time_ms: run.execution_time_ms || 0,
          status: 'success',
        },
      })
      state.terminalStatus = run.status
    } else if (!state.terminalStatus && FAILURE_STATUSES.has(run.status)) {
      const latestError = Array.isArray(run.errors) && run.errors.length > 0 ? run.errors[run.errors.length - 1] : null
      events.push({
        type: 'execution_error',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: latestError?.timestamp || run.updated_at || timestampBase,
        data: {
          error_message: latestError?.error_message || 'Unknown error',
          error_type: latestError?.error_type || 'Error',
          status: 'failed',
        },
      })
      state.terminalStatus = run.status
    }

    seen.set(run.run_id, state)
  }

  return events
}

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter agent event streams by session.user.brokerage_id.
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const agentId = url.searchParams.get('agentId')
  const runId = url.searchParams.get('runId')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const seen = new Map<string, KnownRunState>()
      let closed = false

      const sendEvent = (data: StreamEvent) => {
        if (closed) {
          return
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const cleanup = () => {
        if (closed) {
          return
        }

        closed = true
        clearInterval(pollInterval)
        clearInterval(heartbeatInterval)
        try {
          controller.close()
        } catch {
          // ignore close races
        }
      }

      const pollOnce = async () => {
        try {
          const runs = await fetchRecentRuns(agentId, runId)
          const events = buildDeltaEvents(runs, seen)
          events.forEach(sendEvent)
        } catch (error: any) {
          sendEvent({
            type: 'execution_error',
            run_id: runId || 'stream',
            agent_id: agentId || 'agent_event',
            agent_name: 'Agent stream',
            timestamp: new Date().toISOString(),
            data: {
              error_message: typeof error?.message === 'string' ? error.message : 'Failed to poll agent events',
              error_type: error?.name || 'StreamPollingError',
              status: 'failed',
            },
          })
        }
      }

      sendEvent({ type: 'connected', timestamp: new Date().toISOString() })
      void pollOnce()

      const pollInterval = setInterval(() => {
        void pollOnce()
      }, 1000)

      const heartbeatInterval = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() })
      }, 25000)

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
