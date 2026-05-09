import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter DNC rows by session.user.brokerage_id through linked leads.
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const leads = await getCollection('leads')
    const filter: Record<string, any> = { dnd_status: true }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }

    const dncList = await leads.find(filter, {
      projection: { name: 1, phone: 1, updated_at: 1 }
    }).sort({ updated_at: -1 }).toArray()

    return NextResponse.json({ success: true, dnc: dncList, total: dncList.length })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/DNC] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: only mark DNC for leads in session.user.brokerage_id.
    const { phone, reason } = await request.json()

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 })
    }

    const leads = await getCollection('leads')
    const result = await leads.updateMany(
      { phone },
      { $set: { dnd_status: true, notes: `DNC: ${reason || 'Customer requested'}`, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      await leads.insertOne({
        name: 'Unknown',
        phone,
        email: '',
        source: 'DNC',
        status: 'blocked',
        dnd_status: true,
        notes: `DNC: ${reason || 'Manual entry'}`,
        budget_range: '',
        location_pref: '',
        property_type: '',
        assigned_agent_id: '',
        place: '',
        preferred_contact_time: '',
        availability_window: '',
        availability_days: [],
        interest_level: 'not_interested',
        qualification_status: 'unqualified',
        lead_score: 0,
        last_contacted_at: null,
        next_follow_up_date: null,
        follow_up_count: 0,
        total_calls: 0,
        first_call_completed: false,
        customer_requirements: '',
        timeline: '',
        objections: '',
        created_at: new Date(),
        updated_at: new Date(),
      })
    }

    return NextResponse.json({ success: true, message: `${phone} added to DNC` })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/DNC] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: only remove DNC for leads in session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const all = searchParams.get('all')

    const leads = await getCollection('leads')

    // Remove all from DNC
    if (all === 'true') {
      await leads.updateMany(
        { dnd_status: true },
        { $set: { dnd_status: false, updated_at: new Date() } }
      )
      return NextResponse.json({ success: true, message: 'All numbers removed from DNC' })
    }

    // Bulk remove by phones (from request body)
    if (!phone) {
      let body: any = {}
      try { body = await request.json() } catch {}
      const phones: string[] = body.phones || []
      if (!phones.length) {
        return NextResponse.json({ success: false, error: 'phone or phones is required' }, { status: 400 })
      }
      await leads.updateMany(
        { phone: { $in: phones } },
        { $set: { dnd_status: false, updated_at: new Date() } }
      )
      return NextResponse.json({ success: true, message: `${phones.length} numbers removed from DNC` })
    }

    // Single remove
    await leads.updateMany(
      { phone },
      { $set: { dnd_status: false, updated_at: new Date() } }
    )

    return NextResponse.json({ success: true, message: `${phone} removed from DNC` })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/DNC] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
