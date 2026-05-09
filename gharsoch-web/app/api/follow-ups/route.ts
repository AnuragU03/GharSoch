import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { authErrorResponse, requireSession } from '@/lib/auth'

export async function GET() {
  try {
    await requireSession()
    // Phase 11.5: filter follow-ups by session.user.brokerage_id.
    const leads = await getCollection('leads')

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const followUps = await leads.find({
      next_follow_up_date: { $lte: tomorrow },
      dnd_status: { $ne: true },
      status: { $nin: ['closed', 'lost'] },
    }).toArray()

    followUps.sort((a, b) => {
      const aTime = a.next_follow_up_date ? new Date(a.next_follow_up_date).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.next_follow_up_date ? new Date(b.next_follow_up_date).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })

    return NextResponse.json({ success: true, follow_ups: followUps, total: followUps.length })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/FollowUps] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
