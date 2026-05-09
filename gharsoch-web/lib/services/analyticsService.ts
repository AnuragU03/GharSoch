/**
 * Analytics Service
 * Aggregates real data from MongoDB for the analytics dashboard.
 * Phase 12 wires Vapi/OpenAI billing APIs; for now, all values are derived from existing collections.
 */

import { getCollection } from '@/lib/mongodb'

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  const raw = (num / den) * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}


export type AnalyticsRange = '7d' | '30d' | '90d'

export type AnalyticsKPIs = {
  lead_to_call_pct: number
  call_to_booking_pct: number
  booking_to_close_pct: number
  avg_response_min: number
  cost_per_lead_inr: number
  revenue_inferred_inr: number
}

export type AnalyticsFunnel = {
  clients: number
  converted_to_lead: number
  matched_to_property: number
  vapi_call_connected: number
  site_visit_booked: number
}

export type CallsPerAgentPoint = {
  date: string
  matchmaker: number
  follow_up: number
  re_engager: number
  guardian: number
  voice: number
}

export type TopPerformingAgent = {
  agent_id: string
  agent_name: string
  conversion_rate_pct: number
  cost_per_call_inr: number
  roi_multiplier: number
}

function cutoffDate(range: AnalyticsRange): Date {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }).format(d)
}

export async function getKPIs(range: AnalyticsRange = '7d'): Promise<AnalyticsKPIs> {
  try {
    const cutoff = cutoffDate(range)
    const [leadsCol, callsCol, appointmentsCol] = await Promise.all([
      getCollection('leads'),
      getCollection('calls'),
      getCollection('appointments'),
    ])

    const [totalLeads, distinctLeadsCalled, bookings, closes, totalCalls] = await Promise.all([
      leadsCol.countDocuments({ created_at: { $gte: cutoff } }),
      callsCol.distinct('lead_id', { created_at: { $gte: cutoff }, direction: 'outbound' }).then(res => res.length),
      appointmentsCol.countDocuments({ created_at: { $gte: cutoff } }),
      leadsCol.countDocuments({ status: { $in: ['closed', 'won'] }, updated_at: { $gte: cutoff } }),
      callsCol.countDocuments({ created_at: { $gte: cutoff } })
    ])

    // Avg response: time from lead creation to first call (sampled, simplified)
    const recentLeads = await leadsCol
      .find({ created_at: { $gte: cutoff }, first_contact_at: { $exists: true } })
      .project({ created_at: 1, first_contact_at: 1 })
      .limit(50)
      .toArray()

    let avgResponseMin = 0
    if (recentLeads.length > 0) {
      const diffs = recentLeads
        .map((l: any) => {
          const created = new Date(l.created_at).getTime()
          const contacted = new Date(l.first_contact_at).getTime()
          return (contacted - created) / 60000
        })
        .filter((d) => d > 0 && d < 1440) // ignore outliers > 24h
      avgResponseMin = diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 0
    }

    const lead_to_call_pct = pct(distinctLeadsCalled, totalLeads)
    const call_to_booking_pct = pct(bookings, distinctLeadsCalled)
    const booking_to_close_pct = pct(closes, bookings)

    // Phase 12: real billing. For now use flat ₹15/call estimate
    const cost_per_lead_inr = totalLeads > 0 ? Math.round((totalCalls * 15) / Math.max(totalLeads, 1)) : 0
    // Revenue inferred: bookings × avg ticket (₹80L placeholder, Phase 12 will compute from property prices)
    const revenue_inferred_inr = bookings * 8000000

    return {
      lead_to_call_pct,
      call_to_booking_pct,
      booking_to_close_pct,
      avg_response_min: avgResponseMin,
      cost_per_lead_inr,
      revenue_inferred_inr,
    }
  } catch (err) {
    console.error('[analyticsService] getKPIs error:', err)
    return {
      lead_to_call_pct: 0,
      call_to_booking_pct: 0,
      booking_to_close_pct: 0,
      avg_response_min: 0,
      cost_per_lead_inr: 0,
      revenue_inferred_inr: 0,
    }
  }
}

