'use client'

import { LiveActivityFeed } from '@/components/LiveActivityFeed'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'

export function AgentActivitySection({ initialRuns }: { initialRuns: AgentDashboardRun[] }) {
  return (
    <section className="page active">
      <div className="crumb">Intelligence · Agent Activity</div>
      <div className="head">
        <div>
          <h1 className="title">Agent Activity</h1>
          <p className="sub">
            Live and historical execution stream across all 5+ agents. Filter by agent, pause the stream, or drill into any run.
          </p>
        </div>
      </div>
      <LiveActivityFeed
        initialRuns={initialRuns}
        showFilterChips={true}
        showPauseButton={true}
        fullWidth={true}
      />
    </section>
  )
}

export default AgentActivitySection
