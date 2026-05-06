import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'
import { agentLogger } from '@/lib/agentLogger'
import { executionEventBroadcaster } from '@/lib/agentExecutionEventBroadcaster'
import { reasoningSummaryGenerator } from '@/lib/reasoningSummaryGenerator'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export async function POST(request: NextRequest) {
  let runId: string | null = null
  
  try {
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

    // Start execution logging
    runId = await agentLogger.startAgentRun(
      agent_id,
      agentConfig.name,
      {
        message,
        context,
        user_id,
        session_id,
      },
      {
        model: agentConfig.model || 'gpt-4o',
        provider: 'openai',
      }
    )

    // Broadcast execution started event
    executionEventBroadcaster.broadcastExecutionStarted(
      runId,
      agent_id,
      agentConfig.name,
      { message, context }
    )

    // Log agent initialization
    await agentLogger.logAgentThinking(
      runId,
      'evaluation',
      `Agent "${agentConfig.name}" initialized. System prompt loaded. Waiting for reasoning.`,
      1.0,
      { agent_id, system_prompt_length: agentConfig.systemPrompt.length }
    )

    executionEventBroadcaster.broadcastThinking(
      runId,
      agent_id,
      agentConfig.name,
      'evaluation',
      `Agent "${agentConfig.name}" initialized with system prompt`,
      1.0
    )

    // Call OpenAI
    await agentLogger.logAgentThinking(
      runId,
      'tool_call',
      `Calling OpenAI API with model: ${agentConfig.model || 'gpt-4o'}`,
      0.95
    )

    executionEventBroadcaster.broadcastThinking(
      runId,
      agent_id,
      agentConfig.name,
      'tool_call',
      `Calling OpenAI API with model: ${agentConfig.model || 'gpt-4o'}`,
      0.95
    )

    const completionStartTime = Date.now()

    const completion = await openai.chat.completions.create({
      model: agentConfig.model || 'gpt-4o',
      messages: [
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
    })

    const completionEndTime = Date.now()

    const responseContent = completion.choices[0].message.content

    // Log API response
    await agentLogger.logAgentAction(
      runId,
      'openai_api_call',
      'Successfully received response from OpenAI',
      { model: agentConfig.model, input_tokens: completion.usage?.prompt_tokens },
      { output_tokens: completion.usage?.completion_tokens, finish_reason: completion.choices[0].finish_reason }
    )

    executionEventBroadcaster.broadcastAction(
      runId,
      agent_id,
      agentConfig.name,
      'openai_api_call',
      'Successfully received response from OpenAI',
      'completed'
    )

    let parsedResult = {}
    try {
      parsedResult = JSON.parse(responseContent || '{}')
      await agentLogger.logAgentThinking(
        runId,
        'result_analysis',
        `Response parsed successfully. Result keys: ${Object.keys(parsedResult).join(', ')}`,
        1.0
      )

      executionEventBroadcaster.broadcastThinking(
        runId,
        agent_id,
        agentConfig.name,
        'result_analysis',
        `Response parsed successfully. Result keys: ${Object.keys(parsedResult).join(', ')}`,
        1.0
      )
    } catch (e) {
      parsedResult = { text: responseContent }
      await agentLogger.logAgentThinking(
        runId,
        'result_analysis',
        `Response could not be parsed as JSON, stored as text field`,
        0.8
      )

      executionEventBroadcaster.broadcastThinking(
        runId,
        agent_id,
        agentConfig.name,
        'result_analysis',
        `Response could not be parsed as JSON, stored as text field`,
        0.8
      )
    }

    // Generate human-readable summary of reasoning (Phase: Further Considerations)
    // Non-blocking: generate in background, don't fail response if it errors
    let reasoning_summary = null
    if (process.env.OPENAI_API_KEY) {
      try {
        const executionTrace = await agentLogger.getExecutionTrace(runId)
        if (executionTrace?.reasoning_steps?.length > 0) {
          reasoning_summary = await reasoningSummaryGenerator.generateSummary({
            agent_name: agentConfig.name,
            action_type: 'decision_made',
            reasoning_steps: executionTrace.reasoning_steps.map((step: any) => ({
              step_type: step.step_type,
              content: step.content,
              confidence: step.confidence,
            })),
            action_description: `Agent processed message and returned structured result`,
            action_result: parsedResult,
            context: context,
          })
        }
      } catch (summaryError) {
        console.error('[Agent] Summary generation failed (non-blocking):', summaryError)
        // Continue without summary - response still valid
      }
    }

    // Normalize response to match the expected format of the frontend
    const finalResponse = {
      success: true,
      status: 'completed',
      response: {
        status: 'success',
        result: parsedResult,
        message: (parsedResult as any).message || (parsedResult as any).text || (parsedResult as any).response || 'Task completed',
        reasoning_summary: reasoning_summary,
        metadata: {
          agent_name: agentConfig.name,
          timestamp: new Date().toISOString(),
          run_id: runId,
          execution_time_ms: completionEndTime - completionStartTime,
        }
      },
      timestamp: new Date().toISOString(),
    }

    // Complete execution logging with success
    await agentLogger.completeAgentRun(runId, finalResponse.response, 'completed')

    // Broadcast execution completed event
    executionEventBroadcaster.broadcastExecutionCompleted(
      runId,
      agent_id,
      agentConfig.name,
      finalResponse.response,
      completionEndTime - completionStartTime
    )

    return NextResponse.json(finalResponse)

  } catch (error) {
    console.error('[API/Agent] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'

    // Log error
    if (runId) {
      await agentLogger.logError(
        runId,
        errorMsg,
        error instanceof Error ? error.name : 'UnknownError',
        error instanceof Error ? error.stack : undefined
      )
      await agentLogger.completeAgentRun(runId, { error: errorMsg }, 'error')

      // Broadcast execution error event
      executionEventBroadcaster.broadcastExecutionError(
        runId,
        'unknown_agent',
        'Unknown Agent',
        errorMsg,
        error instanceof Error ? error.name : 'UnknownError'
      )
    }

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
