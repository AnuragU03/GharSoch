'use server'

import { getCollection } from '@/lib/mongodb'
import { requireRole } from '@/lib/auth'

export type CostBreakdown = {
  timeRange: string
  openAiCost: number | null
  openAiFallbackCost: number
  hasOpenAiUsageField: boolean
  vapiCost: number
  totalRuns: number
  agentBreakdown: { agentId: string; runCount: number; estCost: number }[]
  largestRun: { runId: string; agentId: string; cost: number; timestamp: string } | null
}

export async function fetchCostBreakdown(timeRange: '24h' | '7d' | '30d'): Promise<CostBreakdown> {
  await requireRole(['admin', 'tech'])

  let ms = 24 * 60 * 60 * 1000
  if (timeRange === '7d') ms = 7 * 24 * 60 * 60 * 1000
  if (timeRange === '30d') ms = 30 * 24 * 60 * 60 * 1000

  const cutoffDate = new Date(Date.now() - ms)
  const cutoff = cutoffDate.toISOString()

  const logsCollection = await getCollection('agent_execution_logs')
  const callsCollection = await getCollection('calls')

  // Fetch runs
  const runs = await logsCollection.find({
    started_at: { $gte: cutoff }
  }, {
    projection: { run_id: 1, agent_id: 1, openai_usage: 1, input_data: 1, output_data: 1, started_at: 1, created_at: 1 }
  }).toArray()

  // Find linked calls for vapi costs
  const vapiCallIds = new Set<string>()
  runs.forEach((run: any) => {
    const callId = run.input_data?.call_id || run.output_data?.callId || run.output_data?.call_id
    if (callId) vapiCallIds.add(callId)
  })

  let vapiCost = 0
  const callCostMap = new Map<string, number>()

  // Also get total calls in window for overall Vapi cost
  const callsInWindow = await callsCollection.find({
    created_at: { $gte: cutoffDate }
  }, {
    projection: { duration: 1, duration_seconds: 1, vapi_call_id: 1 }
  }).toArray()

  callsInWindow.forEach((call: any) => {
    const duration = Number(call.duration || call.duration_seconds || 0)
    if (duration > 0) {
      const cost = (duration / 60) * 0.05
      vapiCost += cost
      if (call.vapi_call_id) {
        callCostMap.set(call.vapi_call_id, cost)
      }
    }
  })

  let openAiCost: number | null = null
  let openAiFallbackCost = 0
  let hasOpenAiUsageField = false

  const agentMap = new Map<string, { runCount: number; estCost: number }>()
  let largestRun: CostBreakdown['largestRun'] = null

  runs.forEach((run: any) => {
    const agentId = run.agent_id || 'unknown_agent'
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, { runCount: 0, estCost: 0 })
    }
    const agentData = agentMap.get(agentId)!
    agentData.runCount += 1

    let runCost = 0

    if (run.openai_usage !== undefined) {
      hasOpenAiUsageField = true
      // Assumes openai_usage has total_cost or total_tokens
      const tokens = Number(run.openai_usage?.total_tokens || 0)
      const cost = Number(run.openai_usage?.total_cost || (tokens * 0.000005)) // arbitrary token price if cost not provided
      if (openAiCost === null) openAiCost = 0
      openAiCost += cost
      runCost += cost
    } else {
      openAiFallbackCost += 0.005
      runCost += 0.005
    }

    const callId = run.input_data?.call_id || run.output_data?.callId || run.output_data?.call_id
    if (callId && callCostMap.has(callId)) {
      runCost += callCostMap.get(callId)!
    }

    agentData.estCost += runCost

    if (!largestRun || runCost > largestRun.cost) {
      largestRun = {
        runId: String(run.run_id || run._id),
        agentId,
        cost: runCost,
        timestamp: run.started_at || run.created_at
      }
    }
  })

  // Phase 13: full token cost tracking once openai_usage field instrumented

  return {
    timeRange,
    openAiCost,
    openAiFallbackCost,
    hasOpenAiUsageField,
    vapiCost,
    totalRuns: runs.length,
    agentBreakdown: Array.from(agentMap.entries()).map(([agentId, data]) => ({
      agentId,
      ...data
    })).sort((a, b) => b.estCost - a.estCost),
    largestRun
  }
}
