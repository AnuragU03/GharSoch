import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'
import { agentLogger } from '@/lib/agentLogger'

export const dynamic = 'force-dynamic'

// Secure cron job execution
// In production, this should be protected by an API key or cron secret.
export async function GET(request: NextRequest) {
  let runId: string | null = null

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leadsCollection = await getCollection('leads')
    const callsCollection = await getCollection('calls')
    
    // Start execution logging
    runId = await agentLogger.startAgentRun(
      '69e8f709f89cad5d4b752d24', // Follow-Up Agent ID
      'The Follow-Up Agent',
      {
        cron_job: 'follow-up',
        trigger_time: new Date().toISOString(),
      },
      { cron_type: 'scheduled', frequency: 'hourly' }
    )

    const now = new Date()

    await agentLogger.logAgentThinking(
      runId,
      'evaluation',
      `Scanning for due follow-ups. Current time: ${now.toISOString()}`,
      1.0
    )

    // Find all leads that:
    // 1. Have a status of 'follow_up'
    // 2. Have a next_follow_up_date that is in the past or exactly now
    // 3. dnd_status is NOT true
    const dueFollowUps = await leadsCollection.find({
      status: 'follow_up',
      dnd_status: { $ne: true },
      next_follow_up_date: { $lte: now }
    }).toArray()

    await agentLogger.logAgentThinking(
      runId,
      'evaluation',
      `Found ${dueFollowUps.length} leads due for follow-up`,
      1.0,
      { leads_count: dueFollowUps.length }
    )

    if (dueFollowUps.length === 0) {
      const agentLogsCollection = await getCollection('agent_logs')
      await agentLogsCollection.insertOne({
        agent_name: 'The Follow-Up Agent',
        action: 'Scan complete. No follow-ups are due at this time.',
        status: 'success',
        created_at: new Date()
      })

      await agentLogger.completeAgentRun(
        runId,
        { triggered_calls: 0, total_scanned: 0, message: 'No due follow-ups' },
        'completed'
      )

      return NextResponse.json({ success: true, message: 'No due follow-ups found', triggered: 0 })
    }

    let triggeredCount = 0
    const lead_details: any[] = []

    for (const lead of dueFollowUps) {
      // Evaluate each lead
      const leadEvaluation = {
        lead_id: lead._id.toString(),
        lead_name: lead.name,
        status: lead.status,
        interest_level: lead.interest_level,
        budget_range: lead.budget_range,
        location_pref: lead.location_pref,
        follow_up_count: lead.follow_up_count || 0,
      }

      await agentLogger.logAgentThinking(
        runId,
        'evaluation',
        `Evaluating lead: ${lead.name} (ID: ${lead._id.toString()})`,
        0.95,
        leadEvaluation
      )

      // Trigger the call via Vapi Outbound Assistant
      const result = await triggerCampaignCall(
        {
          phone: lead.phone,
          name: lead.name,
          budget_range: lead.budget_range,
          location_pref: lead.location_pref,
          property_type: lead.property_type,
          notes: lead.notes,
        },
        {
          campaign_name: 'Automated Follow-Up',
          script_template: 'Acknowledge the previous conversation and resume the discussion based on their notes.',
        }
      )

      if (result.success) {
        // Log the action
        await agentLogger.logAgentAction(
          runId,
          'outbound_call_trigger',
          `Triggered follow-up call for ${lead.name}`,
          { lead_id: lead._id.toString(), phone: lead.phone },
          { vapi_call_id: result.callId, call_triggered: true }
        )

        // Log the call creation
        await callsCollection.insertOne({
          lead_id: lead._id.toString(),
          lead_name: lead.name,
          lead_phone: lead.phone,
          agent_name: 'Arya Outbound',
          agent_id: process.env.VAPI_ASSISTANT_OUTBOUND_ID || 'system',
          campaign_id: 'auto-follow-up',
          direction: 'outbound',
          call_type: 'follow_up',
          duration: 0,
          disposition: 'queued',
          call_outcome: 'pending',
          vapi_call_id: result.callId,
          created_at: new Date(),
        })

        // Unset the follow-up date so it doesn't get repeatedly called,
        // and optionally change status back to 'contacted' temporarily until the webhook updates it again.
        await leadsCollection.updateOne(
          { _id: lead._id },
          { 
            $set: { status: 'contacted', updated_at: new Date() },
            $unset: { next_follow_up_date: "" } 
          }
        )

        lead_details.push({
          lead_id: lead._id.toString(),
          lead_name: lead.name,
          status: 'triggered',
          recommendation: 'Call queued for immediate execution',
        })

        triggeredCount++
      } else {
        await agentLogger.logAgentAction(
          runId,
          'outbound_call_trigger',
          `Failed to trigger follow-up call for ${lead.name}`,
          { lead_id: lead._id.toString(), phone: lead.phone },
          {},
          'VAPI call trigger failed'
        )

        lead_details.push({
          lead_id: lead._id.toString(),
          lead_name: lead.name,
          status: 'failed',
          reason: 'VAPI call trigger failed',
        })
      }
      
      // Delay slightly between calls to avoid hitting Vapi rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    await agentLogger.logAgentThinking(
      runId,
      'result_analysis',
      `Successfully triggered ${triggeredCount} out of ${dueFollowUps.length} follow-up calls`,
      0.95,
      { triggered: triggeredCount, total: dueFollowUps.length }
    )

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'The Follow-Up Agent',
      action: `Scanned ${dueFollowUps.length} due follow-ups. Triggered ${triggeredCount} calls.`,
      status: 'success',
      created_at: new Date(),
      details: lead_details,
    })

    await agentLogger.completeAgentRun(
      runId,
      {
        triggered_calls: triggeredCount,
        total_scanned: dueFollowUps.length,
        lead_details,
        message: `Triggered ${triggeredCount} follow-up calls`,
      },
      'completed'
    )

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} follow-up calls`,
      triggered: triggeredCount,
      total_due: dueFollowUps.length,
      run_id: runId,
    })

  } catch (error) {
    console.error('[API/Cron/FollowUp] GET Error:', error)

    if (runId) {
      await agentLogger.logError(
        runId,
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.name : 'UnknownError',
        error instanceof Error ? error.stack : undefined
      )
      await agentLogger.completeAgentRun(
        runId,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'error'
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to execute follow-up cron job', run_id: runId },
      { status: 500 }
    )
  }
}
