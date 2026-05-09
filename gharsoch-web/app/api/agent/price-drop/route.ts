import { NextRequest, NextResponse } from 'next/server'

import { runPriceDropNegotiator } from '@/lib/agents/priceDropNegotiator'
import { authErrorResponse, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/agent/price-drop
 * The Price Drop Negotiator - trigger: 'event'
 * Fired in-process from property updates when a price decreases.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const isCronAuthorized = Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
    if (!isCronAuthorized) {
      await requireRole(['admin', 'tech'])
    }
    // Phase 11.5: attach actor brokerage_id to price-drop runs when multi-tenant lands.
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    throw error
  }

  let body: Record<string, any> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { property_id, new_price, new_price_lakhs, old_price } = body

  try {
    const { runId, output } = await runPriceDropNegotiator({
      property_id,
      new_price,
      new_price_lakhs,
      old_price,
    })

    return NextResponse.json({
      success: true,
      runId,
      triggered: (output as any)?.triggered_calls ?? 0,
      total_due: (output as any)?.total_scanned ?? 0,
      property: (output as any)?.property ?? {},
      summary: (output as any)?.summary ?? '',
    })
  } catch (error: any) {
    console.error('[Agent/PriceDrop] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Price Drop Negotiator run failed', run_id: error?.runId },
      { status: 500 }
    )
  }
}
