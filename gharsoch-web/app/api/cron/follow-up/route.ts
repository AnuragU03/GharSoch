import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/runAgent'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

async function handleFollowupCron(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || `Bearer ${request.headers.get('x-cron-secret')}`
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const { runId, output } = await runAgent({
      agentId: '69e8f709f89cad5d4b752d24',
      agentName: 'The Follow-Up Agent',
      trigger: 'cron',
      input: {
        cron_job: 'follow-up',
        trigger_time: new Date().toISOString(),
      },
      metadata: { cron_type: 'scheduled', frequency: 'hourly' },
      handler: async (ctx) => {
        const now = new Date()

        await ctx.think('evaluation', `Scanning for due follow-ups. Current time: ${now.toISOString()}`, {
          confidence: 1.0,
        })

        const dueFollowUps = await ctx.db.findMany('leads', {
          status: 'follow_up',
          dnd_status: { $ne: true },
          next_follow_up_date: { $lte: now },
        })

        await ctx.think('evaluation', `Found ${dueFollowUps.length} leads due for follow-up`, {
          confidence: 1.0,
          metadata: { leads_count: dueFollowUps.length },
        })

        if (dueFollowUps.length === 0) {
          await ctx.db.insertOne('agent_logs', {
            agent_name: 'The Follow-Up Agent',
            action: 'Scan complete. No follow-ups are due at this time.',
            status: 'success',
            created_at: new Date(),
          })

          return { triggered_calls: 0, total_scanned: 0, message: 'No due follow-ups' }
        }

        let triggeredCount = 0
        const lead_details: any[] = []

        for (const lead of dueFollowUps as any[]) {
          const leadEvaluation = {
            lead_id: lead._id?.toString?.() || String(lead._id),
            lead_name: lead.name,
            status: lead.status,
            interest_level: lead.interest_level,
            budget_range: lead.budget_range,
            location_pref: lead.location_pref,
            follow_up_count: lead.follow_up_count || 0,
          }

          await ctx.think('evaluation', `Evaluating lead: ${lead.name} (ID: ${leadEvaluation.lead_id})`, {
            confidence: 0.95,
            metadata: leadEvaluation,
          })

          const cooldownMins = parseInt(process.env.OUTBOUND_COOLDOWN_MINUTES || '240')
          if (await leadHasRecentOutboundCall(new ObjectId(leadEvaluation.lead_id), cooldownMins)) {
            await ctx.act('cooldown_skip', `Skipping follow-up call for ${lead.name}`, {
              parameters: {
                lead_id: leadEvaluation.lead_id,
                reason: `Lead contacted within ${cooldownMins}m cooldown window`,
              },
            })
            lead_details.push({
              lead_id: leadEvaluation.lead_id,
              lead_name: lead.name,
              status: 'cooldown_skipped',
              reason: `Lead contacted within ${cooldownMins}m cooldown window`,
            })
            continue
          }

          console.log(
            '[FOLLOWUP CRON] Calling lead',
            lead._id?.toString?.() || String(lead._id),
            'with REMINDER assistant',
            process.env.VAPI_ASSISTANT_REMINDER_ID?.substring(0, 8),
          )

          const result = await ctx.vapi.triggerReminderCall({
            _id: lead._id,
            lead_phone: lead.phone,
            lead_name: lead.name,
            property_title: 'Follow-up reminder',
            property_location: lead.location_pref || lead.budget_range || 'Existing conversation context',
            scheduled_at: lead.next_follow_up_date || now,
          })

          if (result.success) {
            await ctx.act('outbound_call_trigger', `Triggered follow-up call for ${lead.name}`, {
              parameters: { lead_id: leadEvaluation.lead_id, phone: lead.phone },
              result: { vapi_call_id: result.callId, call_triggered: true },
            })

            await ctx.db.insertOne('calls', {
              lead_id: leadEvaluation.lead_id,
              lead_name: lead.name,
              lead_phone: lead.phone,
              agent_name: 'Follow-Up Reminder',
              agent_id: process.env.VAPI_ASSISTANT_REMINDER_ID || 'system',
              campaign_id: 'auto-follow-up',
              direction: 'outbound',
              call_type: 'follow_up',
              duration: 0,
              disposition: 'queued',
              call_outcome: 'pending',
              vapi_call_id: result.callId,
              created_at: new Date(),
            })

            await ctx.db.updateOne(
              'leads',
              { _id: lead._id },
              {
                $set: { status: 'contacted', updated_at: new Date() },
                $unset: { next_follow_up_date: '' },
              }
            )

            lead_details.push({
              lead_id: leadEvaluation.lead_id,
              lead_name: lead.name,
              status: 'triggered',
              recommendation: 'Call queued for immediate execution',
            })

            triggeredCount++
          } else {
            await ctx.act('outbound_call_trigger', `Failed to trigger follow-up call for ${lead.name}`, {
              parameters: { lead_id: leadEvaluation.lead_id, phone: lead.phone },
              error: 'VAPI call trigger failed',
            })

            lead_details.push({
              lead_id: leadEvaluation.lead_id,
              lead_name: lead.name,
              status: 'failed',
              reason: 'VAPI call trigger failed',
            })
          }

          // Delay slightly between calls to avoid hitting Vapi rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        await ctx.think(
          'result_analysis',
          `Successfully triggered ${triggeredCount} out of ${dueFollowUps.length} follow-up calls`,
          { confidence: 0.95, metadata: { triggered: triggeredCount, total: dueFollowUps.length } }
        )

        await ctx.db.insertOne('agent_logs', {
          agent_name: 'The Follow-Up Agent',
          action: `Scanned ${dueFollowUps.length} due follow-ups. Triggered ${triggeredCount} calls.`,
          status: 'success',
          created_at: new Date(),
          details: lead_details,
        })

        return {
          triggered_calls: triggeredCount,
          total_scanned: dueFollowUps.length,
          lead_details,
          message: `Triggered ${triggeredCount} follow-up calls`,
        }
      },
    })

    if ((output as any)?.triggered_calls === 0 && (output as any)?.total_scanned === 0) {
      return NextResponse.json({ success: true, message: 'No due follow-ups found', triggered: 0, run_id: runId })
    }

    return NextResponse.json({
      success: true,
      message: (output as any).message,
      triggered: (output as any).triggered_calls,
      total_due: (output as any).total_scanned,
      run_id: runId,
    })

  } catch (error) {
    console.error('[API/Cron/FollowUp] GET Error:', error)

    const runId = (error as any)?.runId

    return NextResponse.json(
      { success: false, error: 'Failed to execute follow-up cron job', run_id: runId },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleFollowupCron(request)
}

export async function POST(request: NextRequest) {
  return handleFollowupCron(request)
}
