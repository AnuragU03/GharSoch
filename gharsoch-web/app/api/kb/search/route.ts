import { NextRequest, NextResponse } from 'next/server'
import { searchDemoListings } from '@/lib/demoKb'
import { authErrorResponse, requireSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter KB search results by session.user.brokerage_id where applicable.
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query : ''
    const city = typeof body?.city === 'string' ? body.city : undefined
    const maxPriceInr = typeof body?.maxPriceInr === 'number' ? body.maxPriceInr : undefined
    const limit = typeof body?.limit === 'number' ? body.limit : undefined

    const results = await searchDemoListings({ query, city, maxPriceInr, limit })
    return NextResponse.json({
      success: true,
      results: results.map(r => ({
        score: r.score,
        ...r.listing,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    const authResponse = authErrorResponse(err)
    if (authResponse) return authResponse
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
}

