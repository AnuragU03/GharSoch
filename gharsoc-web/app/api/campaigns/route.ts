import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_CAMPAIGN } from '@/models/Campaign'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const campaigns = await getCollection('campaigns')
    const filter: Record<string, any> = {}

    if (status) filter.status = status
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      campaigns.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      campaigns.countDocuments(filter),
    ])

    return NextResponse.json({ success: true, campaigns: items, total })
  } catch (error) {
    console.error('[API/Campaigns] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const campaigns = await getCollection('campaigns')

    const campaign = {
      ...DEFAULT_CAMPAIGN,
      ...body,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await campaigns.insertOne(campaign)

    return NextResponse.json({
      success: true,
      campaign: { ...campaign, _id: result.insertedId },
    })
  } catch (error) {
    console.error('[API/Campaigns] POST Error:', error)
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

    const campaigns = await getCollection('campaigns')
    if (updates.start_date) updates.start_date = new Date(updates.start_date)
    if (updates.end_date) updates.end_date = new Date(updates.end_date)

    const result = await campaigns.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    console.error('[API/Campaigns] PUT Error:', error)
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

    const campaigns = await getCollection('campaigns')
    const result = await campaigns.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/Campaigns] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
