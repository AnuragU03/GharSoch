import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getLeadCollection() {
  return await getCollection('leads')
}

export interface Lead {
  _id?: ObjectId
  broker_id: string
  name: string
  phone: string
  email: string
  source: string
  status: string
  budget_range: string
  location_pref: string
  property_type: string
  assigned_agent_id: string
  dnd_status: boolean
  place: string
  notes: string
  preferred_contact_time: string
  availability_window: string
  availability_days: string[]
  interest_level: string
  qualification_status: string
  lead_score: number
  last_contacted_at: Date | null
  next_follow_up_date: Date | null
  follow_up_count: number
  total_calls: number
  first_call_completed: boolean
  customer_requirements: string
  timeline: string
  objections: string
  followup_reason: string
  created_at: Date
  updated_at: Date
}

export const DEFAULT_LEAD: Omit<Lead, '_id' | 'broker_id'> = {
  // broker_id is stamped at create-time by leadService.createLead — never default it
  name: '',
  phone: '',
  email: '',
  source: '',
  status: 'new',
  budget_range: '',
  location_pref: '',
  property_type: '',
  assigned_agent_id: '',
  dnd_status: false,
  place: 'Mumbai',
  notes: '',
  preferred_contact_time: '',
  availability_window: '',
  availability_days: [],
  interest_level: 'unknown',
  qualification_status: 'unqualified',
  lead_score: 0,
  last_contacted_at: null,
  next_follow_up_date: null,
  follow_up_count: 0,
  total_calls: 0,
  first_call_completed: false,
  customer_requirements: '',
  timeline: '',
  objections: '',
  followup_reason: '',
  created_at: new Date(),
  updated_at: new Date(),
}
