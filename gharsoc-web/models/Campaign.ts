import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getCampaignCollection() {
  return await getCollection('campaigns')
}

export interface Campaign {
  _id?: ObjectId
  name: string
  description: string
  script_template: string
  target_lead_ids: string[]
  status: string
  assigned_agent_ids: string[]
  start_date: Date | null
  end_date: Date | null
  calls_made: number
  calls_connected: number
  appointments_booked: number
  created_at: Date
  updated_at: Date
}

export const DEFAULT_CAMPAIGN: Omit<Campaign, '_id'> = {
  name: '',
  description: '',
  script_template: '',
  target_lead_ids: [],
  status: 'draft',
  assigned_agent_ids: [],
  start_date: null,
  end_date: null,
  calls_made: 0,
  calls_connected: 0,
  appointments_booked: 0,
  created_at: new Date(),
  updated_at: new Date(),
}
