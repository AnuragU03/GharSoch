import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { triggerCallbackCall } from '@/lib/vapiClient'
import { ObjectId } from 'mongodb'

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
      is_deleted: { $ne: true },
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

      const propsCol = await getCollection('properties')

      // Z12: Resolve matched_property_id from multiple sources.
      // The matchmaker stores lead_id on calls as a string (not ObjectId),
      // so a direct query with lead._id (ObjectId) silently returns 0 results.
      // Defense-in-depth: try call inheritance with $or for both types,
      // then fall back to reading lead.matched_property_id directly.
      let inheritedPropertyId: string | null = null
      let inheritedPropertyTitle: string | null = null

      // Source 1: Look up most recent prior call's matched_property_id
      const priorCall = await callsCol.findOne(
        {
          $or: [
            { lead_id: lead._id },
            { lead_id: lead._id?.toString?.() || String(lead._id) },
          ],
          direction: 'outbound',
          matched_property_id: { $exists: true, $ne: null }
        },
        { sort: { created_at: -1 } }
      )

      if (priorCall) {
        inheritedPropertyId = priorCall.matched_property_id
        inheritedPropertyTitle = priorCall.matched_property_title || null
      }

      // Source 2 (fallback): Read directly from lead document
      if (!inheritedPropertyId && lead.matched_property_id) {
        inheritedPropertyId = lead.matched_property_id
        inheritedPropertyTitle = lead.matched_property_title || null
      }

      if (!inheritedPropertyId) {
        console.warn(`[followups cron] No matched_property_id found for lead ${lead._id} — callback will lack property context`)
      }

      // Fetch full property for location context
      const inheritedProperty = inheritedPropertyId
        ? await propsCol.findOne({ _id: new ObjectId(inheritedPropertyId.toString()) })
        : null

      const res = await triggerCallbackCall({
        phone: lead.phone,
        name: lead.name,
        variables: {
          call_purpose: 'callback',
          customer_name: lead.name || 'there',
          property_type: lead.property_type || 'properties',
          location_pref: lead.location_pref || 'your preferred area',
          budget_range: lead.budget_range || '',
          prior_topic: lead.notes || 'properties you discussed earlier',
          matched_property_id: inheritedPropertyId || '',
          matched_property_title: inheritedPropertyTitle || inheritedProperty?.title || '',
          matched_property_location: inheritedProperty?.location || '',
        }
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
              lead_phone: lead.phone,
              vapi_call_id: vapiCallId,
              direction: 'outbound',
              call_type: 'follow_up_callback',
              matched_property_id: inheritedPropertyId || null,
              matched_property_title: inheritedPropertyTitle || inheritedProperty?.title || null,
              status: 'initiated',
              agent_name: 'Follow-Up Callback',
              agent_id: process.env.VAPI_ASSISTANT_CALLBACK_ID || process.env.VAPI_ASSISTANT_REMINDER_ID || 'system',
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
