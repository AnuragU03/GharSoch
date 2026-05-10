import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { authErrorResponse, requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireSession()
    // Phase 11.5: filter dashboard stats by session.user.brokerage_id.
    const [leads, calls, appointments, campaigns] = await Promise.all([
      getCollection('leads'),
      getCollection('calls'),
      getCollection('appointments'),
      getCollection('campaigns'),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalLeads,
      newLeadsToday,
      hotLeads,
      totalCalls,
      callsToday,
      totalAppointments,
      upcomingAppointments,
      activeCampaigns,
      totalCampaigns,
      qualifiedLeads,
      dncCount,
    ] = await Promise.all([
      leads.countDocuments({}),
      leads.countDocuments({ created_at: { $gte: today, $lt: tomorrow } }),
      leads.countDocuments({ interest_level: 'hot' }),
      calls.countDocuments({}),
      calls.countDocuments({ created_at: { $gte: today, $lt: tomorrow } }),
      appointments.countDocuments({}),
      appointments.countDocuments({ scheduled_at: { $gte: new Date() }, status: { $in: ['scheduled', 'confirmed'] } }),
      campaigns.countDocuments({ status: 'active' }),
      campaigns.countDocuments({}),
      leads.countDocuments({ qualification_status: 'qualified' }),
      leads.countDocuments({ dnd_status: true }),
    ])

    // Conversion funnel
    const contactedLeads = await leads.countDocuments({ total_calls: { $gt: 0 } })
    const appointmentLeadIds = await appointments.distinct('lead_id')
    const appointmentLeads = appointmentLeadIds.length

    // Call performance (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentCalls = await calls.find({ created_at: { $gte: sevenDaysAgo } }).toArray()

    const avgDuration = recentCalls.length > 0
      ? Math.round(recentCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / recentCalls.length)
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads,
        newLeadsToday,
        hotLeads,
        qualifiedLeads,
        totalCalls,
        callsToday,
        avgCallDuration: avgDuration,
        totalAppointments,
        upcomingAppointments,
        activeCampaigns,
        totalCampaigns,
        dncCount,
        funnel: {
          total: totalLeads,
          contacted: contactedLeads,
          qualified: qualifiedLeads,
          appointed: appointmentLeads,
        },
      },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Dashboard] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
