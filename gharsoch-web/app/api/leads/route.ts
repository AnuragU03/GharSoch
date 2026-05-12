import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { createLead } from '@/lib/services/leadService'
import { ObjectId } from 'mongodb'
import type { Lead } from '@/models/Lead'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'
import { auth } from '@/lib/auth'
import { requireBrokerId, BrokerScopeMissingError } from '@/lib/auth/requireBroker'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter leads by session.user.brokerage_id when multi-tenant lands.
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const qualification = searchParams.get('qualification')
    const interest = searchParams.get('interest')
    const place = searchParams.get('place')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const leads = await getCollection('leads')
    const filter: Record<string, any> = {}

    if (status) filter.status = status
    if (qualification) filter.qualification_status = qualification
    if (interest) filter.interest_level = interest
    if (place) filter.place = place
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { location_pref: { $regex: search, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      leads.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      leads.countDocuments(filter),
    ])

    return NextResponse.json({ success: true, leads: items, total })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Leads] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    const session = await auth()
    
    let brokerId: string;
    try {
      brokerId = requireBrokerId(session);
    } catch (e) {
      if (e instanceof BrokerScopeMissingError) {
        return NextResponse.json(
          { error: "broker_scope_missing", message: "Your account is not provisioned for a brokerage. Contact admin." },
          { status: 403 }
        );
      }
      throw e;
    }

    // Phase 11.5: stamp lead with session.user.brokerage_id.
    const body = await request.json();
    const result = await createLead({ ...body, broker_id: brokerId });

    if (!result.ok) {
      if (result.reason === "duplicate_phone") {
        return NextResponse.json({
          success: false,
          reason: "duplicate_phone",
          lead_id: result.existing_lead._id,
          lead_name: result.existing_lead.name,
          message: `A lead with this phone already exists (${result.existing_lead.name}).`
        }, { status: 409 });
      }
      return NextResponse.json({
        success: false,
        reason: result.reason,
        message: "Failed to create lead"
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      lead: result.lead,
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Leads] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify lead belongs to session.user.brokerage_id.
    const body = await request.json()
    const { _id, ...updates } = body

    if (updates.next_follow_up_date) {
      updates.next_follow_up_date = new Date(updates.next_follow_up_date)
    } else if (updates.next_follow_up_date === '') {
      updates.next_follow_up_date = null
    }

    if (!_id) {
      return NextResponse.json({ success: false, error: '_id is required' }, { status: 400 })
    }

    const leads = await getCollection('leads')
    const result = await leads.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Leads] PUT Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify deleted leads belong to session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all')

    const leads = await getCollection('leads')

    // Delete all
    if (all === 'true') {
      const result = await leads.deleteMany({})
      return NextResponse.json({ success: true, deletedCount: result.deletedCount })
    }

    // Bulk delete by ids (from request body)
    if (!id) {
      let body: any = {}
      try { body = await request.json() } catch {}
      const ids: string[] = body.ids || []
      if (!ids.length) {
        return NextResponse.json({ success: false, error: 'id or ids is required' }, { status: 400 })
      }
      const result = await leads.deleteMany({ _id: { $in: ids.map(i => new ObjectId(i)) } })
      return NextResponse.json({ success: true, deletedCount: result.deletedCount })
    }

    // Single delete
    const result = await leads.deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Leads] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
