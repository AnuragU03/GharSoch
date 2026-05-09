/**
 * Campaign Conductor Agent — Phase 9.5
 *
 * Picks up a campaign in `queued` status, resolves target leads,
 * enforces the TRAI calling window (09:00–21:00 IST), dials up to 30
 * leads per run via Vapi, and logs every action through the §4 runAgent
 * contract so every step appears in agent_execution_logs and /ai-operations.
 */

import { runAgent } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'
import type { Campaign } from '@/models/Campaign'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current hour in IST (24-hour, 0–23).
 */
function getISTHour(): number {
  const istStr = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  })
  const parsed = parseInt(istStr, 10)
  return Number.isNaN(parsed) ? new Date().getUTCHours() : parsed
}

/**
 * Returns a Date representing the next 09:00 IST from now.
 */
function nextNineAmIST(): Date {
  const now = new Date()

  // Build a date string for "today 09:00 IST"
  const todayISTDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  )
  todayISTDate.setHours(9, 0, 0, 0)

  // IST = UTC+5:30, so subtract offset to get UTC
  // toLocaleString gives us wall-clock IST; re-express as UTC:
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const nineAmISTasUTC = todayISTDate.getTime() - istOffsetMs

  // If that moment has already passed today, push to tomorrow
  const target =
    nineAmISTasUTC > Date.now()
      ? new Date(nineAmISTasUTC)
      : new Date(nineAmISTasUTC + 24 * 60 * 60 * 1000)

  return target
}

/**
 * Parse a simple text filter like "status=warm AND budget_min>=1.2Cr"
 * into a MongoDB filter object.
 *
 * Supported keys: status, budget_min, location_pref.
 * Anything else is ignored at query time (rejected at campaign creation).
 */
function parseTargetFilter(
  filterStr: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = {}

  // Split on "AND" (case-insensitive)
  const parts = filterStr.split(/\s+and\s+/i)

  for (const part of parts) {
    const trimmed = part.trim()

    // status=<value>
    const statusMatch = trimmed.match(/^status\s*=\s*(.+)$/i)
    if (statusMatch) {
      filter.status = statusMatch[1].trim()
      continue
    }

    // location_pref=<value>  or  location_pref=~<regex>
    const locationMatch = trimmed.match(/^location_pref\s*=\s*(.+)$/i)
    if (locationMatch) {
      const val = locationMatch[1].trim()
      filter.location_pref = { $regex: val, $options: 'i' }
      continue
    }

    // budget_min>=<amount>  where amount can be "1.2Cr" or "50L" or a plain number
    const budgetMatch = trimmed.match(/^budget_min\s*(>=|<=|>|<|=)\s*(.+)$/i)
    if (budgetMatch) {
      const op = budgetMatch[1]
      const rawVal = budgetMatch[2].trim()
      const numeric = parseBudget(rawVal)
      const mongoOp =
        op === '>=' ? '$gte' : op === '<=' ? '$lte' : op === '>' ? '$gt' : op === '<' ? '$lt' : '$eq'
      filter.budget_numeric = { [mongoOp]: numeric }
      continue
    }
  }

  return filter
}

/**
 * Converts budget strings like "1.2Cr", "50L", "1200000" to a numeric (paisa-free INR).
 */
function parseBudget(raw: string): number {
  const crMatch = raw.match(/^([\d.]+)\s*cr/i)
  if (crMatch) return Math.round(parseFloat(crMatch[1]) * 1_00_00_000)

  const lMatch = raw.match(/^([\d.]+)\s*l/i)
  if (lMatch) return Math.round(parseFloat(lMatch[1]) * 1_00_000)

  return parseFloat(raw) || 0
}

/**
 * Resolve the final set of target leads for a campaign.
 *
 * Precedence rules (per spec):
 *  1. target_filter absent/empty AND target_lead_ids present  → use stored IDs
 *  2. target_filter present AND target_lead_ids empty         → live filter
 *  3. BOTH present                                            → intersect
 */
