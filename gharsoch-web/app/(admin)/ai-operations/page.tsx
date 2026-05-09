import { Suspense } from 'react'

import { AIOperationsSection } from '@/app/sections/AIOperationsSection'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getAgentSummaries,
  getHealthStrip,
  getRecentRuns,
} from '@/lib/services/agentDashboardService'

export const dynamic = 'force-dynamic'

function AIOperationsSkeleton() {
  return (
    <section className="page active">
      <div className="crumb">Intelligence · AI Operations</div>
      <div className="head">
        <div>
          <Skeleton className="mb-3 h-8 w-56" />
          <Skeleton className="h-4 w-[32rem]" />
        </div>
      </div>
      <Skeleton className="mb-6 h-28 w-full rounded-[12px]" />
      <div className="agents">
        {[0, 1, 2].map((card) => (
          <Skeleton className="h-72 w-full rounded-[16px]" key={card} />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-[16px]" />
    </section>
  )
}

async function AIOperationsPageContent() {
  const [summaries, health, recentRuns] = await Promise.all([
    getAgentSummaries(),
    getHealthStrip(),
    getRecentRuns(20),
  ])

  return (
    <AIOperationsSection
      summaries={summaries}
      health={health}
      recentRuns={recentRuns}
      showVoiceOrchestrator={
        process.env.NEXT_PUBLIC_ENABLE_VOICE_ORCHESTRATOR === 'true' ||
        summaries.some((summary) => summary.agent_id === 'voice_orchestrator')
      }
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<AIOperationsSkeleton />}>
      <AIOperationsPageContent />
    </Suspense>
  )
}
