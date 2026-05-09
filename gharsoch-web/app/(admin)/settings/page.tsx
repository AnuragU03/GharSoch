import { getSystemConfig } from '@/lib/services/systemConfigService'
import { SettingsSection } from '@/app/sections/SettingsSection'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = await getSystemConfig()
  return <SettingsSection config={config} />
}
