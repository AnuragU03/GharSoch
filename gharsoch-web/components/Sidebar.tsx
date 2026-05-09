import { auth } from '@/lib/auth'
import { getSidebarCounts } from '@/lib/services/sidebarCountsService'
import { SidebarClient } from './SidebarClient'

export async function Sidebar() {
  const [counts, session] = await Promise.all([
    getSidebarCounts(),
    auth(),
  ])

  const user = session?.user ?? null

  return <SidebarClient counts={counts} user={user} />
}
