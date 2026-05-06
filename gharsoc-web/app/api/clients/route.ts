import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

// GET /api/clients — list all clients
export async function GET() {
  try {
    const clients = await getCollection('clients')
    const data = await clients.find({}).sort({ created_at: -1 }).toArray()
    return NextResponse.json({ success: true, clients: data })
  } catch (error) {
    console.error('[API/Clients] GET Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 })
  }
}

// POST /api/clients — add a new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, budget_range, location_pref, property_type, timeline, notes } = body

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 })
    }

    const clients = await getCollection('clients')

    // Check for duplicate
    const existing = await clients.findOne({ phone })
    if (existing) {
      return NextResponse.json({ success: false, error: 'A client with this phone number already exists' }, { status: 409 })
    }

    const newClient = {
      name,
      phone,
      email: email || '',
      budget_range: budget_range || '',
      location_pref: location_pref || '',
      property_type: property_type || '',
      timeline: timeline || '',
      notes: notes || '',
      status: 'new',                    // new | matched | converted_to_lead
      ai_match_status: 'pending',       // pending | processing | matched | no_match
      matched_property_id: null,
      matched_property_title: null,
      match_score: null,
      match_reason: null,
      lead_id: null,                    // set when converted to lead
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await clients.insertOne(newClient)

    // Trigger AI Matchmaker in background (non-blocking)
    const cronSecret = process.env.CRON_SECRET
    // Use http://localhost:3000 for internal API calls to avoid SSL certificate validation errors
    const baseUrl = 'http://localhost:3000'
    fetch(`${baseUrl}/api/agent/matchmaker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}),
      },
    }).catch(() => {/* fire-and-forget */})

    return NextResponse.json({
      success: true,
      client: { ...newClient, _id: result.insertedId },
      message: 'Client added. AI Matchmaker triggered in the background.',
    })
  } catch (error) {
    console.error('[API/Clients] POST Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add client' }, { status: 500 })
  }
}
