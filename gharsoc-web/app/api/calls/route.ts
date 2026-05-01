import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_CALL } from '@/models/Call'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const direction = searchParams.get('direction')
    const disposition = searchParams.get('disposition')
    const leadId = searchParams.get('leadId')
    const campaignId = searchParams.get('campaignId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const calls = await getCollection('calls')
    const filter: Record<string, any> = {}

    if (direction) filter.direction = direction
    if (disposition) filter.disposition = disposition
    if (leadId) filter.lead_id = leadId
    if (campaignId) filter.campaign_id = campaignId
    if (search) {
      filter.$or = [
        { lead_name: { $regex: search, $options: 'i' } },
        { lead_phone: { $regex: search, $options: 'i' } },
        { call_summary: { $regex: search, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      calls.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      calls.countDocuments(filter),
    ])

    return NextResponse.json({ success: true, calls: items, total })
  } catch (error) {
    console.error('[API/Calls] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const calls = await getCollection('calls')

    const call = {
      ...DEFAULT_CALL,
      ...body,
      duration: Number(body.duration) || 0,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await calls.insertOne(call)

    return NextResponse.json({
      success: true,
      call: { ...call, _id: result.insertedId },
    })
  } catch (error) {
    console.error('[API/Calls] POST Error:', error)
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

    const calls = await getCollection('calls')
    const result = await calls.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    console.error('[API/Calls] PUT Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
