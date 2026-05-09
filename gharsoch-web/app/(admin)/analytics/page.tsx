import { getKPIs, getFunnel, getCallsPerAgent, getTopPerformingAgent } from '@/lib/services/analyticsService'
import { AnalyticsSection } from '@/app/sections/AnalyticsSection'
import type { AnalyticsRange } from '@/lib/services/analyticsService'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string }
}) {
  const range = (['7d', '30d', '90d'].includes(searchParams.range || '') ? searchParams.range : '7d') as AnalyticsRange

  const [kpis, funnel, callsPerAgent, topAgent] = await Promise.all([
    getKPIs(range),
    getFunnel(range),
    getCallsPerAgent(range),
    getTopPerformingAgent(range),
  ])

  return (
    <AnalyticsSection
      range={range}
      kpis={kpis}
      funnel={funnel}
      callsPerAgent={callsPerAgent}
      topAgent={topAgent}
    />
  )
}
