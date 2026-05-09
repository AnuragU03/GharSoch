import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { SEED_BUILDERS } from '@/models/Builder'
import type { Builder } from '@/models/Builder'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: decide if builders are global or brokerage-scoped.
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')

    const builders = await getCollection('builders')
    const filter: Record<string, any> = {}
    if (city) filter.city = city

    const items = await builders.find(filter).toArray()
    items.sort((a, b) => {
      const cityCompare = String(a.city || '').localeCompare(String(b.city || ''))
      if (cityCompare !== 0) return cityCompare
      return String(a.name || '').localeCompare(String(b.name || ''))
    })

    // Auto-seed if empty
    if (items.length === 0) {
      await builders.insertMany(SEED_BUILDERS as any[])
      const seeded = await builders.find(filter).toArray()
      seeded.sort((a, b) => {
        const cityCompare = String(a.city || '').localeCompare(String(b.city || ''))
        if (cityCompare !== 0) return cityCompare
        return String(a.name || '').localeCompare(String(b.name || ''))
      })
      return NextResponse.json({ success: true, builders: seeded, total: seeded.length })
    }

    return NextResponse.json({ success: true, builders: items, total: items.length })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Builders] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: stamp custom builders with session.user.brokerage_id if KB becomes tenant-scoped.
    const body = await request.json()
    const { name, city, notable_projects, description, website } = body

    if (!name || !city) {
      return NextResponse.json({ success: false, error: 'name and city are required' }, { status: 400 })
    }

    const builders = await getCollection('builders')
    const builder: Omit<Builder, '_id'> = {
      name,
      city,
      notable_projects: Array.isArray(notable_projects) ? notable_projects : (notable_projects || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      description: description || '',
      website: website || '',
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await builders.insertOne(builder as any)
    return NextResponse.json({ success: true, builder: { ...builder, _id: result.insertedId } })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Builders] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify custom builder belongs to session.user.brokerage_id if tenant-scoped.
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all')

    const builders = await getCollection('builders')

    if (all === 'true') {
      const result = await builders.deleteMany({})
      return NextResponse.json({ success: true, deletedCount: result.deletedCount })
    }

    if (!id) {
      let body: any = {}
      try { body = await request.json() } catch {}
      const ids: string[] = body.ids || []
      if (!ids.length) {
        return NextResponse.json({ success: false, error: 'id or ids is required' }, { status: 400 })
      }
      const result = await builders.deleteMany({ _id: { $in: ids.map(i => new ObjectId(i)) } })
      return NextResponse.json({ success: true, deletedCount: result.deletedCount })
    }

    const result = await builders.deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Builder not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Builders] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
