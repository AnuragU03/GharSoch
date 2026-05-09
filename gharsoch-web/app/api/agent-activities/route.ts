import { NextResponse } from 'next/server'
import { listActivityRuns } from '@/lib/services/agentDashboardService'
import { authErrorResponse, requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireSession()
    // Phase 11.5: filter agent activity by session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100)
    const skip = Number(searchParams.get('skip') || '0')
    const agentId = searchParams.get('agentId') || 'all'
    const result = await listActivityRuns({ limit, skip, agentId })

    return NextResponse.json({
      success: true,
      data: result.runs,
      total: result.total,
      hasMore: skip + result.runs.length < result.total,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/AgentActivities] GET Error:', error)
    return NextResponse.json({ success: true, data: [], total: 0, hasMore: false })
  }
}
