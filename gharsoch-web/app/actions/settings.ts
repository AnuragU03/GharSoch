'use server'

import { updateSystemConfig } from '@/lib/services/systemConfigService'
import { requireRole } from '@/lib/auth'

export async function updateSettingAction(key: string, value: boolean | string | number) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: decide whether system_config remains global or becomes brokerage-scoped.
  const result = await updateSystemConfig(key, value)
  if (!result.ok) {
    throw new Error(result.error || 'Failed to save setting')
  }
  return { ok: true }
}
