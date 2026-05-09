/**
 * System Config Service
 * Reads/writes system configuration from the `system_config` Mongo collection.
 * Phase 11 adds per-user config; Phase 3 uses a single global config doc.
 */

import { getCollection } from '@/lib/mongodb'

export type ConfigKey =
  | 'matchmaker_on_new_client'
  | 'price_drop_on_patch'
  | 'auto_call_hot_leads'
  | 'reasoning_summaries_enabled'
  | 'dnc_enforcement'

export type IntegrationStatus = {
  name: string
  status: 'connected' | 'error' | 'unconfigured'
  meta: string
}

export type SystemConfig = {
  matchmaker_on_new_client: boolean
  price_drop_on_patch: boolean
  auto_call_hot_leads: boolean
  reasoning_summaries_enabled: boolean
  dnc_enforcement: boolean
  trai_window_start: string // "09:00"
  trai_window_end: string   // "21:00"
  data_retention_days: number
  integrations: IntegrationStatus[]
  updated_at: string | null
}

const DEFAULTS: SystemConfig = {
  matchmaker_on_new_client: true,
  price_drop_on_patch: true,
  auto_call_hot_leads: false,
  reasoning_summaries_enabled: true,
  dnc_enforcement: true,
  trai_window_start: '09:00',
  trai_window_end: '21:00',
  data_retention_days: 90,
  integrations: [
    { name: 'Vapi (Telephony)', status: 'connected', meta: 'Outbound voice calls · Webhooks active' },
    { name: 'Twilio / Exotel', status: 'connected', meta: 'SMS fallback · Number masking' },
    { name: 'MongoDB Atlas', status: 'connected', meta: 'Primary datastore · test database' },
    { name: 'Google Calendar', status: 'unconfigured', meta: 'Appointment sync — Phase 12' },
  ],
  updated_at: null,
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const col = await getCollection('system_config')
    const doc = await col.findOne({}, { projection: { _id: 0 } })

    if (!doc) return { ...DEFAULTS }

    // Merge with defaults so new keys always exist
    return {
      ...DEFAULTS,
      ...doc,
      integrations: doc.integrations || DEFAULTS.integrations,
    } as SystemConfig
  } catch (err) {
    console.error('[systemConfigService] getSystemConfig error:', err)
    return { ...DEFAULTS }
  }
}

export async function updateSystemConfig(key: string, value: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const col = await getCollection('system_config')
    await col.updateOne(
      {},
      {
        $set: {
          [key]: value,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    )
    return { ok: true }
  } catch (err: any) {
    console.error('[systemConfigService] updateSystemConfig error:', err)
    return { ok: false, error: err.message }
  }
}
