/**
 * Builder Property Refiner API
 * Re-ranks property matches based on builder knowledge from KB
 * Phase 4 update: Now queries KB for builder data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAgentConfig } from '@/lib/agentRegistry'
import { builderKBService } from '@/lib/builderKBService'
import { runAgent } from '@/lib/runAgent'

const AGENT_ID = '69e8f70b2234567890abcde1'

export async function POST(request: NextRequest) {
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

    const { output } = await runAgent({
      agentId: AGENT_ID,
      agentName: agentConfig.name,
      trigger: 'manual',
      input: {
        property_matches: propertiesToRefine,
        client_profile,
        builder_preferences,
      },
      metadata: { model: agentConfig.model, provider: 'openai' },
      handler: async (ctx, input) => {
        await ctx.think(
          'data_retrieval',
          'Fetching builder knowledge base data for re-ranking refinement',
          { confidence: 0.95 }
        )

        // Fetch builder data from KB
        const builderDataMap: Record<string, any> = {}
        const buildersToFetch = new Set<string>()

        // Collect unique builders from properties
        input.property_matches.forEach((match: any) => {
          if (match.builder_name) {
            buildersToFetch.add(match.builder_name)
          }
        })

        // Also add preferred builders from client profile
        if (input.client_profile?.preferred_builders) {
          input.client_profile.preferred_builders.forEach((builder: string) => {
            buildersToFetch.add(builder)
          })
        }

        // If builder_preferences provided, add those builders
        if (input.builder_preferences && typeof input.builder_preferences === 'object') {
          Object.keys(input.builder_preferences).forEach((builder) => {
            buildersToFetch.add(builder)
          })
        }

        // Fetch each builder from KB
        for (const builderName of buildersToFetch) {
          await ctx.act('kb_call', `getBuilderData(${builderName})`)
          const builderData = await builderKBService.getBuilderData(builderName)
          if (builderData) {
            builderDataMap[builderName] = builderData
            await ctx.think(
              'data_retrieved',
              `Retrieved KB data for builder: ${builderName} (reputation: ${builderData.reputation_score}/100)`,
              { confidence: 0.9 }
            )
          }
        }

        await ctx.think(
          'analysis',
          `Analyzing ${input.property_matches.length} properties with ${Object.keys(builderDataMap).length} builders from KB`,
          { confidence: 0.9 }
        )

        // Prepare prompt with builder KB data
        const prompt = `You are re-ranking property matches based on builder knowledge base alignment.

PROPERTIES TO RE-RANK:
${JSON.stringify(input.property_matches, null, 2)}

CLIENT PROFILE:
- Budget Range: ${input.client_profile?.budget_min || input.client_profile?.budget} - ${input.client_profile?.budget_max}
- Timeline: ${input.client_profile?.timeline_months || input.client_profile?.timeline} months
- Property Type: ${input.client_profile?.property_type}
- Preferred Builders: ${input.client_profile?.preferred_builders?.join(', ') || 'Any'}

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

        await ctx.act('openai_call', 'Calling OpenAI Builder Refiner agent with KB data', {
          parameters: { model: agentConfig.model, builder_count: Object.keys(builderDataMap).length },
        })

        const startTime = Date.now()
        const { content: responseContent } = await ctx.openai.chat({
          model: agentConfig.model || 'gpt-4o',
          messages: [
            { role: 'system', content: agentConfig.systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        })
        const endTime = Date.now()

        let refinedResult: any = { refined_matches: [], summary: '' }
        try {
          refinedResult = JSON.parse(responseContent || '{}')
          await ctx.think(
            'result_analysis',
            `Successfully parsed refinement results. Refined matches: ${refinedResult?.refined_matches?.length || 0}`,
            { confidence: 1.0 }
          )
        } catch {
          await ctx.think('result_analysis', 'Failed to parse OpenAI response (non-blocking).', { confidence: 0.7 })
        }

        return {
          success: true,
          data: {
            refined_matches: refinedResult?.refined_matches || input.property_matches,
            summary: refinedResult?.summary || 'Properties re-ranked based on builder KB data',
            reasoning_summary: null,
            builders_analyzed: Object.keys(builderDataMap).length,
            original_count: input.property_matches.length,
          },
          execution_time_ms: endTime - startTime,
          run_id: ctx.runId,
        }
      },
    })

    return NextResponse.json(output)
  } catch (error) {
    console.error('[API/BuilderRefiner] Error:', error)
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
