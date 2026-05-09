import { DashboardSection } from '@/app/sections/DashboardSection'
import { getDashboardData } from '@/lib/services/dashboardService'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const data = await getDashboardData()

  return <DashboardSection data={data} />
}
