import clientPromise from '@/lib/mongodb'
import { DEFAULT_LEAD } from '@/models/Lead'
import type { Lead } from '@/models/Lead'
import { ObjectId } from 'mongodb'

const DB_NAME = 'test'
const COLLECTION = 'leads'

export type LeadPipelineStage = 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'closed'

export type SerializedLead = Omit<
  Lead,
  '_id' | 'created_at' | 'updated_at' | 'last_contacted_at' | 'next_follow_up_date'
> & {
  _id: string
  created_at: string
  updated_at: string
  last_contacted_at: string | null
  next_follow_up_date: string | null
  matched_property_id?: string
  match_score?: number
  match_rationale?: string
  notes_history?: string[]
}

export type LeadPipelineStats = {
  total: number
  hot: number
  warm: number
  cold: number
  dnc: number
  conversionPct: number
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function serializeLead(lead: any): SerializedLead {
  return {
    ...lead,
    _id: String(lead._id),
    created_at: toIso(lead.created_at) || new Date().toISOString(),
    updated_at: toIso(lead.updated_at) || new Date().toISOString(),
    last_contacted_at: toIso(lead.last_contacted_at),
    next_follow_up_date: toIso(lead.next_follow_up_date),
  }
}

function byRecentTimestamp(a: any, b: any) {
  const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
  const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
  return bTime - aTime
}

function normalizeStage(lead: any): LeadPipelineStage {
  const status = String(lead.status || '').toLowerCase()

  if (status === 'contacted' || status === 'qualified' || status === 'follow_up') return 'contacted'
  if (status === 'site_visit' || status === 'site visit' || status === 'visit_scheduled') return 'site_visit'
  if (status === 'negotiation' || status === 'negotiating') return 'negotiation'
  if (status === 'closed' || status === 'won' || status === 'lost' || status === 'not_interested') return 'closed'

  return 'new'
}

async function getCollection() {
  const client = await clientPromise
  return client.db(DB_NAME).collection<Lead>(COLLECTION)
}

export const leadService = {
  async listByStage(): Promise<Record<LeadPipelineStage, SerializedLead[]>> {
    const collection = await getCollection()
    const leads = (await collection.find({ is_deleted: { $ne: true } }).toArray()).sort(byRecentTimestamp)

    const grouped: Record<LeadPipelineStage, SerializedLead[]> = {
      new: [],
      contacted: [],
      site_visit: [],
      negotiation: [],
      closed: [],
    }

    for (const lead of leads) {
      grouped[normalizeStage(lead)].push(serializeLead(lead))
    }

    return grouped
  },

  async listAll(): Promise<SerializedLead[]> {
    const collection = await getCollection()
    const leads = (await collection.find({ is_deleted: { $ne: true } }).toArray()).sort(byRecentTimestamp)
    return leads.map(serializeLead)
  },

  async getStats(): Promise<LeadPipelineStats> {
    const collection = await getCollection()
    const leads = await collection.find({ is_deleted: { $ne: true } }).toArray()
    const total = leads.length
    const hot = leads.filter((lead) => String((lead as any).interest_level || '').toLowerCase() === 'hot').length
    const warm = leads.filter((lead) => String((lead as any).interest_level || '').toLowerCase() === 'warm').length
    const cold = leads.filter((lead) => String((lead as any).interest_level || '').toLowerCase() === 'cold').length
    const dnc = leads.filter((lead) => (lead as any).dnd_status === true).length
    const converted = leads.filter((lead) => {
      const score = Number((lead as any).lead_score || 0)
      const qualification = String((lead as any).qualification_status || '').toLowerCase()
      return score > 0 || ['qualified', 'matched'].includes(qualification)
    }).length

    return {
      total,
      hot,
      warm,
      cold,
      dnc,
      conversionPct: total === 0 ? 0 : Math.round((converted / total) * 100),
    }
  },

  async moveToStage(leadId: string, newStage: LeadPipelineStage) {
    const collection = await getCollection()
    const _id = new ObjectId(leadId)
    await collection.updateOne(
      { _id },
      {
        $set: {
          status: newStage,
          updated_at: new Date(),
        },
      }
    )
  },
}

export interface CreateLeadInput {
  broker_id: string;          // REQUIRED — never optional
  name: string;
  phone: string;
  email?: string;
  location_pref?: string;
  property_type?: string;
  budget_range?: string;
  notes?: string;
  source?: string;
  client_id?: string | ObjectId;
  next_follow_up_date?: Date | string | null;
  [key: string]: any;
}

export interface CreateLeadResult {
  ok: boolean;
  lead_id?: ObjectId | string;
  lead?: any;
  reason?: "duplicate_phone" | "missing_broker_id";
  existing_lead?: any;
}

/**
 * Single source of truth for creating leads.
 * Always stamps broker_id, normalizes phone, applies defaults, sets timestamps.
 * Used by /api/leads/route.ts AND lib/agents/clientLeadConverter.ts.
 */
export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  if (!input.broker_id || typeof input.broker_id !== "string" || input.broker_id.trim() === "") {
    throw new Error("createLead: valid non-empty broker_id is required");
  }

  const leads = await getCollection();
  const normalizedPhone = (input.phone || '').replace(/[^0-9+]/g, '');
  const normalizedLocation = (input.location_pref || '').trim();

  // Dedup check (B5)
  if (normalizedPhone) {
    const existing = await leads.findOne({
      phone: normalizedPhone,
      broker_id: input.broker_id,
      is_deleted: { $ne: true }
    });
    
    if (existing) {
      return { ok: false, reason: "duplicate_phone", existing_lead: existing };
    }
  }

  const { broker_id, ...restInput } = input;

  const leadDoc = {
    ...DEFAULT_LEAD,
    ...restInput,
    phone: normalizedPhone,
    location_pref: normalizedLocation,
    next_follow_up_date: input.next_follow_up_date ? new Date(input.next_follow_up_date) : null,
    broker_id: input.broker_id,    // last to ensure it cannot be overridden
    is_deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await leads.insertOne(leadDoc as any);
  return { 
    ok: true, 
    lead_id: result.insertedId, 
    lead: { ...leadDoc, _id: result.insertedId } 
  };
}
