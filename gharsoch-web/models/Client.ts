import { ObjectId } from "mongodb";

export interface Client {
  _id?: ObjectId;
  name: string;
  phone: string;
  email?: string;
  source: 'web_form' | 'csv_upload' | 'manual' | 'referral';
  property_type?: '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'Villa' | string;
  budget_range?: string;
  location_pref?: string;
  notes?: string;
  conversion_status: 'pending' | 'converting' | 'converted' | 'rejected';
  conversion_reason?: string;
  lead_id?: ObjectId;
  lead_score?: number;
  created_at: Date;
  updated_at: Date;
}
