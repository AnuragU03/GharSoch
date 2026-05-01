import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export async function GET() {
  try {
    const leads = await getCollection('leads')

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const followUps = await leads.find({
      next_follow_up_date: { $lte: tomorrow },
      dnd_status: { $ne: true },
      status: { $nin: ['closed', 'lost'] },
    }).sort({ next_follow_up_date: 1 }).toArray()

    return NextResponse.json({ success: true, follow_ups: followUps, total: followUps.length })
  } catch (error) {
    console.error('[API/FollowUps] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