async function resolveTargetLeads(
  campaign: Campaign,
  ctx: { db: { findMany: (col: string, filter: Record<string, unknown>) => Promise<unknown[]> } }
): Promise<any[]> {
  const hasFilter = Boolean(campaign.target_filter?.trim())
  const hasStoredIds = campaign.target_lead_ids.length > 0

  if (!hasFilter && !hasStoredIds) {
    return []
  }

  // Stored IDs only
  if (!hasFilter && hasStoredIds) {
    const idFilter = {
      _id: { $in: campaign.target_lead_ids.map((id) => new ObjectId(id)) },
    }
    return ctx.db.findMany('leads', idFilter)
  }

  // Live filter only
  if (hasFilter && !hasStoredIds) {
    const filter = parseTargetFilter(campaign.target_filter!)
    return ctx.db.findMany('leads', filter)
  }

  // Intersection: live filter results restricted to stored IDs
  const filter = parseTargetFilter(campaign.target_filter!)
  filter._id = { $in: campaign.target_lead_ids.map((id) => new ObjectId(id)) }
  return ctx.db.findMany('leads', filter)
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface CampaignConductorResult {
  runId: string
  dialed: number
  queued: number
  deferred: number
}

/**
 * Run the Campaign Conductor agent for a single campaign.
 *
 * Fire-and-forget safe: campaignService.launch() calls this via queueMicrotask.
 */
export async function runCampaignConductor(
  campaignId: string
): Promise<CampaignConductorResult> {
  const { runId, output } = await runAgent<
    { campaign_id: string },
    { dialed: number; queued: number; deferred: number; summary: string }
  >({
    agentId: 'campaign_conductor',
    agentName: 'Campaign Conductor',
    trigger: 'event',
    input: { campaign_id: campaignId },

    handler: async (ctx) => {
      // ── 1. Load campaign ──────────────────────────────────────────────────
      await ctx.think('evaluation', `Loading campaign ${campaignId} from Mongo`)

      const campaign = (await ctx.db.findOne('campaigns', {
        _id: new ObjectId(campaignId),
      })) as Campaign | null

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`)
      }
      if (campaign.status !== 'queued') {
        throw new Error(
          `Campaign ${campaignId} is not in queued state (current: ${campaign.status})`
        )
      }

      // ── 2. Resolve leads ──────────────────────────────────────────────────
      const targetLeads = await resolveTargetLeads(campaign, ctx)

      await ctx.think(
        'evaluation',
        `Resolved ${targetLeads.length} target leads. ` +
          `filter="${campaign.target_filter || 'none'}", ` +
          `stored_ids=${campaign.target_lead_ids.length}`
      )

      if (targetLeads.length === 0) {
        await ctx.db.updateOne(
          'campaigns',
          { _id: new ObjectId(campaignId) },
          {
            $set: {
              status: 'completed',
              dialed_count: 0,
              total_count: 0,
              updated_at: new Date(),
            },
          }
        )
        await ctx.think('result_analysis', 'No eligible leads — campaign marked completed.')
        return { dialed: 0, queued: 0, deferred: 0, summary: 'No target leads found' }
      }

      // ── 3. TRAI window check (09:00–21:00 IST) ───────────────────────────
      const hourNum = getISTHour()
      await ctx.think(
        'constraint_check',
        `TRAI window check: current IST hour = ${hourNum}. Window is 09:00–21:00.`
      )

      if (hourNum < 9 || hourNum >= 21) {
        const deferredUntil = nextNineAmIST()

        await ctx.think(
          'decision',
          `Outside TRAI window (${hourNum}:00 IST). ` +
            `Deferring ${targetLeads.length} leads until ${deferredUntil.toISOString()}.`
        )

        await ctx.db.updateOne(
          'campaigns',
          { _id: new ObjectId(campaignId) },
          {
            $set: {
              status: 'deferred',
              deferred_until: deferredUntil,
              total_count: targetLeads.length,
              updated_at: new Date(),
            },
          }
        )

        return {
          dialed: 0,
          queued: targetLeads.length,
          deferred: targetLeads.length,
          summary: `Outside TRAI window (${hourNum}:00 IST). Deferred until ${deferredUntil.toISOString()}`,
        }
      }

      // ── 4. Batch: dial up to 30 ──────────────────────────────────────────
      const batchSize = Math.min(30, targetLeads.length)
      const batch = targetLeads.slice(0, batchSize)
      const remaining = targetLeads.length - batchSize

      await ctx.think(
        'decision',
        `TRAI-compliant. Dialing batch of ${batchSize}. ` +
          `${remaining} leads queued for next sweep.`
      )

      // Mark campaign as dialing
      await ctx.db.updateOne(
        'campaigns',
        { _id: new ObjectId(campaignId) },
        {
          $set: {
            status: 'dialing',
            dialed_count: 0,
            total_count: targetLeads.length,
            started_at: new Date(),
            updated_at: new Date(),
          },
        }
      )

      const assistantId = process.env.VAPI_ASSISTANT_OUTBOUND_ID ?? ''
      let dialed = 0

      for (const lead of batch) {
        const leadId = String((lead as any)._id)

        // Skip DND leads
        if ((lead as any).dnd_status) {
          await ctx.act('lead_skipped_dnd', `Skipping DND lead ${leadId}`, {
            parameters: { lead_id: leadId },
          })
          continue
        }

        try {
          const result = await ctx.vapi.triggerOutboundCall({
            assistantId,
            customerPhone: (lead as any).phone,
            customerName: (lead as any).name,
            metadata: {
              campaign_id: campaignId,
              lead_id: leadId,
              script_template: campaign.script_template ?? '',
            },
          })

          // Insert call record
          await ctx.db.insertOne('calls', {
            lead_id: new ObjectId(leadId),
            campaign_id: new ObjectId(campaignId),
            direction: 'outbound',
            call_type: 'outbound',
            vapi_call_id: result.callId ?? '',
            status: 'initiated',
            call_status: 'initiated',
            assistant_id: assistantId,
            lead_name: (lead as any).name ?? '',
            lead_phone: (lead as any).phone ?? '',
            agent_name: 'Campaign Conductor',
            trai_compliant: true,
            created_at: new Date(),
            updated_at: new Date(),
          })

          // Stamp lead as contacted
          await ctx.db.updateOne(
            'leads',
            { _id: new ObjectId(leadId) },
            { $set: { last_contacted_at: new Date(), updated_at: new Date() } }
          )

          dialed++
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          await ctx.act('vapi_call_failed', `Vapi call failed for lead ${leadId}: ${msg}`, {
            parameters: { lead_id: leadId },
            error: msg,
          })
        }
      }

      // ── 5. Final campaign status update ──────────────────────────────────
      const isComplete = dialed + (batchSize - dialed) >= targetLeads.length && remaining === 0
      const finalStatus = isComplete ? 'completed' : 'dialing'

      await ctx.db.updateOne(
        'campaigns',
        { _id: new ObjectId(campaignId) },
        {
          $set: {
            dialed_count: dialed,
            status: finalStatus,
            updated_at: new Date(),
          },
        }
      )

      await ctx.think(
        'result_analysis',
        `Dialed ${dialed}/${batchSize} successfully. ` +
          `${remaining} remain for next sweep. ` +
          `Campaign is now '${finalStatus}'.`
      )

      const summary = `Dialed ${dialed} of ${targetLeads.length} target leads. ${remaining > 0 ? `${remaining} deferred to next sweep.` : 'Campaign complete.'}`

      return {
        dialed,
        queued: remaining,
        deferred: 0,
        summary,
      }
    },
  })

  return { runId, dialed: output!.dialed, queued: output!.queued, deferred: output!.deferred }
}
