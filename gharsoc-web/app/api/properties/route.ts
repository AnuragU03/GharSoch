import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_PROPERTY } from '@/models/Property'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const location = searchParams.get('location')
    const status = searchParams.get('status')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const bedrooms = searchParams.get('bedrooms')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const properties = await getCollection('properties')
    const filter: Record<string, any> = {}

    if (type) filter.type = type
    if (location) filter.location = { $regex: location, $options: 'i' }
    if (status) filter.status = status
    if (bedrooms) filter.bedrooms = parseInt(bedrooms)
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = parseInt(minPrice)
      if (maxPrice) filter.price.$lte = parseInt(maxPrice)
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { builder: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      properties.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      properties.countDocuments(filter),
    ])

    return NextResponse.json({ success: true, properties: items, total })
  } catch (error) {
    console.error('[API/Properties] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const properties = await getCollection('properties')

    const property = {
      ...DEFAULT_PROPERTY,
      ...body,
      price: Number(body.price) || 0,
      area_sqft: Number(body.area_sqft) || 0,
      bedrooms: Number(body.bedrooms) || 0,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await properties.insertOne(property)

    return NextResponse.json({
      success: true,
      property: { ...property, _id: result.insertedId },
    })
  } catch (error) {
    console.error('[API/Properties] POST Error:', error)
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

    const properties = await getCollection('properties')
    if (updates.price) updates.price = Number(updates.price)
    if (updates.area_sqft) updates.area_sqft = Number(updates.area_sqft)
    if (updates.bedrooms) updates.bedrooms = Number(updates.bedrooms)

    const result = await properties.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    console.error('[API/Properties] PUT Error:', error)
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

    const properties = await getCollection('properties')
    const result = await properties.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API/Properties] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