export async function getFunnel(range: AnalyticsRange = '7d'): Promise<AnalyticsFunnel> {
  try {
    const cutoff = cutoffDate(range)
    const [clientsCol, leadsCol, callsCol, appointmentsCol] = await Promise.all([
      getCollection('clients').catch(() => null),
      getCollection('leads'),
      getCollection('calls'),
      getCollection('appointments'),
    ])

    const [clients, leads, connected, visits, allLeads] = await Promise.all([
      clientsCol ? clientsCol.countDocuments({ created_at: { $gte: cutoff } }) : Promise.resolve(0),
      leadsCol.countDocuments({ created_at: { $gte: cutoff } }),
      callsCol.countDocuments({ created_at: { $gte: cutoff }, call_status: { $in: ['completed', 'connected'] } }),
      appointmentsCol.countDocuments({ created_at: { $gte: cutoff } }),
      leadsCol.countDocuments({ created_at: { $gte: cutoff }, matched_property_id: { $exists: true } }),
    ])

    return {
      clients,
      converted_to_lead: leads,
      matched_to_property: allLeads,
      vapi_call_connected: connected,
      site_visit_booked: visits,
    }
  } catch (err) {
    console.error('[analyticsService] getFunnel error:', err)
    return { clients: 0, converted_to_lead: 0, matched_to_property: 0, vapi_call_connected: 0, site_visit_booked: 0 }
  }
}

export async function getCallsPerAgent(range: AnalyticsRange = '7d'): Promise<CallsPerAgentPoint[]> {
  try {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const cutoff = cutoffDate(range)

    const execCollection = await getCollection('agent_execution_logs')
    const runs = await execCollection
      .find({
        $or: [{ started_at: { $gte: cutoff } }, { created_at: { $gte: cutoff } }],
        agent_id: { $in: ['matchmaker', 'follow_up_agent', 'dead_lead_reengager', 'appointment_guardian', 'voice_orchestrator'] },
      })
      .project({ agent_id: 1, started_at: 1, created_at: 1 })
      .limit(5000)
      .toArray()

    // Build day-keyed buckets
    const buckets: Record<string, Record<string, number>> = {}
    const agentKeys = ['matchmaker', 'follow_up', 're_engager', 'guardian', 'voice']

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const key = formatDateLabel(d)
      buckets[key] = { matchmaker: 0, follow_up: 0, re_engager: 0, guardian: 0, voice: 0 }
    }

    const AGENT_MAP: Record<string, string> = {
      matchmaker: 'matchmaker',
      follow_up_agent: 'follow_up',
      dead_lead_reengager: 're_engager',
      appointment_guardian: 'guardian',
      voice_orchestrator: 'voice',
    }

    for (const run of runs) {
      const ts = run.started_at || run.created_at
      if (!ts) continue
      const date = new Date(ts)
      const dayKey = formatDateLabel(date)
      if (!buckets[dayKey]) continue
      const agentKey = AGENT_MAP[run.agent_id as string]
      if (agentKey) {
        buckets[dayKey][agentKey] = (buckets[dayKey][agentKey] || 0) + 1
      }
    }

    return Object.entries(buckets).map(([date, counts]) => ({
      date,
      ...counts,
    })) as CallsPerAgentPoint[]
  } catch (err) {
    console.error('[analyticsService] getCallsPerAgent error:', err)
    return []
  }
}

export async function getTopPerformingAgent(range: AnalyticsRange = '7d'): Promise<TopPerformingAgent | null> {
  try {
    const cutoff = cutoffDate(range)
    const execCollection = await getCollection('agent_execution_logs')

    const runs = await execCollection
      .find({
        $or: [{ started_at: { $gte: cutoff } }, { created_at: { $gte: cutoff } }],
      })
      .project({ agent_id: 1, agent_name: 1, status: 1 })
      .limit(2000)
      .toArray()

    if (runs.length === 0) return null

    // Group by agent
    const agentGroups: Record<string, { name: string; total: number; success: number }> = {}
    for (const run of runs) {
      const id = String(run.agent_id || 'unknown')
      if (!agentGroups[id]) agentGroups[id] = { name: run.agent_name || id, total: 0, success: 0 }
      agentGroups[id].total += 1
      if (run.status === 'completed' || run.status === 'success') agentGroups[id].success += 1
    }

    // Find agent with highest success rate (min 3 runs)
    const best = Object.entries(agentGroups)
      .filter(([, g]) => g.total >= 3)
      .sort(([, a], [, b]) => b.success / b.total - a.success / a.total)[0]

    if (!best) return null

    const [agent_id, group] = best
    const conversion_rate_pct = Math.round((group.success / group.total) * 100)

    return {
      agent_id,
      agent_name: group.name,
      conversion_rate_pct,
      cost_per_call_inr: 15, // Phase 12: real billing
      roi_multiplier: conversion_rate_pct > 50 ? parseFloat((conversion_rate_pct / 20).toFixed(1)) : 1.0,
    }
  } catch (err) {
    console.error('[analyticsService] getTopPerformingAgent error:', err)
    return null
  }
}
