import type { HealthStripData } from '@/lib/services/agentDashboardService'

type StatCell = {
  label: string
  value: string
  delta?: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value)
}

function buildCells(health: HealthStripData): StatCell[] {
  return [
    { label: 'Runs 24h', value: formatNumber(health.runs24h), delta: 'From agent_execution_logs' },
    { label: 'Calls dialed', value: formatNumber(health.callsDialed), delta: 'Triggered in the last 24h' },
    { label: 'OpenAI tokens', value: formatNumber(health.openAiTokens), delta: 'Summed from openai_result usage' },
    { label: 'Vapi minutes', value: formatNumber(health.vapiMinutes), delta: 'Call duration recorded in logs' },
    { label: 'Mongo writes', value: formatNumber(health.mongoWrites), delta: 'Write actions traced by agents' },
    { label: 'System status', value: health.systemStatus, delta: 'Derived from recent run states' },
  ]
}

export function StatStrip({
  health,
  cells,
}: {
  health?: HealthStripData
  cells?: StatCell[]
}) {
  const resolvedCells = cells || (health ? buildCells(health) : [])

  return (
    <div className="strip">
      {resolvedCells.map((cell) => (
        <div className="stat" key={cell.label}>
          <div className="stat-label">{cell.label}</div>
          <div className="stat-value">{cell.value}</div>
          {cell.delta ? <div className="stat-delta">{cell.delta}</div> : null}
        </div>
      ))}
    </div>
  )
}
