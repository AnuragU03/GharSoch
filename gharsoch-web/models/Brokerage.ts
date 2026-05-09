import { ObjectId } from 'mongodb'

export interface Brokerage {
  _id?: ObjectId
  name: string
  city: string
  /** One of VAPI_ASSISTANT_OUTBOUND_ID | VAPI_ASSISTANT_INBOUND_ID | VAPI_ASSISTANT_REMINDER_ID */
  vapi_assistant_id: string
  primary_admin_email: string
  created_at: Date
  notes?: string
}
