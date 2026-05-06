/**
 * Lead State History Model
 * Tracks all state transitions for leads, triggered by calls and agent actions
 */

import { ObjectId } from 'mongodb'

export interface LeadStateTransition {
  _id?: ObjectId
  lead_id: string
  previous_state: {
    status: string
    qualification_status?: string
    interest_level?: string
    follow_up_required?: boolean
  }
  new_state: {
    status: string
    qualification_status?: string
    interest_level?: string
    follow_up_required?: boolean
  }
  trigger: {
    type: 'call_sync' | 'agent_action' | 'manual_update' | 'cron_job'
    agent_name?: string
    call_id?: string
    cron_job_name?: string
  }
  validation: {
    validator_agent_run_id?: string
    status: 'valid' | 'conflict' | 'needs_review'
    issues?: string[]
    corrections_applied?: Record<string, any>
  }
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export const DEFAULT_LEAD_STATE_TRANSITION: Omit<LeadStateTransition, '_id'> = {
  lead_id: '',
  previous_state: { status: '' },
  new_state: { status: '' },
  trigger: { type: 'manual_update' },
  validation: { status: 'valid' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
