/**
 * Call State Validator Route
 * Validates consistency between call outcomes and lead states
 * Returns validation status, detected conflicts, and recommended corrections
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAgentConfig } from '@/lib/agentRegistry'
import { runAgent } from '@/lib/runAgent'
import { authErrorResponse, requireRole } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify call and lead belong to session.user.brokerage_id.
    const body = await request.json()
    const { call_data, lead_state } = body

    if (!call_data || !lead_state) {
      return NextResponse.json(
        { success: false, error: 'call_data and lead_state are required' },
        { status: 400 }
      )
    }

    const agentConfig = getAgentConfig('69e8f70b1234567890abcde0') // State Validator ID
    if (!agentConfig) {
      return NextResponse.json(
        { success: false, error: 'State Validator agent not found' },
        { status: 500 }
      )
    }

    const { runId, output } = await runAgent({
      agentId: agentConfig.id,
      agentName: agentConfig.name,
      trigger: 'event',
      input: { call_data, lead_state },
      metadata: { model: agentConfig.model, provider: agentConfig.provider },
      handler: async (ctx, input) => {
        // Prepare validation prompt
        const validationPrompt = `
Please validate the following call outcome against the current lead state.

CALL DATA:
- Disposition: ${call_data.disposition || 'unknown'}
- Call Outcome: ${call_data.call_outcome || 'unknown'}
- Customer Interest Level: ${call_data.customer_interest_level || 'unknown'}
- Follow-up Required: ${call_data.follow_up_required !== undefined ? call_data.follow_up_required : 'unknown'}

LEAD STATE:
- Status: ${lead_state.status || 'unknown'}
- Qualification Status: ${lead_state.qualification_status || 'unknown'}
- Interest Level: ${lead_state.interest_level || 'unknown'}
- Follow-up Required: ${lead_state.follow_up_required !== undefined ? lead_state.follow_up_required : 'unknown'}

Check for conflicts and inconsistencies. Return validation results.`

        await ctx.think(
          'evaluation',
          'Analyzing call outcome and lead state for consistency',
          { confidence: 1.0 }
        )

        const { content: responseContent } = await ctx.openai.chat({
          model: agentConfig.model || 'gpt-4o',
          messages: [
            { role: 'system', content: agentConfig.systemPrompt },
            { role: 'user', content: validationPrompt },
          ],
          response_format: { type: 'json_object' },
        })

        let validationResult: any = {}
        try {
          validationResult = JSON.parse(responseContent || '{}')
        } catch {
          validationResult = { text: responseContent }
        }

        await ctx.think(
          'result_analysis',
          `Validation complete: status=${validationResult?.validation_status}, issues found=${validationResult?.issues?.length || 0}`,
          { confidence: 0.95 }
        )

        const validationRecord = {
          lead_id: input.call_data.lead_id,
          previous_state: input.lead_state,
          new_state: input.lead_state, // Not changed yet; just validated
          trigger: {
            type: 'call_sync',
            agent_name: agentConfig.name,
            call_id: input.call_data._id || input.call_data.vapi_call_id,
          },
          validation: {
            validator_agent_run_id: ctx.runId,
            status: validationResult?.validation_status || 'valid',
            issues: validationResult?.issues || [],
            corrections_applied: validationResult?.recommended_corrections || {},
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const insertRes = await ctx.db.insertOne('lead_state_history', validationRecord)
        await ctx.act('database_insert', 'State validation record saved', {
          result: { collection: 'lead_state_history', inserted_id: insertRes.insertedId },
        })

        return {
          run_id: ctx.runId,
          validation_status: validationResult?.validation_status || 'valid',
          issues: validationResult?.issues || [],
          recommended_corrections: validationResult?.recommended_corrections || {},
          confidence: validationResult?.confidence || 0.8,
          reasoning: validationResult?.reasoning || '',
        }
      },
    })

    return NextResponse.json({
      success: true,
      data: output,
      run_id: runId,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Call-State-Validator] Error:', error)
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
