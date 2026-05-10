import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'

import { requireSession } from '@/lib/auth'
import { getCollection } from '@/lib/mongodb'
import { CampaignDetailSection } from '@/app/sections/CampaignDetailSection'

export const dynamic = 'force-dynamic'

interface Props {
  params: {
    id: string
  }
}

function toIso(value: unknown) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function toObjectId(value: unknown) {
  if (value instanceof ObjectId) return value
  if (typeof value === 'string' && ObjectId.isValid(value)) {
    return new ObjectId(value)
  }
  return null
}

export default async function CampaignDetailPage({ params }: Props) {
  await requireSession()

  if (!ObjectId.isValid(params.id)) {
    notFound()
  }

  const campaignId = new ObjectId(params.id)
  const campaignsCol = await getCollection('campaigns')
  const campaign = await campaignsCol.findOne({ _id: campaignId })

  if (!campaign) {
    notFound()
  }

  const targetLeadIds = Array.isArray((campaign as any).target_lead_ids)
    ? (campaign as any).target_lead_ids
    : Array.isArray((campaign as any).lead_ids)
      ? (campaign as any).lead_ids
      : []

  const leadObjectIds = targetLeadIds
    .map((id: unknown) => toObjectId(id))
    .filter((id): id is ObjectId => Boolean(id))

  const leadsCol = await getCollection('leads')
  const callsCol = await getCollection('calls')
  const runsCol = await getCollection('agent_execution_logs')
  const appointmentsCol = await getCollection('appointments')

  const [leads, calls, appointments] = await Promise.all([
    leadObjectIds.length > 0
      ? leadsCol.find({ _id: { $in: leadObjectIds } }).toArray()
      : [],
    callsCol
      .find({ campaign_id: { $in: [campaignId, params.id] } as any })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray(),
    targetLeadIds.length > 0
      ? appointmentsCol.find({ lead_id: { $in: targetLeadIds.map(String) } }).toArray()
      : [],
  ])

  const callIds = calls.map((call: any) => call.vapi_call_id).filter(Boolean)
  const recentRuns = callIds.length > 0
    ? await runsCol
        .find({
          agent_id: 'voice_orchestrator',
          $or: [
            { 'input_data.vapi_call_id': { $in: callIds } },
            { 'input_data.call_id': { $in: callIds } },
            { 'output_data.callId': { $in: callIds } },
            { 'output_data.call_id': { $in: callIds } },
            { 'output_data.vapi_call_id': { $in: callIds } },
          ],
        })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray()
    : []

  const latestCallByLead = new Map<string, any>()
  for (const call of calls) {
    const leadId = call.lead_id ? String(call.lead_id) : ''
    if (leadId && !latestCallByLead.has(leadId)) {
      latestCallByLead.set(leadId, call)
    }
  }

  const connectedCount = calls.filter((call: any) => {
    const status = String(call.call_status || call.status || '').toLowerCase()
    return status === 'completed' || status === 'connected' || Number(call.duration || 0) > 0
  }).length

  const serialized = {
    campaign: {
      ...campaign,
      _id: params.id,
      start_date: toIso((campaign as any).start_date),
      end_date: toIso((campaign as any).end_date),
      started_at: toIso((campaign as any).started_at),
      deferred_until: toIso((campaign as any).deferred_until),
      created_at: toIso((campaign as any).created_at),
      updated_at: toIso((campaign as any).updated_at),
    },
    leads: leads.map((lead: any) => {
      const leadId = String(lead._id)
      const latestCall = latestCallByLead.get(leadId)
      return {
        _id: leadId,
        name: lead.name || 'Unnamed lead',
        phone: lead.phone || '—',
        status: lead.status || 'new',
        last_call_at: toIso(latestCall?.created_at),
      }
    }),
    calls: calls.map((call: any) => ({
      ...call,
      _id: String(call._id),
      lead_id: call.lead_id ? String(call.lead_id) : null,
      campaign_id: call.campaign_id ? String(call.campaign_id) : null,
      created_at: toIso(call.created_at),
      updated_at: toIso(call.updated_at),
    })),
    recentRuns: recentRuns.map((run: any) => ({
      ...run,
      _id: String(run._id),
      started_at: toIso(run.started_at || run.created_at),
      created_at: toIso(run.created_at),
      updated_at: toIso(run.updated_at),
    })),
    stats: {
      total_contacts: leads.length,
      dialed: calls.length,
      connected: connectedCount,
      booked: appointments.length,
    },
  }

  return <CampaignDetailSection {...serialized} />
}
