import { getCollection } from '@/lib/mongodb'

export default async function getScheduledMeetingModel() {
  return await getCollection('scheduled_meetings')
}

export interface ScheduledMeeting {
  id: string
  client_id: string
  agent_id: string
  datetime: string
  property_address: string
  meeting_type: string
  status: 'scheduled' | 'cancelled' | 'completed'
  created_at: string
}
