import { NextRequest, NextResponse } from 'next/server'
import { builderKBService } from '@/lib/builderKBService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || ''
  if (!name) return NextResponse.json({ data: [] })

  try {
    const queries = await builderKBService.getBuilderRecentQueries(name)
    return NextResponse.json({ data: queries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
