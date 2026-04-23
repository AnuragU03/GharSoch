import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth'
import { searchDemoListings } from '@/lib/demoKb'

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
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
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
})

