import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_LEAD } from '@/models/Lead'
import type { Lead } from '@/models/Lead'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const qualification = searchParams.get('qualification')
    const interest = searchParams.get('interest')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const leads = await getCollection('leads')
    const filter: Record<string, any> = {}

    if (status) filter.status = status
    if (qualification) filter.qualification_status = qualification
    if (interest) filter.interest_level = interest
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
    console.error('[API/Leads] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const leads = await getCollection('leads')

    const lead = {
      ...DEFAULT_LEAD,
      ...body,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await leads.insertOne(lead)

    return NextResponse.json({
      success: true,
      lead: { ...lead, _id: result.insertedId },
    })
  } catch (error) {
    console.error('[API/Leads] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { _id, ...updates } = body

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
    console.error('[API/Leads] PUT Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const leads = await getCollection('leads')
    const result = await leads.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/Leads] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
