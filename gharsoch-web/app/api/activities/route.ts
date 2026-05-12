import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { authErrorResponse, requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireSession()
    // Phase 11.5: filter activities by session.user.brokerage_id.
    const [leads, calls, appointments, campaigns] = await Promise.all([
      getCollection('leads'),
      getCollection('calls'),
      getCollection('appointments'),
      getCollection('campaigns'),
    ])

    const activities: any[] = []

    // Recent leads (last 20)
    const recentLeads = await leads.find({ is_deleted: { $ne: true } }).sort({ created_at: -1 }).limit(20).toArray()
    for (const lead of recentLeads) {
      activities.push({
        type: 'lead_created',
        title: `New lead: ${lead.name}`,
        detail: `${lead.source || 'Direct'} • ${lead.phone}`,
        timestamp: lead.created_at,
        icon: 'user',
      })
    }

    // Recent calls (last 20)
    const recentCalls = await calls.find({}).sort({ created_at: -1 }).limit(20).toArray()
    for (const call of recentCalls) {
      activities.push({
        type: call.direction === 'inbound' ? 'call_inbound' : 'call_outbound',
        title: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call: ${call.lead_name || call.lead_phone}`,
        detail: `${call.duration}s • ${call.disposition || call.call_outcome || 'Completed'}`,
        timestamp: call.created_at,
        icon: 'phone',
      })
    }

    // Recent appointments (last 10)
    const recentAppointments = await appointments.find({ is_deleted: { $ne: true } }).sort({ created_at: -1 }).limit(10).toArray()
    for (const appt of recentAppointments) {
      activities.push({
        type: 'appointment',
        title: `Appointment: ${appt.lead_name || 'Lead'}`,
        detail: `${appt.property_title || 'Property'} • ${appt.status}`,
        timestamp: appt.created_at,
        icon: 'calendar',
      })
    }

    // Sort all activities by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ success: true, activities: activities.slice(0, 30) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Activities] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
