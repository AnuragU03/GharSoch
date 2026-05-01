import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getCallCollection() {
  return await getCollection('calls')
}

export interface Call {
  _id?: ObjectId
  lead_id: string
  lead_name: string
  lead_phone: string
  agent_name: string
  agent_id: string
  campaign_id: string
  direction: string
  call_type: string
  duration: number
  disposition: string
  call_outcome: string
  call_summary: string
  customer_availability: string
  preferred_callback_time: string
  preferred_callback_days: string[]
  customer_interest_level: string
  follow_up_required: boolean
  follow_up_date: Date | null
  follow_up_notes: string
  key_requirements: string
  customer_objections: string
  next_steps: string
  recording_url: string
  transcript: string
  trai_compliant: boolean
  call_status: string
  vapi_call_id: string
  created_at: Date
  updated_at: Date
}

export const DEFAULT_CALL: Omit<Call, '_id'> = {
  lead_id: '',
  lead_name: '',
  lead_phone: '',
  agent_name: '',
  agent_id: '',
  campaign_id: '',
  direction: 'outbound',
  call_type: 'outbound',
  duration: 0,
  disposition: '',
  call_outcome: '',
  call_summary: '',
  customer_availability: '',
  preferred_callback_time: '',
  preferred_callback_days: [],
  customer_interest_level: '',
  follow_up_required: false,
  follow_up_date: null,
  follow_up_notes: '',
  key_requirements: '',
  customer_objections: '',
  next_steps: '',
  recording_url: '',
  transcript: '',
  trai_compliant: true,
  call_status: 'completed',
  vapi_call_id: '',
  created_at: new Date(),
  updated_at: new Date(),
}
