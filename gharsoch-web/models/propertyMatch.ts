import { getCollection } from '@/lib/mongodb'

export default async function getPropertyMatchModel() {
  return await getCollection('property_matches')
}

export interface PropertyMatch {
  id: string
  client_id: string
  property_id: string
  match_score: number
  match_criteria: string[]
  alert_sent: boolean
  broker_approved: boolean
  created_at: string
}
