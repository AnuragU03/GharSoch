// Campaign Sweep Cron — Phase 9.5
// POST /api/cron/campaign-sweep  |  Secured by x-cron-secret header
//
// Finds campaigns with status='deferred' AND deferred_until <= now,
// resets each to 'queued', then fires runCampaignConductor for each.
//
// Phase 12 Azure schedule: every 30 min
// NCRONTAB: "0 0,30 * * * *" — requires WEBSITE_TIME_ZONE=India Standard Time


import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/runAgent'
import { runCampaignConductor } from '@/lib/agents/campaignConductor'
import type { CampaignStatus } from '@/models/Campaign'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Auth: x-cron-secret header or Authorization Bearer
  const incomingSecret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''

  if (!CRON_SECRET || incomingSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { runId, output } = await runAgent<
      { triggered_at: string },
      { re_queued: number; campaign_ids: string[]; summary: string }
    >({
      agentId: 'campaign_sweeper',
      agentName: 'Campaign Sweeper',
      trigger: 'cron',
      input: { triggered_at: new Date().toISOString() },

      handler: async (ctx) => {
        // ── 1. Find deferred campaigns whose window has passed ──────────────
        await ctx.think(
          'evaluation',
          `Scanning for deferred campaigns with deferred_until <= ${new Date().toISOString()}`
        )

        const now = new Date()
        // Note: ctx.db.findMany passes the filter directly to MongoDB.
        // We access the campaigns collection via ctx.db for full audit logging.
        const deferredCampaigns = await ctx.db.findMany('campaigns', {
          status: 'deferred',
          deferred_until: { $lte: now },
        })

        await ctx.think(
          'decision',
          `Found ${deferredCampaigns.length} deferred campaign(s) ready to re-queue.`
        )

        if (deferredCampaigns.length === 0) {
          return {
            re_queued: 0,
            campaign_ids: [],
            summary: 'No deferred campaigns ready to re-queue.',
          }
        }

        // ── 2. Reset each to 'queued' and fire Conductor ─────────────────────
        const reQueued: string[] = []

        for (const campaign of deferredCampaigns) {
          const id = String((campaign as any)._id)

          // Reset status to 'queued' and clear deferred_until in one atomic update.
          // ctx.db.updateOne passes the update document directly to MongoDB,
          // so $set + $unset compound ops are fully supported.
          await ctx.db.updateOne(
            'campaigns',
            { _id: (campaign as any)._id },
            {
              $set: {
                status: 'queued' as CampaignStatus,
                updated_at: new Date(),
              },
              $unset: { deferred_until: '' },
            }
          )

          // Fire Conductor (fire-and-forget — same pattern as campaignService.launch)
          queueMicrotask(() => {
            void runCampaignConductor(id).catch((err) => {
              console.error('[campaign-sweep] Conductor error for campaign', id, err)
            })
          })

          reQueued.push(id)
        }

        await ctx.think(
          'result_analysis',
          `Re-queued and fired Conductor for ${reQueued.length} campaign(s): [${reQueued.join(', ')}]`
        )

        return {
          re_queued: reQueued.length,
          campaign_ids: reQueued,
          summary: `Re-queued ${reQueued.length} deferred campaign(s) and fired Campaign Conductor for each.`,
        }
      },
    })

    return NextResponse.json({
      success: true,
      runId,
      re_queued: output?.re_queued ?? 0,
      campaign_ids: output?.campaign_ids ?? [],
      summary: output?.summary ?? '',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[campaign-sweep] Fatal error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
