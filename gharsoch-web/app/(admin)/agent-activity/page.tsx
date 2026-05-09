import { getRecentRuns } from '@/lib/services/agentDashboardService'
import { AgentActivitySection } from '@/app/sections/AgentActivitySection'

export const dynamic = 'force-dynamic'

export default async function AgentActivityPage() {
  const recentRuns = await getRecentRuns(50)
  return <AgentActivitySection initialRuns={recentRuns} />
}
