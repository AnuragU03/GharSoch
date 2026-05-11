import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { triggerCampaignCall } from '@/lib/vapiClient'

export const dynamic = 'force-dynamic'

async function handleFollowupsCron(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || `Bearer ${request.headers.get('x-cron-secret')}`
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leadsCollection = await getCollection('leads')
    const agentLogsCollection = await getCollection('agent_logs')
    const callsCol = await getCollection('calls')
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
      const cooldownMins = parseInt(process.env.OUTBOUND_COOLDOWN_MINUTES || '240')
      if (await leadHasRecentOutboundCall(lead._id, cooldownMins)) {
        await agentLogsCollection.insertOne({
          agent_name: 'The Follow-Up Agent',
          action: `Cooldown skip for ${lead.name}: Lead contacted within ${cooldownMins}m cooldown window.`,
          status: 'success',
          created_at: new Date(),
        })
        continue
      }
      
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

        const resWithId = res as typeof res & { id?: string }
        const vapiCallId = res.callId || resWithId.id
        if (vapiCallId) {
          try {
            await callsCol.insertOne({
              lead_id: lead._id,
              vapi_call_id: vapiCallId,
              direction: 'outbound',
              status: 'initiated',
              customer_number: lead.phone,
              agent_name: 'Follow-Up Agent',
              triggered_by: 'cron_followup',
              created_at: new Date(),
              updated_at: new Date(),
            })
          } catch (err) {
            console.error('[CRON FOLLOWUP] Failed to log call:', (err as Error).message, 'lead_id:', lead._id.toString())
          }
        }
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

export async function GET(request: NextRequest) {
  return handleFollowupsCron(request)
}

export async function POST(request: NextRequest) {
  return handleFollowupsCron(request)
}
