'use server'

import { updateSystemConfig } from '@/lib/services/systemConfigService'

export async function updateSettingAction(key: string, value: boolean | string | number) {
  const result = await updateSystemConfig(key, value)
  if (!result.ok) {
    throw new Error(result.error || 'Failed to save setting')
  }
  return { ok: true }
}
