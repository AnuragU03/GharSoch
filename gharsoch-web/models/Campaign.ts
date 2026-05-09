import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getCampaignCollection() {
  return await getCollection('campaigns')
}

export type CampaignStatus =
  | 'draft'
  | 'queued'
  | 'dialing'
  | 'paused'
  | 'completed'
  | 'deferred'
  | 'cancelled'
  | 'active' // legacy — kept for backward compat with existing Mongo documents

export interface Campaign {
  _id?: ObjectId
  name: string
  description: string
  script_template: string
  voice_assistant?: string

  /** Resolved lead IDs stored at creation time */
  target_lead_ids: string[]
  /** Human-readable filter string e.g. "status=warm AND budget_min>=1.2Cr" */
  target_filter?: string

  status: CampaignStatus
  assigned_agent_ids: string[]

  start_date: Date | null
  end_date: Date | null

  // counters
  calls_made: number
  calls_connected: number
  appointments_booked: number
  dnc_count?: number
  callback_count?: number

  // Phase 9.5 — Campaign Conductor tracking fields
  dialed_count?: number
  total_count?: number
  started_at?: Date
  deferred_until?: Date

  created_at: Date
  updated_at: Date
}

export const DEFAULT_CAMPAIGN: Omit<Campaign, '_id'> = {
  name: '',
  description: '',
  script_template: '',
  target_lead_ids: [],
  target_filter: '',
  status: 'draft',
  assigned_agent_ids: [],
  start_date: null,
  end_date: null,
  calls_made: 0,
  calls_connected: 0,
  appointments_booked: 0,
  dnc_count: 0,
  callback_count: 0,
  created_at: new Date(),
  updated_at: new Date(),
}
