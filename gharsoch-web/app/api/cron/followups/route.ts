import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'

export const dynamic = 'force-dynamic'

// A simple endpoint to trigger any pending follow-up calls
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leadsCollection = await getCollection('leads')
    const agentLogsCollection = await getCollection('agent_logs')
    const now = new Date()

    // Find leads where next_follow_up_date is in the past, and not yet contacted for this follow-up
    // We'll reset the next_follow_up_date once triggered so we don't spam them.
    const pendingFollowups = await leadsCollection.find({
      next_follow_up_date: { $lte: now, $ne: null }
    }).toArray()

    let triggeredCount = 0

    if (pendingFollowups.length === 0) {
      await agentLogsCollection.insertOne({
        agent_name: 'The Follow-Up Agent',
        action: 'Scan complete. No pending followups are due at this time.',
        status: 'success',
        created_at: new Date()
      })
      return NextResponse.json({ success: true, triggered: 0, message: 'No pending followups found.' })
    }

    for (const lead of pendingFollowups) {
      console.log(`[Followup Cron] Triggering follow-up for lead ${lead.name} (${lead.phone})`)
      
      const res = await triggerCampaignCall(
        {
          name: lead.name,
          phone: lead.phone,
          notes: lead.notes,
          budget_range: lead.budget_range,
          location_pref: lead.location_pref,
          property_type: lead.property_type
        },
        {
          campaign_name: 'Automated Followup',
          script_template: `This is an automated follow-up call. Context: ${lead.followup_reason || 'Touching base.'}`
        }
      )

      if (res.success) {
        triggeredCount++
        // Reset next_follow_up_date to prevent duplicate calls
        await leadsCollection.updateOne(
          { _id: lead._id },
          { $set: { next_follow_up_date: null, followup_reason: '' }, $inc: { follow_up_count: 1 } }
        )
      } else {
        console.error(`[Followup Cron] Failed to trigger call for ${lead.phone}: ${res.error}`)
      }
    }

    await agentLogsCollection.insertOne({
      agent_name: 'The Follow-Up Agent',
      action: `Checked ${pendingFollowups.length} pending followups. Triggered ${triggeredCount} calls.`,
      status: 'success',
      created_at: new Date()
    })

    return NextResponse.json({ success: true, triggered: triggeredCount, message: `Checked followups. Triggered ${triggeredCount} calls.` })
  } catch (error) {
    console.error('[Followup Cron] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
