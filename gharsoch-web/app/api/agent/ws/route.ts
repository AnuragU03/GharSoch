/**
 * Agent Execution WebSocket Endpoint
 * Enables real-time monitoring of agent runs as they execute
 * Clients can subscribe to specific agents or runs
 */

import { NextRequest } from 'next/server'
import { executionEventBroadcaster, AgentExecutionEvent } from '@/lib/agentExecutionEventBroadcaster'
import { requireSession } from '@/lib/auth'

/**
 * WebSocket upgrade handler for real-time agent monitoring
 * Usage:
 *   ws://localhost:3000/api/agent/ws?run_id=uuid
 *   or
 *   ws://localhost:3000/api/agent/ws?agent_id=123abc
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter websocket/SSE events by session.user.brokerage_id.
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('run_id')
  const agentId = searchParams.get('agent_id')

  // This endpoint requires WebSocket upgrade
  // In Next.js 13+, WebSocket support requires a custom server or middleware
  // For now, return polling-friendly SSE (Server-Sent Events) as alternative

  if (!runId && !agentId) {
    return new Response('Missing run_id or agent_id parameter', { status: 400 })
  }

  // Set up Server-Sent Events stream
  const responseStream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected', message: 'Monitoring started' })}\n\n`)

      const eventHandler = (event: AgentExecutionEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
      }

      // Subscribe to relevant events
      const channelName = runId ? `run:${runId}` : `agent:${agentId}`
      executionEventBroadcaster.on(channelName, eventHandler)

      // Cleanup on client disconnect
      const cleanup = () => {
        executionEventBroadcaster.removeListener(channelName, eventHandler)
        controller.close()
      }

      // Send heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n')
        } catch (e) {
          cleanup()
          clearInterval(heartbeat)
        }
      }, 30000)

      // Handle client disconnect
      request.signal?.addEventListener('abort', cleanup)
    },
  })

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
