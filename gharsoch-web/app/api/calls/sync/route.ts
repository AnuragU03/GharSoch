import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'
import { authErrorResponse, requireRole } from '@/lib/auth'
import { runAgent } from '@/lib/runAgent'

const VAPI_API_KEY = process.env.VAPI_API_KEY || ''
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

/**
 * Fetch call details from VAPI API.
 */
async function fetchVapiCallDetails(callId: string) {
  if (!VAPI_API_KEY || !callId) return null

  try {
    const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    })
    if (!res.ok) {
      console.error(`[CallSync] VAPI fetch failed for ${callId}: ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.error(`[CallSync] VAPI fetch error for ${callId}:`, err)
    return null
  }
}

/**
 * Extract structured data from transcript using GPT-4o.
 */
async function analyzeTranscript(transcript: string) {
  if (!transcript || !process.env.OPENAI_API_KEY) return {}

  try {
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a post-call analyst for a real estate brokerage. Extract structured data from the call transcript. Return JSON with these fields:
          - call_summary: 2-3 sentence summary of the conversation
          - disposition: one of [interested, not_interested, callback, voicemail, no_answer, wrong_number, busy]
          - call_outcome: one of [appointment_booked, follow_up_needed, qualified, disqualified, dnc_requested, information_shared, no_outcome]
          - customer_interest_level: one of [hot, warm, cold, not_interested]
          - key_requirements: what the customer wants (string)
          - customer_objections: any objections raised (string)
          - follow_up_required: boolean
          - follow_up_notes: if follow-up needed, what should happen (string)
          - next_steps: recommended next action (string)`
        },
        { role: 'user', content: `Transcript:\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
    })

    return JSON.parse(extraction.choices[0].message.content || '{}')
  } catch (err) {
    console.error('[CallSync] GPT extraction error:', err)
    return {}
  }
}

async function runCallStateValidation(callData: any, leadState: any) {
  const agentConfig = getAgentConfig('69e8f70b1234567890abcde0')
  if (!agentConfig) {
    throw new Error('State Validator agent not found')
  }

  const { runId, output } = await runAgent({
    agentId: agentConfig.id,
    agentName: agentConfig.name,
    trigger: 'event',
    input: { call_data: callData, lead_state: leadState },
    metadata: { model: agentConfig.model, provider: agentConfig.provider },
    handler: async (ctx, input) => {
      const validationPrompt = `
Please validate the following call outcome against the current lead state.

CALL DATA:
- Disposition: ${callData.disposition || 'unknown'}
- Call Outcome: ${callData.call_outcome || 'unknown'}
- Customer Interest Level: ${callData.customer_interest_level || 'unknown'}
- Follow-up Required: ${callData.follow_up_required !== undefined ? callData.follow_up_required : 'unknown'}

LEAD STATE:
- Status: ${leadState.status || 'unknown'}
- Qualification Status: ${leadState.qualification_status || 'unknown'}
- Interest Level: ${leadState.interest_level || 'unknown'}
- Follow-up Required: ${leadState.follow_up_required !== undefined ? leadState.follow_up_required : 'unknown'}

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
        new_state: input.lead_state,
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

  return { runId, output }
}

/**
 * Build a readable transcript string from VAPI messages array.
 */
function buildTranscriptFromMessages(messages: any[]): string {
  if (!Array.isArray(messages)) return ''
  return messages
    .filter((m: any) => m.role && m.message)
    .map((m: any) => `${m.role === 'assistant' ? 'Agent' : 'Customer'}: ${m.message}`)
    .join('\n')
}

/**
 * POST /api/calls/sync
 * Syncs all in-progress calls with VAPI to get final status, transcript, recording, etc.
 * Can also sync a single call by passing { callId: "..." } in the body.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: sync only calls visible to session.user.brokerage_id.
    let body: any = {}
    try { body = await request.json() } catch {}

    const calls = await getCollection('calls')
    const leads = await getCollection('leads')

    // Find calls that need syncing
    const filter: any = body.callId
      ? { vapi_call_id: body.callId }
      : { call_status: { $in: ['in-progress', 'queued', 'ringing'] } }

    const pendingCalls = await calls.find(filter).toArray()

    if (pendingCalls.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No pending calls to sync' })
    }

    let syncedCount = 0
    const results: any[] = []

    for (const call of pendingCalls) {
      if (!call.vapi_call_id) {
        // No VAPI call ID — mark as failed
        await calls.updateOne(
          { _id: call._id },
          { $set: { call_status: 'failed', updated_at: new Date() } }
        )
        results.push({ id: call._id.toString(), status: 'failed', reason: 'no_vapi_call_id' })
        continue
      }

      const vapiData = await fetchVapiCallDetails(call.vapi_call_id)
      if (!vapiData) {
        results.push({ id: call._id.toString(), status: 'skipped', reason: 'vapi_fetch_failed' })
        continue
      }

      // Check if call has ended
      const vapiStatus = vapiData.status
      if (vapiStatus === 'queued' || vapiStatus === 'ringing' || vapiStatus === 'in-progress') {
        results.push({ id: call._id.toString(), status: 'still_active', vapiStatus })
        continue
      }

      // Call has ended — extract data
      // VAPI stores transcript in artifact.transcript or as messages array
      const rawTranscript = vapiData.artifact?.transcript
        || buildTranscriptFromMessages(vapiData.artifact?.messages || vapiData.messages)
        || ''

      const recordingUrl = vapiData.artifact?.recordingUrl
        || vapiData.recordingUrl
        || ''

      const duration = vapiData.endedAt && vapiData.startedAt
        ? Math.round((new Date(vapiData.endedAt).getTime() - new Date(vapiData.startedAt).getTime()) / 1000)
        : vapiData.duration || 0

      // Check for VAPI's built-in analysis
      const vapiAnalysis = vapiData.analysis || {}
      const vapiSummary = vapiAnalysis.summary || ''
      const vapiStructuredData = vapiAnalysis.structuredData || {}

      // Use GPT to analyze transcript if VAPI analysis is incomplete
      let extractedData: any = {}
      if (rawTranscript && rawTranscript.length > 20) {
        if (vapiSummary && vapiStructuredData.disposition) {
          // Use VAPI's analysis directly
          extractedData = {
            call_summary: vapiSummary,
            disposition: vapiStructuredData.disposition || '',
            call_outcome: vapiStructuredData.call_outcome || vapiStructuredData.callOutcome || '',
            customer_interest_level: vapiStructuredData.customer_interest_level || vapiStructuredData.interestLevel || '',
            key_requirements: vapiStructuredData.key_requirements || vapiStructuredData.requirements || '',
            customer_objections: vapiStructuredData.customer_objections || vapiStructuredData.objections || '',
            follow_up_required: vapiStructuredData.follow_up_required || false,
            follow_up_notes: vapiStructuredData.follow_up_notes || '',
            next_steps: vapiStructuredData.next_steps || vapiStructuredData.nextSteps || '',
          }
        } else {
          // Fallback to GPT analysis
          extractedData = await analyzeTranscript(rawTranscript)
        }
      } else {
        // Very short or empty transcript — call likely wasn't answered
        const endedReason = vapiData.endedReason || ''
        if (endedReason.includes('no-answer') || endedReason.includes('busy') || endedReason.includes('did-not-answer')) {
          extractedData = {
            disposition: 'no_answer',
            call_outcome: 'no_outcome',
            call_summary: `Call was not answered. Reason: ${endedReason}`,
            customer_interest_level: '',
          }
        } else if (endedReason.includes('voicemail')) {
          extractedData = {
            disposition: 'voicemail',
            call_outcome: 'no_outcome',
            call_summary: 'Call went to voicemail.',
            customer_interest_level: '',
          }
        } else {
          extractedData = {
            disposition: endedReason || 'unknown',
            call_outcome: 'no_outcome',
            call_summary: `Call ended. Reason: ${endedReason || 'unknown'}`,
            customer_interest_level: '',
          }
        }
      }

      // Update the call record with all the extracted data
      const updateData: Record<string, any> = {
        call_status: 'completed',
        duration,
        recording_url: recordingUrl || call.recording_url || '',
        transcript: rawTranscript || call.transcript || '',
        disposition: extractedData.disposition || call.disposition || '',
        call_outcome: extractedData.call_outcome || call.call_outcome || '',
        call_summary: extractedData.call_summary || call.call_summary || '',
        customer_interest_level: extractedData.customer_interest_level || call.customer_interest_level || '',
        key_requirements: extractedData.key_requirements || call.key_requirements || '',
        customer_objections: extractedData.customer_objections || call.customer_objections || '',
        follow_up_required: extractedData.follow_up_required || call.follow_up_required || false,
        follow_up_notes: extractedData.follow_up_notes || call.follow_up_notes || '',
        next_steps: extractedData.next_steps || call.next_steps || '',
        updated_at: new Date(),
      }

      if (extractedData.follow_up_required) {
        updateData.follow_up_date = new Date(Date.now() + 86400000) // Next day
      }

      await calls.updateOne({ _id: call._id }, { $set: updateData })

      // Also update the lead with insights from the call
      let updatedLead: any = null
      if (call.lead_phone && extractedData.customer_interest_level) {
        const leadUpdate: Record<string, any> = {
          interest_level: extractedData.customer_interest_level,
          updated_at: new Date(),
          last_contacted_at: new Date(),
          first_call_completed: true,
        }
        if (extractedData.customer_interest_level === 'hot') {
          leadUpdate.qualification_status = 'qualified'
          leadUpdate.lead_score = 80
        } else if (extractedData.customer_interest_level === 'warm') {
          leadUpdate.qualification_status = 'qualified'
          leadUpdate.lead_score = 50
        }
        if (extractedData.follow_up_required) {
          leadUpdate.next_follow_up_date = new Date(Date.now() + 86400000)
          leadUpdate.status = 'follow_up'
        }
        if (extractedData.customer_objections) {
          leadUpdate.objections = extractedData.customer_objections
        }

        const result = await leads.updateOne({ phone: call.lead_phone }, { $set: leadUpdate })
        updatedLead = await leads.findOne({ phone: call.lead_phone })
      }

      // Call State Validator to check for inconsistencies
      try {
        if (updatedLead) {
          const { output } = await runCallStateValidation(
            {
              _id: call._id.toString(),
              vapi_call_id: call.vapi_call_id,
              lead_id: call.lead_id,
              disposition: extractedData.disposition,
              call_outcome: extractedData.call_outcome,
              customer_interest_level: extractedData.customer_interest_level,
              follow_up_required: extractedData.follow_up_required,
            },
            {
              status: updatedLead.status,
              qualification_status: updatedLead.qualification_status,
              interest_level: updatedLead.interest_level,
              follow_up_required: updatedLead.follow_up_required,
            }
          )

          await calls.updateOne(
            { _id: call._id },
            {
              $set: {
                validator_status: output?.validation_status || 'valid',
                validator_run_id: output?.run_id,
              },
            }
          )
        }
      } catch (validationError) {
        console.error('[CallSync] State validation error (non-blocking):', validationError)
        // Continue sync even if validation fails — it's a secondary check
      }

      syncedCount++
      results.push({
        id: call._id.toString(),
        status: 'synced',
        disposition: extractedData.disposition,
        hasSummary: !!extractedData.call_summary,
        hasTranscript: !!rawTranscript,
        duration,
      })
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: pendingCalls.length,
      results,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[CallSync] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
