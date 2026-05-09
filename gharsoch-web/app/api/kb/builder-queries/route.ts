import { NextRequest, NextResponse } from 'next/server'
import { builderKBService } from '@/lib/builderKBService'
import { authErrorResponse, requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter builder query history by session.user.brokerage_id.
  } catch (err) {
    const authResponse = authErrorResponse(err)
    if (authResponse) return authResponse
    throw err
  }
  const name = req.nextUrl.searchParams.get('name') || ''
  if (!name) return NextResponse.json({ data: [] })

  try {
    const queries = await builderKBService.getBuilderRecentQueries(name)
    return NextResponse.json({ data: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
