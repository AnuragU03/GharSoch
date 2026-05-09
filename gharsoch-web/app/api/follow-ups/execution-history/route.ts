/**
 * Follow-up Agent Execution History Endpoint
 * Retrieves detailed execution traces for follow-up cron jobs
 * Includes per-lead reasoning and decision rationale
 */

import { NextRequest, NextResponse } from 'next/server'
import { agentLogger } from '@/lib/agentLogger'
import { authErrorResponse, requireSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter execution history by session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const skip = parseInt(searchParams.get('skip') || '0')
    const includeStats = searchParams.get('include_stats') === 'true'

    const followupAgentId = '69e8f709f89cad5d4b752d24' // Follow-Up Agent ID

    // Get execution history for the Follow-Up Agent
    const executions = await agentLogger.getAgentExecutionHistory(
      followupAgentId,
      limit,
      skip
    )

    // Enrich executions with reasoning details
    const enrichedExecutions = executions.map((exec: any) => ({
      run_id: exec.run_id,
      start_time: exec.start_time,
      end_time: exec.end_time,
      execution_time_ms: exec.execution_time_ms,
      status: exec.status,
      
      // Reasoning summary
      reasoning_steps: exec.reasoning_steps.map((step: any) => ({
        timestamp: step.timestamp,
        step_type: step.step_type,
        content: step.content,
        confidence: step.confidence,
      })),
      
      // Lead details from actions
      leads_evaluated: exec.actions
        .filter((a: any) => a.action_type === 'outbound_call_trigger')
        .map((a: any) => ({
          lead_id: a.parameters?.lead_id,
          phone: a.parameters?.phone,
          status: a.status,
          error: a.error,
          description: a.description,
          timestamp: a.timestamp,
        })),
      
      // Output summary
      summary: exec.output_data ? {
        triggered_calls: exec.output_data.triggered_calls,
        total_scanned: exec.output_data.total_scanned,
        success_rate: exec.output_data.total_scanned > 0 
          ? ((exec.output_data.triggered_calls / exec.output_data.total_scanned) * 100).toFixed(1) + '%'
          : '0%',
      } : null,
      
      // Errors if any
      errors: exec.errors?.map((e: any) => ({
        timestamp: e.timestamp,
        message: e.error_message,
        type: e.error_type,
      })) || [],
    }))

    let stats = null
    if (includeStats) {
      stats = await agentLogger.getAgentStats(followupAgentId, 7)
    }

    return NextResponse.json({
      success: true,
      data: {
        executions: enrichedExecutions,
        count: enrichedExecutions.length,
        skip,
        limit,
        stats,
      },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Follow-ups/ExecutionHistory] Error:', error)
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
