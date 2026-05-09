import { NextRequest, NextResponse } from 'next/server'
import { runMatchmaker } from '@/lib/agents/matchmaker'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/matchmaker
 * The Matchmaker — cron sweep every 30 min (Phase 3.5 will promote to event).
 */
export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { runId, output } = await runMatchmaker()

    return NextResponse.json({
      success: true,
      runId,
      matches_found: (output as any)?.matches_found ?? 0,
      calls_triggered: (output as any)?.calls_triggered ?? 0,
      summary: (output as any)?.summary ?? '',
    })

  } catch (error: any) {
    console.error('[Cron/Matchmaker] Error:', error)
    return NextResponse.json(
      {
        success: false,
        runId: error?.runId,
        run_id: error?.runId,
        error: 'Matchmaker run failed',
        detail: typeof error?.message === 'string' ? error.message : undefined,
      },
      { status: 200 }
    )
  }
}
