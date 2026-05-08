import { getCollection } from '@/lib/mongodb'

export default async function getPropertyAssessmentModel() {
  return await getCollection('property_assessments')
}

export interface PropertyAssessment {
  id: string
  client_id: string
  property_name: string
  builder_name?: string
  cost_mode: 'lump_sum' | 'itemised'
  base_price: number
  parking?: number
  club?: number
  plc?: number
  other_charges?: number
  gst_pct: number
  stamp_duty_pct: number
  registration: number
  total_cost: number
  property_type: 'UC' | 'RTM'
  possession_date: string
  funding_method: string
  loan_amount: number
  interest_rate: number
  tenure: number
  emi_type: 'Pre-EMI' | 'Full EMI'
  emi_amount: number
  tranches: string // JSON string for now
  affordability_signal: 'Go' | 'Reconsider' | 'No-Go'
  excess_ratio: number
  recommendations: string
  report_paid: boolean
  created_at: string
}
