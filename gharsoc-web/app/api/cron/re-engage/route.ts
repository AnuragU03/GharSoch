import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { triggerCampaignCall } from '@/lib/vapiClient'

// This endpoint should be triggered by a Cron job (e.g., weekly) to revive dead leads
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
    // 60 days ago
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Find leads that are cold or not interested, and haven't been contacted in 60 days
    const deadLeads = await leadsCollection.find({
      dnd_status: { $ne: true },
      $or: [
        { interest_level: { $in: ['cold', 'not_interested'] } },
        { status: { $in: ['lost', 'closed'] } }
      ],
      // We check updated_at as the proxy for last contacted if last_contacted_at isn't reliably set
      updated_at: { $lte: sixtyDaysAgo }
    }).limit(50).toArray() // Limit to 50 at a time to avoid overwhelming the system/billing

    if (deadLeads.length === 0) {
      return NextResponse.json({ success: true, message: 'No dead leads found eligible for re-engagement', triggered: 0 })
    }

    let triggeredCount = 0

    for (const lead of deadLeads) {
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
          campaign_name: 'Dead Lead Re-engagement',
          script_template: 'This is a friendly check-in call. We spoke a couple of months ago. Acknowledge that they previously paused their search or weren\'t interested, and gently ask if their situation has changed or if they are back in the market for a home. DO NOT be pushy.',
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
          campaign_id: 'auto-re-engage',
          direction: 'outbound',
          call_type: 're_engagement',
          duration: 0,
          disposition: 'queued',
          call_outcome: 'pending',
          vapi_call_id: result.callId,
          created_at: new Date(),
        })

        // Update the lead to show they've been contacted so they don't get re-engaged again tomorrow
        await leadsCollection.updateOne(
          { _id: lead._id },
          { 
            $set: { 
              status: 'contacted', 
              updated_at: new Date(),
              notes: `${lead.notes || ''}\n[System] Automatically triggered 60-day re-engagement call.`
            }
          }
        )

        triggeredCount++
      }
      
      // Delay slightly between calls to avoid hitting Vapi rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} re-engagement calls`,
      triggered: triggeredCount,
      total_due: deadLeads.length
    })

  } catch (error) {
    console.error('[API/Cron/ReEngage] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute re-engagement cron job' },
      { status: 500 }
    )
  }
}
