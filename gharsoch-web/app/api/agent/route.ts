import { NextRequest, NextResponse } from 'next/server'
import { getAgentConfig } from '@/lib/agentRegistry'
import { runAgent } from '@/lib/runAgent'
import { authErrorResponse, requireRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: attach actor brokerage_id to manual agent runs when multi-tenant lands.
    const body = await request.json()
    const { message, agent_id, context, user_id, session_id } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const agentConfig = getAgentConfig(agent_id)
    if (!agentConfig) {
      return NextResponse.json(
        { success: false, error: `Agent with ID ${agent_id} not found in registry` },
        { status: 404 }
      )
    }

    const { runId, output } = await runAgent({
      agentId: agent_id,
      agentName: agentConfig.name,
      trigger: 'manual',
      input: { message, context },
      userId: user_id,
      sessionId: session_id,
      metadata: {
        model: agentConfig.model || 'gpt-4o',
        provider: 'openai',
      },
      handler: async (ctx, input) => {
        await ctx.think(
          'evaluation',
          `Agent "${agentConfig.name}" initialized. System prompt loaded.`,
          { confidence: 1.0, metadata: { agent_id, system_prompt_length: agentConfig.systemPrompt.length } }
        )

        await ctx.think('tool_call', `Calling OpenAI API with model: ${agentConfig.model || 'gpt-4o'}`, {
          confidence: 0.95,
        })

        const completionStartTime = Date.now()
        const { content: responseContent } = await ctx.openai.chat({
          model: agentConfig.model || 'gpt-4o',
          messages: [
            { role: 'system', content: agentConfig.systemPrompt },
            { role: 'user', content: input.message },
          ],
          response_format: { type: 'json_object' },
        })
        const completionEndTime = Date.now()

        let parsedResult: any = {}
        try {
          parsedResult = JSON.parse(responseContent || '{}')
          await ctx.think(
            'result_analysis',
            `Response parsed successfully. Result keys: ${Object.keys(parsedResult).join(', ')}`,
            { confidence: 1.0 }
          )
        } catch {
          parsedResult = { text: responseContent }
          await ctx.think('result_analysis', `Response could not be parsed as JSON, stored as text field`, {
            confidence: 0.8,
          })
        }

        return {
          status: 'success',
          result: parsedResult,
          message:
            parsedResult?.message || parsedResult?.text || parsedResult?.response || 'Task completed',
          reasoning_summary: null,
          metadata: {
            agent_name: agentConfig.name,
            timestamp: new Date().toISOString(),
            run_id: ctx.runId,
            execution_time_ms: completionEndTime - completionStartTime,
          },
        }
      },
    })

    return NextResponse.json({
      success: true,
      status: 'completed',
      response: output,
      timestamp: new Date().toISOString(),
      run_id: runId,
    })

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Agent] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    const runId = (error as any)?.runId

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        run_id: runId,
      },
      { status: 500 }
    )
  }
}
