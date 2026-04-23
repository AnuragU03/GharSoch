import { getCollection } from '@/lib/mongodb'

export default async function getClientProfileModel() {
  return await getCollection('client_profiles')
}

export interface ClientProfile {
  id: string
  name: string
  phone: string
  email: string
  budget: number
  timeline: string
  location_prefs: string[]
  property_type: string
  monthly_income: number
  additional_income_sources: { type: string; amount: number }[]
  existing_emis: number
  rent: number
  household_expenses: number
  other_commitments: number
  down_payment_capacity: number
  lead_temperature: 'Hot' | 'Warm' | 'Cold'
  tc_consent: boolean
  tc_consent_date: string
  do_not_call: boolean
}
