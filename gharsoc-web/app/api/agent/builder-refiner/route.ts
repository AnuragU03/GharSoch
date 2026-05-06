/**
 * Builder Property Refiner API
 * Re-ranks property matches based on builder knowledge from KB
 * Phase 4 update: Now queries KB for builder data
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'
import { agentLogger } from '@/lib/agentLogger'
import { builderKBService } from '@/lib/builderKBService'
import { executionEventBroadcaster } from '@/lib/agentExecutionEventBroadcaster'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const AGENT_ID = '69e8f70b2234567890abcde1'

export async function POST(request: NextRequest) {
  let runId: string | null = null

  try {
    const body = await request.json()
    const { property_matches, matches, client_profile, builder_preferences } = body

    // Support both property_matches and matches parameter names
    const propertiesToRefine = property_matches || matches || []

    if (!Array.isArray(propertiesToRefine) || propertiesToRefine.length === 0) {
      return NextResponse.json(
        { success: false, error: 'property_matches or matches array is required' },
        { status: 400 }
      )
    }

    const agentConfig = getAgentConfig(AGENT_ID)
    if (!agentConfig) {
      return NextResponse.json(
        { success: false, error: 'Builder Refiner agent not found' },
        { status: 404 }
      )
    }

    // Start execution logging
    runId = await agentLogger.startAgentRun(
      AGENT_ID,
      agentConfig.name,
      {
        property_count: propertiesToRefine.length,
        client_profile: {
          budget_min: client_profile?.budget_min || client_profile?.budget,
          budget_max: client_profile?.budget_max,
          timeline_months: client_profile?.timeline_months || client_profile?.timeline,
          preferred_builders: client_profile?.preferred_builders,
        },
      },
      { model: agentConfig.model, provider: 'openai' }
    )

    // Broadcast execution started
    executionEventBroadcaster.broadcastExecutionStarted(runId, AGENT_ID, agentConfig.name, {
      property_count: propertiesToRefine.length,
      client_budget_range: [client_profile?.budget_min, client_profile?.budget_max],
    })

    // Log thinking: Fetch builder KB data
    await agentLogger.logAgentThinking(
      runId,
      'data_retrieval',
      'Fetching builder knowledge base data for re-ranking refinement',
      0.95
    )

    executionEventBroadcaster.broadcastThinking(
      runId,
      AGENT_ID,
      agentConfig.name,
      'data_retrieval',
      'Fetching builder knowledge base for property re-ranking',
      0.95
    )

    // Fetch builder data from KB
    const builderDataMap: Record<string, any> = {}
    const buildersToFetch = new Set<string>()

    // Collect unique builders from properties
    propertiesToRefine.forEach((match: any) => {
      if (match.builder_name) {
        buildersToFetch.add(match.builder_name)
      }
    })

    // Also add preferred builders from client profile
    if (client_profile?.preferred_builders) {
      client_profile.preferred_builders.forEach((builder: string) => {
        buildersToFetch.add(builder)
      })
    }

    // If builder_preferences provided, add those builders
    if (builder_preferences && typeof builder_preferences === 'object') {
      Object.keys(builder_preferences).forEach((builder) => {
        buildersToFetch.add(builder)
      })
    }

    // Fetch each builder from KB
    for (const builderName of buildersToFetch) {
      const builderData = await builderKBService.getBuilderData(builderName)
      if (builderData) {
        builderDataMap[builderName] = builderData
        await agentLogger.logAgentThinking(
          runId,
          'data_retrieved',
          `Retrieved KB data for builder: ${builderName} (reputation: ${builderData.reputation_score}/100)`,
          0.9
        )
      }
    }

    executionEventBroadcaster.broadcastThinking(
      runId,
      AGENT_ID,
      agentConfig.name,
      'data_retrieval',
      `Retrieved KB data for ${Object.keys(builderDataMap).length} builders`,
      0.95
    )

    // Log thinking: Analyze properties with builder context
    await agentLogger.logAgentThinking(
      runId,
      'analysis',
      `Analyzing ${propertiesToRefine.length} properties with ${Object.keys(builderDataMap).length} builders from KB`,
      0.9
    )

    executionEventBroadcaster.broadcastThinking(
      runId,
      AGENT_ID,
      agentConfig.name,
      'analysis',
      `Analyzing ${propertiesToRefine.length} properties with builder KB context`,
      0.9
    )

    // Prepare prompt with builder KB data
    const prompt = `You are re-ranking property matches based on builder knowledge base alignment.

PROPERTIES TO RE-RANK:
${JSON.stringify(propertiesToRefine, null, 2)}

CLIENT PROFILE:
- Budget Range: ${client_profile?.budget_min || client_profile?.budget} - ${client_profile?.budget_max}
- Timeline: ${client_profile?.timeline_months || client_profile?.timeline} months
- Property Type: ${client_profile?.property_type}
- Preferred Builders: ${client_profile?.preferred_builders?.join(', ') || 'Any'}

BUILDER KNOWLEDGE BASE DATA:
${JSON.stringify(builderDataMap, null, 2)}

Re-rank the properties considering:
1. Builder payment plan alignment with client timeline
2. Builder reputation score and track record from KB
3. Budget compatibility with builder's typical project costs
4. Available financing options from KB
5. Project delivery timeline from KB

Return a JSON object with:
{
  "refined_matches": [
    {
      "property_id": "id",
      "original_score": 85,
      "builder_kb_score": 90,
      "combined_score": 87,
      "builder_name": "name",
      "ranking_reason": "explanation based on KB data",
      "new_rank": 1
    }
  ],
  "summary": "Overall re-ranking summary based on builder KB knowledge"
}`

    // Call OpenAI
    await agentLogger.logAgentAction(
      runId,
      'openai_call',
      'Calling OpenAI Builder Refiner agent with KB data',
      { model: agentConfig.model, builder_count: Object.keys(builderDataMap).length }
    )

    executionEventBroadcaster.broadcastAction(
      runId,
      AGENT_ID,
      agentConfig.name,
      'openai_call',
      'Sending property data and builder KB to OpenAI for refinement',
      'pending'
    )

    const startTime = Date.now()

    const completion = await openai.chat.completions.create({
      model: agentConfig.model || 'gpt-4o',
      messages: [
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    })

    const endTime = Date.now()
    const responseContent = completion.choices[0].message.content

    // Log successful completion
    await agentLogger.logAgentAction(
      runId,
      'openai_call',
      'Received refined property rankings from OpenAI',
      { model: agentConfig.model, input_tokens: completion.usage?.prompt_tokens },
      { output_tokens: completion.usage?.completion_tokens, finish_reason: completion.choices[0].finish_reason }
    )

    executionEventBroadcaster.broadcastAction(
      runId,
      AGENT_ID,
      agentConfig.name,
      'openai_call',
      'Successfully received refined rankings with builder KB data',
      'completed'
    )

    let refinedResult = { refined_matches: [], summary: '' }
    try {
      refinedResult = JSON.parse(responseContent || '{}')
      await agentLogger.logAgentThinking(
        runId,
        'result_analysis',
        `Successfully parsed refinement results. Refined matches: ${(refinedResult as any).refined_matches?.length || 0}`,
        1.0
      )
    } catch (e) {
      await agentLogger.logError(
        runId,
        'Failed to parse OpenAI response',
        'ParseError',
        JSON.stringify(responseContent).substring(0, 500)
      )
    }

    // Generate reasoning summary
    // Temporarily disabled: Causing SSL errors in production
    // Will re-enable after fixing OpenAI client configuration
    let reasoningSummary = null
    const ENABLE_REASONING_SUMMARY = false
    
    if (ENABLE_REASONING_SUMMARY && process.env.OPENAI_API_KEY) {
      try {
        const executionTrace = await agentLogger.getExecutionTrace(runId)
        if (executionTrace?.reasoning_steps?.length > 0) {
          reasoningSummary = await reasoningSummaryGenerator.generateSummary({
            agent_name: agentConfig.name,
            action_type: 'property_refinement',
            reasoning_steps: (executionTrace?.reasoning_steps || []).map((step: any) => ({
              step_type: step.step_type,
              content: step.content,
              confidence: step.confidence,
            })),
            action_description: `Re-ranked ${propertiesToRefine.length} properties based on builder KB alignment with client profile`,
            action_result: refinedResult,
            context: {
              builders_analyzed: Object.keys(builderDataMap).length,
              client_budget: [client_profile?.budget_min, client_profile?.budget_max],
            },
          })
        }
      } catch (summaryError) {
        console.error('[BuilderRefiner] Summary generation failed (non-blocking):', summaryError)
        // Continue without summary - response still valid
      }
    }

    const response = {
      success: true,
      data: {
        refined_matches: (refinedResult as any).refined_matches || propertiesToRefine,
        summary: (refinedResult as any).summary || 'Properties re-ranked based on builder KB data',
        reasoning_summary: reasoningSummary,
        builders_analyzed: Object.keys(builderDataMap).length,
        original_count: propertiesToRefine.length,
      },
      execution_time_ms: endTime - startTime,
      run_id: runId,
    }

    // Complete execution logging
    await agentLogger.completeAgentRun(runId, response, 'completed')

    executionEventBroadcaster.broadcastExecutionCompleted(runId, AGENT_ID, agentConfig.name, response, endTime - startTime)

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API/BuilderRefiner] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'

    if (runId) {
      await agentLogger.logError(runId, errorMsg, error instanceof Error ? error.name : 'UnknownError')
      await agentLogger.completeAgentRun(runId, { error: errorMsg }, 'error')
      executionEventBroadcaster.broadcastExecutionError(runId, AGENT_ID, 'Builder Property Refiner', errorMsg, 'ProcessingError')
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
