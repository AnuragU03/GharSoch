import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getAppointmentCollection() {
  return await getCollection('appointments')
}

export interface Appointment {
  _id?: ObjectId
  lead_id: string
  property_id: string
  agent_id: string
  scheduled_at: Date
  status: string
  reminder_sent: boolean
  notes: string
  lead_name: string
  lead_phone: string
  property_title: string
  property_location: string
  created_at: Date
  updated_at: Date
}

export const DEFAULT_APPOINTMENT: Omit<Appointment, '_id'> = {
  lead_id: '',
  property_id: '',
  agent_id: '',
  scheduled_at: new Date(),
  status: 'scheduled',
  reminder_sent: false,
  notes: '',
  lead_name: '',
  lead_phone: '',
  property_title: '',
  property_location: '',
  created_at: new Date(),
  updated_at: new Date(),
}
