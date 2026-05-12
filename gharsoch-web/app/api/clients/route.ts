import { NextRequest, NextResponse } from 'next/server'
import { clientService } from '@/lib/services/clientService'
import { runClientLeadConverter } from '@/lib/agents/clientLeadConverter'
import { runMatchmakerForLead } from '@/lib/agents/matchmaker'
import { auth, authErrorResponse, requireRole, requireSession } from '@/lib/auth'
import { requireBrokerId, BrokerScopeMissingError } from '@/lib/auth/requireBroker'

export const dynamic = 'force-dynamic'

// GET /api/clients — list all clients
export async function GET(request: NextRequest) {
  try {
    await requireSession()
    // Phase 11.5: filter clients by session.user.brokerage_id when multi-tenant lands.

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const source = searchParams.get('source') || undefined

    const data = await clientService.listClients({ status, source })
    return NextResponse.json({ success: true, clients: data })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Clients] GET Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 })
  }
}

// POST /api/clients — add a new client
export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    const session = await auth()
    
    let brokerId: string
    try {
      brokerId = requireBrokerId(session)
    } catch (e) {
      if (e instanceof BrokerScopeMissingError) {
        return NextResponse.json(
          { error: 'broker_scope_missing', message: 'Your account is not provisioned for a brokerage. Contact admin.' },
          { status: 403 }
        )
      }
      throw e
    }
    // Phase 11.5: stamp new clients with session.user.brokerage_id.

    const body = await request.json()
    const { name, phone, email, budget_range, location_pref, property_type, source, notes } = body

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 })
    }

    // Check for duplicate in DB via find() inside a custom block since we only have listClients on service
    const existingClients = await clientService.listClients({ limit: 1000 })
    if (existingClients.some(c => c.phone === phone)) {
      return NextResponse.json({ success: false, error: 'A client with this phone number already exists' }, { status: 409 })
    }

    const client = await clientService.createClient({
      name,
      phone,
      email: email || '',
      source: source || 'manual',
      budget_range: budget_range || '',
      location_pref: location_pref || '',
      property_type: property_type || '',
      notes: notes || '',
      broker_id: brokerId,
    })

    // Fire converter, but don't block the response
    queueMicrotask(async () => {
      try {
        const result = await runClientLeadConverter(client._id!.toString())
        // If conversion succeeded AND lead is hot/warm, fire Matchmaker too
        if (result.lead_id && !result.rejected) {
          // If score is >= 60, it's hot or warm based on agent logic
          if (result.score && result.score >= 60) {
            await runMatchmakerForLead(result.lead_id)
          }
        }
      } catch (e) {
        console.error('Converter pipeline failed:', e)
      }
    })

    return NextResponse.json({
      success: true,
      client_id: client._id,
      message: 'Client created. Conversion in progress.',
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Clients] POST Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add client' }, { status: 500 })
  }
}
