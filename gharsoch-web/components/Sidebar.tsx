import { getSidebarCounts } from '@/lib/services/sidebarCountsService'
import { SidebarClient } from './SidebarClient'

// Set revalidate to 60 seconds so Next.js caches this page/component
export const revalidate = 60

export async function Sidebar() {
  const counts = await getSidebarCounts()
  
  return <SidebarClient counts={counts} />
}
