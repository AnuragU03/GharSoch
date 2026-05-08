/**
 * Agent Execution Details Endpoint
 * GET: Retrieve detailed execution traces for a specific agent or run
 * Supports filtering by run_id, status, date range
 */

import { NextRequest, NextResponse } from 'next/server'
import { agentLogger } from '@/lib/agentLogger'

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const skip = parseInt(searchParams.get('skip') || '0')
    const includeStats = searchParams.get('include_stats') === 'true'

    const agentId = params.agentId

    // If specific run requested, return full trace for that run
    if (runId) {
      const trace = await agentLogger.getExecutionTrace(runId)
      if (!trace) {
        return NextResponse.json(
          { success: false, error: 'Execution trace not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        data: trace,
      })
    }

    // Otherwise return execution history for the agent
    const executions = await agentLogger.getAgentExecutionHistory(agentId, limit, skip)

    let stats = null
    if (includeStats) {
      stats = await agentLogger.getAgentStats(agentId, 7)
    }

    return NextResponse.json({
      success: true,
      data: {
        executions,
        count: executions.length,
        skip,
        limit,
        stats,
      },
    })
  } catch (error) {
    console.error('[API/Agent/Executions] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
