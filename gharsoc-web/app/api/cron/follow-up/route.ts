import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'

// Secure cron job execution
// In production, this should be protected by an API key or cron secret.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leadsCollection = await getCollection('leads')
    const callsCollection = await getCollection('calls')
    
    const now = new Date()

    // Find all leads that:
    // 1. Have a status of 'follow_up'
    // 2. Have a next_follow_up_date that is in the past or exactly now
    // 3. dnd_status is NOT true
    const dueFollowUps = await leadsCollection.find({
      status: 'follow_up',
      dnd_status: { $ne: true },
      next_follow_up_date: { $lte: now }
    }).toArray()

    if (dueFollowUps.length === 0) {
      return NextResponse.json({ success: true, message: 'No due follow-ups found', triggered: 0 })
    }

    let triggeredCount = 0

    for (const lead of dueFollowUps) {
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

        triggeredCount++
      }
      
      // Delay slightly between calls to avoid hitting Vapi rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'The Follow-Up Agent',
      action: `Scanned ${dueFollowUps.length} due follow-ups. Triggered ${triggeredCount} calls.`,
      status: 'success',
      created_at: new Date()
    })

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} follow-up calls`,
      triggered: triggeredCount,
      total_due: dueFollowUps.length
    })

  } catch (error) {
    console.error('[API/Cron/FollowUp] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute follow-up cron job' },
      { status: 500 }
    )
  }
}
