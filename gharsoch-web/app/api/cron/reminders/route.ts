import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/reminders
 * The Appointment Guardian — daily 09:00 IST
 * Finds appointments in the next 24 h with reminder_sent=false, triggers
 * the Vapi reminder assistant, then marks reminder_sent=true.
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { runId, output } = await runAgent({
      agentId: 'appointment_guardian',
      agentName: 'The Appointment Guardian',
      trigger: 'cron',
      input: {
        cron_job: 'reminders',
        trigger_time: new Date().toISOString(),
      },
      metadata: { cron_type: 'scheduled', frequency: 'daily_09_IST' },

      handler: async (ctx) => {
        const now = new Date()
        const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        // ── Step 1: evaluation ─────────────────────────────────────────────
        await ctx.think('evaluation',
          `Scanning appointments between ${now.toISOString()} and ${windowEnd.toISOString()} where reminder_sent is false.`,
          { confidence: 1.0, metadata: { window_hours: 24 } }
        )

        const dueAppointments = await ctx.db.findMany('appointments', {
          status: 'scheduled',
          reminder_sent: { $ne: true },
          scheduled_at: { $gte: now, $lte: windowEnd },
        })

        // ── Step 2: decision ───────────────────────────────────────────────
        await ctx.think('decision',
          dueAppointments.length === 0
            ? 'No appointments require reminders in the next 24 h. Exiting cleanly.'
            : `Found ${dueAppointments.length} appointment(s) requiring reminder calls. Will process each, skipping DND leads.`,
          { confidence: 1.0, metadata: { appointments_found: dueAppointments.length } }
        )

        if (dueAppointments.length === 0) {
          return {
            triggered_calls: 0,
            total_scanned: 0,
            summary: 'No upcoming appointments needed reminders.',
          }
        }

        let triggeredCount = 0
        let skippedDnd = 0
        const call_details: Array<Record<string, any>> = []

        for (const appt of dueAppointments as any[]) {
          // Fetch linked lead and property via ctx.db (logged automatically)
          const lead = appt.lead_id
            ? await ctx.db.findOne('leads', { _id: new ObjectId(String(appt.lead_id)) })
            : null
          const property = appt.property_id
            ? await ctx.db.findOne('properties', { _id: new ObjectId(String(appt.property_id)) })
            : null

          if (!lead || !property) {
            await ctx.act('reminder_skip', `Skipping appt ${appt._id} — missing lead or property`, {
              parameters: { appt_id: String(appt._id) },
              error: 'missing_lead_or_property',
            })
            call_details.push({ appt_id: String(appt._id), status: 'skipped', reason: 'missing_ref' })
            continue
          }

          if (lead.dnd_status === true) {
            skippedDnd++
            call_details.push({ appt_id: String(appt._id), lead_name: lead.name, status: 'skipped', reason: 'dnd' })
            continue
          }

          // Trigger reminder call through ctx.vapi (auto-logged)
          const result = await ctx.vapi.triggerReminderCall({
            _id: appt._id,
            lead_name: lead.name,
            lead_phone: lead.phone,
            property_title: property.title,
            property_location: property.location,
            scheduled_at: appt.scheduled_at,
          })

          if (result.success) {
            // Mark reminder sent
            await ctx.db.updateOne('appointments', { _id: appt._id }, {
              $set: { reminder_sent: true, reminder_call_id: result.callId, updated_at: new Date() },
            })

            // Log the call record
            await ctx.db.insertOne('calls', {
              lead_id: String(lead._id),
              lead_name: lead.name,
              lead_phone: lead.phone,
              agent_name: 'The Appointment Guardian',
              agent_id: process.env.VAPI_ASSISTANT_REMINDER_ID || 'system',
              campaign_id: 'auto-reminders',
              direction: 'outbound',
              call_type: 'appointment_reminder',
              duration: 0,
              disposition: 'queued',
              call_outcome: 'pending',
              vapi_call_id: result.callId,
              appointment_id: String(appt._id),
              created_at: new Date(),
            })

            await ctx.act('reminder_call_triggered', `Reminder call queued for ${lead.name} re: ${property.title}`, {
              parameters: { lead_id: String(lead._id), appt_id: String(appt._id) },
              result: { vapi_call_id: result.callId, call_triggered: true },
            })

            call_details.push({ appt_id: String(appt._id), lead_name: lead.name, status: 'triggered', vapi_call_id: result.callId })
            triggeredCount++
          } else {
            await ctx.act('reminder_call_failed', `Vapi call failed for ${lead.name}`, {
              parameters: { lead_id: String(lead._id) },
              error: result.error || 'vapi_error',
            })
            call_details.push({ appt_id: String(appt._id), lead_name: lead.name, status: 'failed', error: result.error })
          }

          // Rate-limit guard: 1 s between Vapi calls
          await new Promise((r) => setTimeout(r, 1000))
        }

        // ── Step 3: result_analysis ───────────────────────────────────────
        await ctx.think('result_analysis',
          `Processed ${dueAppointments.length} appointments. Triggered ${triggeredCount} reminder calls. Skipped ${skippedDnd} DND leads.`,
          { confidence: 0.95, metadata: { triggered: triggeredCount, skipped_dnd: skippedDnd, total: dueAppointments.length } }
        )

        return {
          triggered_calls: triggeredCount,
          total_scanned: dueAppointments.length,
          skipped_dnd: skippedDnd,
          call_details,
          summary: `Triggered ${triggeredCount} reminder call(s) out of ${dueAppointments.length} due appointment(s).`,
        }
      },
    })

    return NextResponse.json({
      success: true,
      runId,
      triggered: (output as any)?.triggered_calls ?? 0,
      total_due: (output as any)?.total_scanned ?? 0,
      summary: (output as any)?.summary ?? '',
    })

  } catch (error: any) {
    console.error('[Cron/Reminders] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Appointment Guardian run failed', run_id: error?.runId },
      { status: 500 }
    )
  }
}
