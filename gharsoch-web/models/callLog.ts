import { getCollection } from '@/lib/mongodb'

export default async function getCallLogModel() {
  return await getCollection('call_logs')
}

export interface CallLog {
  id: string
  client_id: string
  direction: 'inbound' | 'outbound'
  duration: number
  timestamp: string
  sentiment_score: number
  objection_types: string[]
  affordability_signal: string
  financial_discussed: boolean
  transcript_summary: string
  agent_assigned: string
  escalation_triggered: boolean
}
