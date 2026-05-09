// POST /api/agent/campaign-conductor
// Manual trigger route for the Campaign Conductor agent.
// Accepts { campaign_id } in body.
// Secured by x-cron-secret header (same token as cron routes).
// Used for: admin force-run, Gate 9.5 verification, and future /ai-operations "Force Run" button.

import { NextRequest, NextResponse } from 'next/server'
import { runCampaignConductor } from '@/lib/agents/campaignConductor'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  const incomingSecret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''

  if (!CRON_SECRET || incomingSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { campaign_id } = body as { campaign_id?: string }

    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'campaign_id is required' },
        { status: 400 }
      )
    }

    const result = await runCampaignConductor(campaign_id)

    return NextResponse.json({
      success: true,
      runId: result.runId,
      dialed: result.dialed,
      queued: result.queued,
      deferred: result.deferred,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // runId may be attached by runAgent on failure
    const runId = (err as any)?.runId
    return NextResponse.json(
      { success: false, error: message, runId },
      { status: 500 }
    )
  }
}
