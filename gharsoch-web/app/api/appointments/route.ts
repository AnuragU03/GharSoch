import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { DEFAULT_APPOINTMENT } from '@/models/Appointment'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter appointments by session.user.brokerage_id via linked lead/property.
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const leadId = searchParams.get('leadId')
    const today = searchParams.get('today')
    const upcoming = searchParams.get('upcoming')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')

    const appointments = await getCollection('appointments')
    const filter: Record<string, any> = { is_deleted: { $ne: true } }

    if (status) filter.status = status
    if (leadId) filter.lead_id = leadId

    if (today === 'true') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      filter.scheduled_at = { $gte: startOfDay, $lte: endOfDay }
    }

    if (upcoming === 'true') {
      filter.scheduled_at = { $gte: new Date() }
      filter.status = { $in: ['scheduled', 'confirmed'] }
    }

    const [items, total] = await Promise.all([
      appointments.find(filter).sort({ scheduled_at: 1 }).skip(skip).limit(limit).toArray(),
      appointments.countDocuments(filter),
    ])

    return NextResponse.json({ success: true, appointments: items, total })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Appointments] GET Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify lead/property belongs to session.user.brokerage_id.
    const body = await request.json()
    const appointments = await getCollection('appointments')

    const appointment = {
      ...DEFAULT_APPOINTMENT,
      ...body,
      scheduled_at: new Date(body.scheduled_at),
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await appointments.insertOne(appointment)

    return NextResponse.json({
      success: true,
      appointment: { ...appointment, _id: result.insertedId },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Appointments] POST Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify appointment belongs to session.user.brokerage_id.
    const body = await request.json()
    const { _id, ...updates } = body

    if (!_id) {
      return NextResponse.json({ success: false, error: '_id is required' }, { status: 400 })
    }

    const appointments = await getCollection('appointments')
    if (updates.scheduled_at) updates.scheduled_at = new Date(updates.scheduled_at)

    const result = await appointments.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updates, updated_at: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Appointments] PUT Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify appointment belongs to session.user.brokerage_id.
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all')

    const appointments = await getCollection('appointments')

    // Delete all
    if (all === 'true') {
      const result = await appointments.deleteMany({})
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
      const result = await appointments.deleteMany({ _id: { $in: ids.map(i => new ObjectId(i)) } })
      return NextResponse.json({ success: true, deletedCount: result.deletedCount })
    }

    // Single delete
    const result = await appointments.deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Appointments] DELETE Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
