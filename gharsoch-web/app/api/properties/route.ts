import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_PROPERTY } from '@/models/Property'
import SEED_PROPERTIES from '@/data/propertySeed'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'
import { softDeletePropertyCascade } from '@/lib/services/propertyService'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter properties by session.user.brokerage_id when multi-tenant lands.
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const builder = searchParams.get('builder')
    const city = searchParams.get('city')
    const location = searchParams.get('location')
    const status = searchParams.get('status')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const bedrooms = searchParams.get('bedrooms')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')
    const seed = searchParams.get('seed')

    if (seed === 'true') {
      await requireRole(['admin', 'tech'])
      // Phase 11.5: seed only the current session.user.brokerage_id inventory.
    }

    const properties = await getCollection('properties')
    
    const insertProperties = async () => {
      for (const prop of SEED_PROPERTIES) {
        try {
          await properties.insertOne(prop as any)
        } catch (err) {
          console.log('[API/Properties] Failed to insert property:', prop.title)
        }
      }
    }
    
    // Re-seed if requested
    if (seed === 'true') {
      try {
        await properties.deleteMany({})
      } catch (err) {
        console.log('[API/Properties] Delete many failed, proceeding anyway')
      }
      await insertProperties()
    } else {
      // Auto-seed if collection is empty
      const count = await properties.countDocuments({})
      if (count === 0) {
        await insertProperties()
      }
    }

    const filter: Record<string, any> = { is_deleted: { $ne: true } }

    if (type) filter.type = type
    if (builder) filter.builder = builder
    if (city) filter.city = city
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
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Properties] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: stamp property with session.user.brokerage_id.
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
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Properties] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify property belongs to session.user.brokerage_id.
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
      { _id: new ObjectId(_id), is_deleted: { $ne: true } },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Property not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Properties] PUT Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify deleted properties belong to session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all')

    const properties = await getCollection('properties')

    // Delete all
    if (all === 'true') {
      const confirm = searchParams.get('confirm')
      if (confirm !== 'DESTROY-ALL') {
        return NextResponse.json({ 
          success: false, 
          error: 'Mass delete requires ?confirm=DESTROY-ALL parameter for safety' 
        }, { status: 400 })
      }
      const result = await properties.deleteMany({})
      return NextResponse.json({ success: true, deletedCount: result.deletedCount, mode: 'hard_delete_all' })
    }

    // Bulk delete by ids (from request body)
    if (!id) {
      let body: any = {}
      try { body = await request.json() } catch {}
      const ids: string[] = body.ids || []
      if (!ids.length) {
        return NextResponse.json({ success: false, error: 'id or ids is required' }, { status: 400 })
      }
      const { softDeletePropertyCascade } = await import('@/lib/services/propertyService')
      const results = await Promise.all(ids.map(softDeletePropertyCascade))
      const successCount = results.filter(r => r.ok).length
      const totalLeadsUnmatched = results.reduce((sum, r) => sum + r.leads_unmatched, 0)
      return NextResponse.json({ 
        success: true, 
        deletedCount: successCount, 
        leads_unmatched: totalLeadsUnmatched,
        mode: 'soft_delete_cascade'
      })
    }

    // Single delete
    const { softDeletePropertyCascade } = await import('@/lib/services/propertyService')
    const result = await softDeletePropertyCascade(id)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Property not found' }, { status: 404 })
    }
    return NextResponse.json({ 
      success: true, 
      leads_unmatched: result.leads_unmatched,
      mode: 'soft_delete_cascade'
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Properties] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
