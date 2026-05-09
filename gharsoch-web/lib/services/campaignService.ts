import clientPromise from '@/lib/mongodb'
import type { Campaign, CampaignStatus } from '@/models/Campaign'
import { ObjectId } from 'mongodb'
import { runCampaignConductor } from '@/lib/agents/campaignConductor'

const DB_NAME = 'test'
const COLLECTION = 'campaigns'

export type SerializedCampaign = Omit<
  Campaign,
  '_id' | 'created_at' | 'updated_at' | 'start_date' | 'end_date' | 'started_at' | 'deferred_until'
> & {
  _id: string
  created_at: string
  updated_at: string
  start_date: string | null
  end_date: string | null
  started_at: string | null
  deferred_until: string | null
}

export type CampaignInput = {
  name: string
  description: string
  voice_assistant: string
  script_template: string
  start_date?: string | null
  end_date?: string | null
  target_filter?: string
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function serializeCampaign(campaign: any): SerializedCampaign {
  return {
    ...campaign,
    _id: String(campaign._id),
    created_at: toIso(campaign.created_at) || new Date().toISOString(),
    updated_at: toIso(campaign.updated_at) || new Date().toISOString(),
    start_date: toIso(campaign.start_date),
    end_date: toIso(campaign.end_date),
    started_at: toIso(campaign.started_at),
    deferred_until: toIso(campaign.deferred_until),
  }
}

function byRecentTimestamp(a: any, b: any) {
  const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
  const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
  return bTime - aTime
}

async function getCollection() {
  const client = await clientPromise
  return client.db(DB_NAME).collection<Campaign>(COLLECTION)
}

async function resolveTargetLeadIds(targetFilter?: string) {
  if (!targetFilter) return []

  const client = await clientPromise
  const leads = client.db(DB_NAME).collection('leads')
  const regex = { $regex: targetFilter, $options: 'i' }
  const matches = await leads
    .find({
      $or: [
        { name: regex },
        { place: regex },
        { location_pref: regex },
        { property_type: regex },
        { budget_range: regex },
        { status: regex },
      ],
      dnd_status: { $ne: true },
    })
    .limit(100)
    .toArray()

  return matches.map((lead) => String(lead._id))
}

export const campaignService = {
  async listActive(): Promise<SerializedCampaign[]> {
    const collection = await getCollection()
    const statuses: CampaignStatus[] = ['active', 'queued', 'paused', 'dialing', 'deferred']
    const campaigns = (await collection
      .find({ status: { $in: statuses } })
      .toArray()).sort(byRecentTimestamp)
    return campaigns.map(serializeCampaign)
  },

  async listDrafts(): Promise<SerializedCampaign[]> {
    const collection = await getCollection()
    const campaigns = (
      await collection.find({ status: 'draft' }).toArray()
    ).sort(byRecentTimestamp)
    return campaigns.map(serializeCampaign)
  },

  async listCompleted(): Promise<SerializedCampaign[]> {
    const collection = await getCollection()
    const statuses: CampaignStatus[] = ['completed', 'cancelled']
    const campaigns = (await collection
      .find({ status: { $in: statuses } })
      .toArray()).sort(byRecentTimestamp)
    return campaigns.map(serializeCampaign)
  },

  async create(input: CampaignInput) {
    const collection = await getCollection()
    const now = new Date()
    const targetLeadIds = await resolveTargetLeadIds(input.target_filter)

    const document: any = {
      name: input.name,
      description: input.description,
      voice_assistant: input.voice_assistant,
      script_template: input.script_template,
      target_filter: input.target_filter || '',
      target_lead_ids: targetLeadIds,
      status: 'draft',
      assigned_agent_ids: [],
      start_date: input.start_date ? new Date(input.start_date) : null,
      end_date: input.end_date ? new Date(input.end_date) : null,
      calls_made: 0,
      calls_connected: 0,
      appointments_booked: 0,
      dnc_count: 0,
      callback_count: 0,
      created_at: now,
      updated_at: now,
    }

    const result = await collection.insertOne(document)
    return serializeCampaign({ ...document, _id: result.insertedId })
  },

  async launch(id: string) {
    const collection = await getCollection()
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'queued', updated_at: new Date() } }
    )
    // Fire-and-forget: Conductor runs async, HTTP response returns immediately.
    // runAgent catches all errors internally — no unhandled rejection.
    queueMicrotask(() => {
      void runCampaignConductor(id).catch((err) => {
        console.error('[campaignService.launch] Conductor error for campaign', id, err)
      })
    })
  },

  async pause(id: string) {
    const collection = await getCollection()
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'paused', updated_at: new Date() } }
    )
    // Conductor checks campaign.status before each dial batch.
    // A running batch will finish its current lead; the next sweep
    // will see 'paused' and abort — acceptable for Phase 9.5.
  },

  async resume(id: string) {
    const collection = await getCollection()
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'queued', updated_at: new Date() } }
    )
    // Re-fire Conductor for the resumed campaign.
    queueMicrotask(() => {
      void runCampaignConductor(id).catch((err) => {
        console.error('[campaignService.resume] Conductor error for campaign', id, err)
      })
    })
  },
}
