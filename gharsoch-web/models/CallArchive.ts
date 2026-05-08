/**
 * Call Archive Model
 * Tracks archived call histories with metadata and retention info
 */

import { ObjectId } from 'mongodb'

export interface CallArchive {
  _id?: ObjectId
  archive_id: string // UUID
  call_ids: string[] // Array of call record IDs
  lead_ids: string[] // Associated lead IDs
  archive_date: string // ISO timestamp when archive was created
  date_range: {
    from: string // ISO timestamp
    to: string // ISO timestamp
  }
  archive_type: 'manual' | 'automatic'
  retention_days: number
  retention_until: string // ISO timestamp
  
  // Archive metadata
  metadata: {
    total_calls: number
    total_duration_seconds: number
    call_outcomes: Record<string, number> // count by outcome
    dispositions: Record<string, number> // count by disposition
    agent_names: string[]
    campaigns: string[]
  }
  
  // Blob storage info
  blob_info: {
    container: string
    blob_name: string
    blob_url?: string
    size_bytes: number
    encryption_enabled: boolean
  }
  
  // State history included
  state_transitions_count: number
  validation_records_count: number
  
  // Export status
  export_status: 'queued' | 'in_progress' | 'completed' | 'failed'
  exported_at?: string // ISO timestamp
  export_error?: string
  
  created_at: string
  updated_at: string
}

export const DEFAULT_CALL_ARCHIVE: Omit<CallArchive, '_id'> = {
  archive_id: '',
  call_ids: [],
  lead_ids: [],
  archive_date: new Date().toISOString(),
  date_range: {
    from: new Date().toISOString(),
    to: new Date().toISOString(),
  },
  archive_type: 'manual',
  retention_days: 365,
  retention_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  metadata: {
    total_calls: 0,
    total_duration_seconds: 0,
    call_outcomes: {},
    dispositions: {},
    agent_names: [],
    campaigns: [],
  },
  blob_info: {
    container: 'call-archives',
    blob_name: '',
    size_bytes: 0,
    encryption_enabled: true,
  },
  state_transitions_count: 0,
  validation_records_count: 0,
  export_status: 'queued',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
