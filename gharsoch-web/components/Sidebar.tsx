import { auth } from '@/lib/auth'
import { getSidebarCounts } from '@/lib/services/sidebarCountsService'
import { SidebarClient } from './SidebarClient'
import { VISIBILITY, type Role } from '@/lib/auth/roles'

export async function Sidebar() {
  const [counts, session] = await Promise.all([
    getSidebarCounts(),
    auth(),
  ])

  const user = session?.user ?? null
  const rawRole = user?.role as Role | undefined
  const role = rawRole && rawRole in VISIBILITY ? rawRole : null
  const allowedNav = role ? VISIBILITY[role].nav : []

  return <SidebarClient counts={counts} user={user} role={role} allowedNav={allowedNav} />
}
