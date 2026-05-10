import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/runAgent'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/re-engage
 * The Dead Lead Re-engager — daily 10:00 IST
 * Finds leads with status 'cold' or 'not_interested' not contacted in 60+ days,
 * uses GPT-4o to build a personalised re-engagement context from the last call
 * transcript, then triggers a Vapi outbound call.
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { runId, output } = await runAgent({
      agentId: 'dead_lead_reengager',
      agentName: 'The Dead Lead Re-engager',
      trigger: 'cron',
      input: {
        cron_job: 're-engage',
        trigger_time: new Date().toISOString(),
      },
      metadata: { cron_type: 'scheduled', frequency: 'daily_10_IST' },

      handler: async (ctx) => {
        const now = new Date()
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

        // ── Step 1: evaluation ─────────────────────────────────────────────
        await ctx.think('evaluation',
          `Scanning for leads with status 'cold' or 'not_interested' whose last contact was on or before ${sixtyDaysAgo.toISOString()}. Limit 50 per run to stay within Vapi rate limits.`,
          { confidence: 1.0, metadata: { cutoff_date: sixtyDaysAgo.toISOString() } }
        )

        // Query uses last_contacted_at per spec; falls back to updated_at via
        // the $or so leads with neither field don't escape the net.
        const deadLeads = await ctx.db.findMany('leads', {
          dnd_status: { $ne: true },
          status: { $in: ['cold', 'not_interested'] },
          $or: [
            { last_contacted_at: { $lte: sixtyDaysAgo } },
            { last_contacted_at: { $exists: false }, updated_at: { $lte: sixtyDaysAgo } },
          ],
        })

        // Slice in handler since ctx.db.findMany doesn't expose .limit()
        const batch = (deadLeads as any[]).slice(0, 50)

        // ── Step 2: decision ───────────────────────────────────────────────
        await ctx.think('decision',
          batch.length === 0
            ? 'No leads qualify for re-engagement today. Exiting cleanly.'
            : `Found ${batch.length} cold/not-interested lead(s) dormant for 60+ days. Will fetch last transcript for each and build GPT-4o re-engagement context before dialling.`,
          { confidence: 1.0, metadata: { leads_found: batch.length } }
        )

        if (batch.length === 0) {
          return {
            triggered_calls: 0,
            total_scanned: 0,
            summary: 'No dead leads eligible for re-engagement today.',
          }
        }

        let triggeredCount = 0
        const lead_details: Array<Record<string, any>> = []

        for (const lead of batch) {
          const leadId = String(lead._id)
          const leadObjectId = new ObjectId(leadId)

          // Fetch the last call transcript for this lead (most recent call first)
          const lastCallResults = await ctx.db.findMany('calls', {
            lead_id: leadId,
            transcript: { $exists: true, $ne: null },
          })

          const lastCall = (lastCallResults as any[]).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]

          const transcriptSnippet = lastCall?.transcript
            ? String(lastCall.transcript).slice(0, 1200)
            : null

          // Build personalised re-engagement context via GPT-4o
          let reEngageContext = 'General friendly check-in — acknowledge previous conversation and ask if they are back in the market.'

          if (transcriptSnippet) {
            const gptResult = await ctx.openai.chat({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: `You are a real-estate sales coach. Given a past call transcript, write a SHORT (2-3 sentence) re-engagement talking-point for a sales agent to use when calling this dormant lead again. Acknowledge their previous concern, note that circumstances may have changed, and keep tone warm and non-pushy. Return plain text only.`,
                },
                {
                  role: 'user',
                  content: `Lead name: ${lead.name}\nPrevious status: ${lead.status}\nLast call transcript excerpt:\n${transcriptSnippet}`,
                },
              ],
              temperature: 0.4,
              max_tokens: 200,
            })
            reEngageContext = gptResult.content.trim()
          }

          await ctx.act('context_built', `Re-engagement context ready for ${lead.name}`, {
            parameters: { lead_id: leadId, has_transcript: !!transcriptSnippet },
            result: { context_preview: reEngageContext.slice(0, 120) },
          })

          const cooldownMins = parseInt(process.env.OUTBOUND_COOLDOWN_MINUTES || '240')
          if (await leadHasRecentOutboundCall(leadObjectId, cooldownMins)) {
            await ctx.act('cooldown_skip', `Skipping re-engagement call for ${lead.name}`, {
              parameters: {
                lead_id: leadId,
                reason: `Lead contacted within ${cooldownMins}m cooldown window`,
              },
            })
            lead_details.push({
              lead_id: leadId,
              lead_name: lead.name,
              status: 'cooldown_skipped',
              reason: `Lead contacted within ${cooldownMins}m cooldown window`,
            })
            continue
          }

          // Trigger Vapi outbound call via ctx.vapi
          const result = await ctx.vapi.triggerCampaignCall(
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
              script_template: reEngageContext,
            }
          )

          if (result.success) {
            // Log the call record
            await ctx.db.insertOne('calls', {
              lead_id: leadId,
              lead_name: lead.name,
              lead_phone: lead.phone,
              agent_name: 'The Dead Lead Re-engager',
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

            // Stamp last_contacted_at so this lead doesn't re-qualify tomorrow
            await ctx.db.updateOne('leads', { _id: lead._id }, {
              $set: {
                last_contacted_at: now,
                updated_at: now,
                status: 'contacted',
              },
            })

            await ctx.act('reengagement_call_triggered', `Re-engagement call queued for ${lead.name}`, {
              parameters: { lead_id: leadId, phone: lead.phone },
              result: { vapi_call_id: result.callId },
            })

            lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'triggered', vapi_call_id: result.callId })
            triggeredCount++
          } else {
            await ctx.act('reengagement_call_failed', `Vapi call failed for ${lead.name}`, {
              parameters: { lead_id: leadId },
              error: result.error || 'vapi_error',
            })
            lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'failed', error: result.error })
          }

          // Rate-limit guard
          await new Promise((r) => setTimeout(r, 1000))
        }

        // ── Step 3: result_analysis ───────────────────────────────────────
        await ctx.think('result_analysis',
          `Processed ${batch.length} dead leads. Successfully triggered ${triggeredCount} re-engagement call(s). ${batch.length - triggeredCount} failed or were skipped.`,
          { confidence: 0.95, metadata: { triggered: triggeredCount, total: batch.length } }
        )

        return {
          triggered_calls: triggeredCount,
          total_scanned: batch.length,
          lead_details,
          summary: `Triggered ${triggeredCount} re-engagement call(s) for ${batch.length} dormant lead(s).`,
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
    console.error('[Cron/ReEngage] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Dead Lead Re-engager run failed', run_id: error?.runId },
      { status: 500 }
    )
  }
}
