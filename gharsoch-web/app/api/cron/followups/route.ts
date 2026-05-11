import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { triggerReminderCall } from '@/lib/vapiClient'

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
      if (await leadHasRecentOutboundCall(lead._id, cooldownMins, { source: 'follow_up_callback' })) {
        await agentLogsCollection.insertOne({
          agent_name: 'The Follow-Up Agent',
          action: `Cooldown skip for ${lead.name}: Lead contacted within ${cooldownMins}m cooldown window.`,
          status: 'success',
          created_at: new Date(),
        })
        continue
      }
      
      console.log(
        '[FOLLOWUP CRON] Calling lead',
        lead._id?.toString?.() || String(lead._id),
        'with REMINDER assistant',
        process.env.VAPI_ASSISTANT_REMINDER_ID?.substring(0, 8),
      )

      const res = await triggerReminderCall({
        _id: lead._id,
        lead_phone: lead.phone,
        lead_name: lead.name,
        property_title: 'Follow-up reminder',
        property_location: lead.location_pref || lead.budget_range || 'Existing conversation context',
        scheduled_at: lead.next_follow_up_date || now,
      })

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
              call_type: 'follow_up_callback',
              status: 'initiated',
              customer_number: lead.phone,
              agent_name: 'Follow-Up Reminder',
              agent_id: process.env.VAPI_ASSISTANT_REMINDER_ID || 'system',
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
