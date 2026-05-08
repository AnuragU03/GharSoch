import { getCollection } from '@/lib/mongodb'

export default async function getSystemConfigModel() {
  return await getCollection('system_config')
}

export interface SystemConfig {
  config_key: string
  config_value: string
  updated_by?: string
  updated_at?: string
}
