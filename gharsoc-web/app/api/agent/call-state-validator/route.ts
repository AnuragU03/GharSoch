/**
 * Call State Validator Route
 * Validates consistency between call outcomes and lead states
 * Returns validation status, detected conflicts, and recommended corrections
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'
import { agentLogger } from '@/lib/agentLogger'
import { getCollection } from '@/lib/mongodb'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export async function POST(request: NextRequest) {
  let runId: string | null = null

  try {
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

    // Start logging
    runId = await agentLogger.startAgentRun(
      agentConfig.id,
      agentConfig.name,
      {
        call_data: {
          disposition: call_data.disposition,
          call_outcome: call_data.call_outcome,
          customer_interest_level: call_data.customer_interest_level,
        },
        lead_state: {
          status: lead_state.status,
          qualification_status: lead_state.qualification_status,
          interest_level: lead_state.interest_level,
          follow_up_required: lead_state.follow_up_required,
        },
      },
      {
        model: agentConfig.model,
        provider: agentConfig.provider,
      }
    )

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

    await agentLogger.logAgentThinking(
      runId,
      'evaluation',
      'Analyzing call outcome and lead state for consistency',
      1.0
    )

    // Call OpenAI for validation
    const completion = await openai.chat.completions.create({
      model: agentConfig.model || 'gpt-4o',
      messages: [
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: validationPrompt },
      ],
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0].message.content

    await agentLogger.logAgentAction(
      runId,
      'openai_api_call',
      'Validation analysis completed',
      { model: agentConfig.model },
      { finish_reason: completion.choices[0].finish_reason }
    )

    let validationResult = {}
    try {
      validationResult = JSON.parse(responseContent || '{}')
    } catch (e) {
      validationResult = { text: responseContent }
    }

    await agentLogger.logAgentThinking(
      runId,
      'result_analysis',
      `Validation complete: status=${(validationResult as any).validation_status}, issues found=${(validationResult as any).issues?.length || 0}`,
      0.95
    )

    // Store validation record in database
    const stateHistoryCollection = await getCollection('lead_state_history')
    const validationRecord = {
      lead_id: call_data.lead_id,
      previous_state: lead_state,
      new_state: lead_state, // Not changed yet; just validated
      trigger: {
        type: 'call_sync',
        agent_name: agentConfig.name,
        call_id: call_data._id || call_data.vapi_call_id,
      },
      validation: {
        validator_agent_run_id: runId,
        status: (validationResult as any).validation_status || 'valid',
        issues: (validationResult as any).issues || [],
        corrections_applied: (validationResult as any).recommended_corrections || {},
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await stateHistoryCollection.insertOne(validationRecord)

    await agentLogger.logAgentAction(
      runId,
      'database_insert',
      'State validation record saved',
      {},
      { collection: 'lead_state_history', record_id: validationRecord._id }
    )

    // Complete execution
    await agentLogger.completeAgentRun(
      runId,
      {
        validation_status: (validationResult as any).validation_status,
        issues: (validationResult as any).issues,
        recommended_corrections: (validationResult as any).recommended_corrections,
        confidence: (validationResult as any).confidence,
        reasoning: (validationResult as any).reasoning,
      },
      'completed'
    )

    return NextResponse.json({
      success: true,
      data: {
        run_id: runId,
        validation_status: (validationResult as any).validation_status || 'valid',
        issues: (validationResult as any).issues || [],
        recommended_corrections: (validationResult as any).recommended_corrections || {},
        confidence: (validationResult as any).confidence || 0.8,
        reasoning: (validationResult as any).reasoning || '',
      },
    })
  } catch (error) {
    console.error('[API/Call-State-Validator] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'

    if (runId) {
      await agentLogger.logError(
        runId,
        errorMsg,
        error instanceof Error ? error.name : 'UnknownError',
        error instanceof Error ? error.stack : undefined
      )
      await agentLogger.completeAgentRun(runId, { error: errorMsg }, 'error')
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
