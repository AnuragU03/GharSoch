import { ObjectId } from 'mongodb'

import { getCollection } from '@/lib/mongodb'
import type { AgentAction, AgentExecutionTrace, ReasoningStep } from '@/lib/agentLogger'

const FOLLOW_UP_AGENT_LEGACY_ID = '69e8f709f89cad5d4b752d24'
const KNOWN_AGENT_NAMES: Record<string, string> = {
  matchmaker: 'The Matchmaker',
  follow_up_agent: 'The Follow-Up Agent',
  appointment_guardian: 'The Appointment Guardian',
  dead_lead_reengager: 'The Dead Lead Re-engager',
  price_drop_negotiator: 'The Price Drop Negotiator',
  voice_orchestrator: 'Voice Orchestrator',
}

export type AgentDashboardSummary = {
  agent_id: string
  agent_name: string
  last_run_at: string | null
  last_run_status: string | null
  runs_24h: number
  success_rate: number
  kb_hits_24h: number
  tool_calls_24h?: number
  search_props_24h?: number
  qualify_lead_24h?: number
  book_appt_24h?: number
  calls_in_flight?: number
  in_flight_runs?: VoiceInFlightRun[]
}

export type HealthStripData = {
  runs24h: number
  callsDialed: number
  openAiTokens: number
  vapiMinutes: number
  mongoWrites: number
  systemStatus: string
}

export type EnrichedMatchDetail = {
  client_id?: string
  client_name?: string
  property_id?: string
  property_title?: string
  builder_name?: string
  location?: string
  score?: number
  rationale?: string
  vapi_call_id?: string
  status?: string
}

export type AgentDashboardRun = Omit<AgentExecutionTrace, '_id'> & {
  _id?: string
  agent_id: string
  agent_name: string
  reasoning_steps: ReasoningStep[]
  actions: AgentAction[]
  reasoning_summary?: {
    summary: string
    confidence: number
    generated_at: string
  }
  summary_failed?: boolean
  summary_error?: string
  output_data?: Record<string, any> & {
    match_details?: EnrichedMatchDetail[]
  }
}

export type ActivityRunFilter =
  | 'all'
  | 'matchmaker'
  | 'follow_up_agent'
  | 'appointment_guardian'
  | 'dead_lead_reengager'
  | 'price_drop_negotiator'
  | 'voice_orchestrator'
  | 'client_lead_converter'

export type VoiceInFlightRun = {
  run_id: string
  started_at: string
  elapsed_ms: number
  call_id?: string
  webhook_type?: string
  tool_names: string[]
}

type EntityMap = Record<string, { name?: string; title?: string; builder_name?: string; location?: string }>

function canonicalizeAgentId(agentId: string | undefined | null) {
  if (!agentId) return 'unknown_agent'
  if (agentId === FOLLOW_UP_AGENT_LEGACY_ID) return 'follow_up_agent'
  return agentId
}

function canonicalizeAgentName(agentId: string, agentName?: string | null) {
  return agentName || KNOWN_AGENT_NAMES[agentId] || agentId
}

function isSuccessStatus(status: string | undefined | null) {
  return status === 'completed' || status === 'success'
}

function isFailureStatus(status: string | undefined | null) {
  return status === 'failed' || status === 'error'
}

function toObjectIds(ids: string[]) {
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function extractKbHits(run: Pick<AgentExecutionTrace, 'actions'>) {
  return run.actions.filter((action) => action.action_type.toLowerCase().includes('kb')).length
}

function extractToolDispatches(run: Pick<AgentExecutionTrace, 'actions'>) {
  return run.actions.filter((action) => action.action_type === 'tool_dispatch')
}

function extractToolDispatchCount(run: Pick<AgentExecutionTrace, 'actions'>, toolName: string) {
  return extractToolDispatches(run).filter(
    (action) => action.parameters?.tool_name === toolName
  ).length
}

function extractOpenAiTokens(run: Pick<AgentExecutionTrace, 'actions'>) {
  return run.actions.reduce((total, action) => {
    const usage = action.result?.usage
    return total + safeNumber(usage?.total_tokens)
  }, 0)
}

function extractVapiMinutes(run: Pick<AgentExecutionTrace, 'actions'>) {
  const totalSeconds = run.actions.reduce((total, action) => {
    const result = action.result || {}
    const seconds =
      safeNumber(result.duration_seconds) ||
      safeNumber(result.durationSeconds) ||
      safeNumber(result.duration) ||
      safeNumber(result.duration_sec)
    const minutes = safeNumber(result.duration_minutes) || safeNumber(result.minutes)

    if (seconds > 0) {
      return total + seconds
    }

    if (minutes > 0) {
      return total + minutes * 60
    }

    return total
  }, 0)

  return Number((totalSeconds / 60).toFixed(1))
}

function extractCallsDialed(run: Pick<AgentExecutionTrace, 'actions' | 'output_data'>) {
  const explicitCalls = safeNumber(run.output_data?.triggered_calls)
  if (explicitCalls > 0) {
    return explicitCalls
  }

  return run.actions.filter((action) => {
    const type = action.action_type.toLowerCase()
    if (!type.includes('vapi')) return false
    return Boolean(action.result?.callId || action.result?.vapi_call_id || action.parameters?.phone)
  }).length
}

function extractMongoWrites(run: Pick<AgentExecutionTrace, 'actions'>) {
  return run.actions.filter((action) => action.action_type === 'mongo_write').length
}

async function fetchEntityMap(
  collectionName: string,
  ids: string[],
  projection: Record<string, 1>
) {
  if (ids.length === 0) {
    return {} as EntityMap
  }

  const collection = await getCollection(collectionName)
  const docs = await collection.find(
    { _id: { $in: toObjectIds(ids) } },
    { projection }
  ).toArray()

  return docs.reduce<EntityMap>((acc, doc: any) => {
    acc[String(doc._id)] = {
      name: doc.name,
      title: doc.title,
      builder_name: doc.builder_name || doc.builder,
      location: doc.location || doc.location_pref,
    }
    return acc
  }, {})
}

async function enrichRuns(rawRuns: AgentExecutionTrace[]): Promise<AgentDashboardRun[]> {
  const clientIds = new Set<string>()
  const propertyIds = new Set<string>()
  const callIds = new Set<string>()

  rawRuns.forEach((run) => {
    const matchDetails = Array.isArray(run.output_data?.match_details) ? run.output_data.match_details : []
    matchDetails.forEach((detail: any) => {
      if (typeof detail.client_id === 'string') clientIds.add(detail.client_id)
      if (typeof detail.property_id === 'string') propertyIds.add(detail.property_id)
    })

    const propertyId = run.output_data?.property?.id
    if (typeof propertyId === 'string') {
      propertyIds.add(propertyId)
    }

    const callId =
      typeof run.input_data?.call_id === 'string'
        ? run.input_data.call_id
        : typeof run.output_data?.callId === 'string'
          ? run.output_data.callId
          : typeof run.output_data?.call_id === 'string'
            ? run.output_data.call_id
            : undefined
    if (callId) {
      callIds.add(callId)
    }
  })

  const [clientsMap, leadsMap, propertiesMap, callsMap] = await Promise.all([
    fetchEntityMap('clients', [...clientIds], { name: 1 }),
    fetchEntityMap('leads', [...clientIds], { name: 1 }),
    fetchEntityMap('properties', [...propertyIds], { title: 1, builder_name: 1, builder: 1, location: 1 }),
    (async () => {
      if (callIds.size === 0) {
        return {} as Record<string, any>
      }

      const calls = await getCollection('calls')
      const docs = await calls
        .find(
          { vapi_call_id: { $in: [...callIds] } },
          {
            projection: {
              vapi_call_id: 1,
              transcript: 1,
              recording_url: 1,
              duration_seconds: 1,
              ended_reason: 1,
              call_status: 1,
            },
          }
        )
        .toArray()

      return docs.reduce<Record<string, any>>((acc, doc: any) => {
        if (doc.vapi_call_id) {
          acc[String(doc.vapi_call_id)] = doc
        }
        return acc
      }, {})
    })(),
  ])

  return rawRuns.map((run) => {
    const agent_id = canonicalizeAgentId(run.agent_id)
    let output_data = run.output_data ? { ...run.output_data } : undefined

    if (Array.isArray(output_data?.match_details)) {
      output_data.match_details = output_data.match_details.map((detail: any) => {
        const client = (detail.client_id && (clientsMap[detail.client_id] || leadsMap[detail.client_id])) || {}
        const property = (detail.property_id && propertiesMap[detail.property_id]) || {}

        return {
          ...detail,
          client_name: client.name,
          property_title: property.title,
          builder_name: property.builder_name,
          location: property.location,
        }
      })
    }

    if (output_data?.property?.id && !output_data?.property?.title) {
      const property = propertiesMap[output_data.property.id]
      if (property?.title) {
        output_data.property = {
          ...output_data.property,
          title: property.title,
        }
      }
    }

    const linkedCallId =
      typeof run.input_data?.call_id === 'string'
        ? run.input_data.call_id
        : typeof output_data?.callId === 'string'
          ? output_data.callId
          : typeof output_data?.call_id === 'string'
            ? output_data.call_id
            : undefined
    const linkedCall = linkedCallId ? callsMap[linkedCallId] : null

    if (linkedCall) {
      const nextOutput = output_data || {}
      if (!nextOutput.transcript && !nextOutput.transcript_excerpt && linkedCall.transcript) {
        nextOutput.transcript_excerpt = linkedCall.transcript
      }
      if (!nextOutput.recording_url && linkedCall.recording_url) {
        nextOutput.recording_url = linkedCall.recording_url
      }
      if (!nextOutput.duration_seconds && linkedCall.duration_seconds) {
        nextOutput.duration_seconds = linkedCall.duration_seconds
      }
      if (!nextOutput.ended_reason && linkedCall.ended_reason) {
        nextOutput.ended_reason = linkedCall.ended_reason
      }
      if (!nextOutput.call_status && linkedCall.call_status) {
        nextOutput.call_status = linkedCall.call_status
      }
      output_data = nextOutput
    }

    return {
      ...run,
      _id: run._id ? String(run._id) : undefined,
      agent_id,
      agent_name: canonicalizeAgentName(agent_id, run.agent_name),
      output_data,
    }
  })
}

async function getLast24hRuns() {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const runs = await collection
    .find(
      { started_at: { $gte: cutoff } },
      {
        projection: {
          _id: 1,
          run_id: 1,
          agent_id: 1,
          agent_name: 1,
          start_time: 1,
          started_at: 1,
          end_time: 1,
          completed_at: 1,
          execution_time_ms: 1,
          status: 1,
          input_data: 1,
          reasoning_steps: 1,
          actions: 1,
          output_data: 1,
          reasoning_summary: 1,
          summary_failed: 1,
          summary_error: 1,
          errors: 1,
          metadata: 1,
          created_at: 1,
          updated_at: 1,
        },
      }
    )
    .toArray()

  return runs.sort((a, b) => new Date(b.started_at || b.created_at || 0).getTime() - new Date(a.started_at || a.created_at || 0).getTime())
}

async function getVoiceInFlightRuns(): Promise<VoiceInFlightRun[]> {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const runs = await collection
    .find(
      {
        agent_id: 'voice_orchestrator',
        status: 'started',
        started_at: { $gte: cutoff },
      },
      {
        projection: {
          run_id: 1,
          started_at: 1,
          created_at: 1,
          input_data: 1,
        },
      }
    )
    .sort({ started_at: -1 })
    .toArray()

  return runs.map((run: any) => {
    const startedAt = run.started_at || run.created_at || new Date().toISOString()
    return {
      run_id: run.run_id,
      started_at: startedAt,
      elapsed_ms: Math.max(0, Date.now() - Date.parse(startedAt)),
      call_id: run.input_data?.call_id,
      webhook_type: run.input_data?.webhook_type,
      tool_names: Array.isArray(run.input_data?.tool_names) ? run.input_data.tool_names : [],
    }
  })
}

export async function getAgentSummaries(): Promise<AgentDashboardSummary[]> {
  const [runs, voiceInFlightRuns] = await Promise.all([getLast24hRuns(), getVoiceInFlightRuns()])
  const grouped = new Map<string, AgentDashboardSummary & { successful_runs: number }>()

  runs.forEach((run) => {
    const agent_id = canonicalizeAgentId(run.agent_id)
    const existing = grouped.get(agent_id)
    const voiceMetrics = agent_id === 'voice_orchestrator'
      ? {
          tool_calls_24h: extractToolDispatches(run).length,
          search_props_24h: extractToolDispatchCount(run, 'search_properties'),
          qualify_lead_24h: extractToolDispatchCount(run, 'qualify_lead'),
          book_appt_24h: extractToolDispatchCount(run, 'book_appointment'),
        }
      : {}

    if (!existing) {
      grouped.set(agent_id, {
        agent_id,
        agent_name: canonicalizeAgentName(agent_id, run.agent_name),
        last_run_at: run.started_at || run.created_at,
        last_run_status: run.status,
        runs_24h: 1,
        success_rate: 0,
        kb_hits_24h: extractKbHits(run),
        successful_runs: isSuccessStatus(run.status) ? 1 : 0,
        ...voiceMetrics,
      })
      return
    }

    existing.runs_24h += 1
    existing.kb_hits_24h += extractKbHits(run)
    existing.successful_runs += isSuccessStatus(run.status) ? 1 : 0

    if (agent_id === 'voice_orchestrator') {
      existing.tool_calls_24h = (existing.tool_calls_24h ?? 0) + extractToolDispatches(run).length
      existing.search_props_24h = (existing.search_props_24h ?? 0) + extractToolDispatchCount(run, 'search_properties')
      existing.qualify_lead_24h = (existing.qualify_lead_24h ?? 0) + extractToolDispatchCount(run, 'qualify_lead')
      existing.book_appt_24h = (existing.book_appt_24h ?? 0) + extractToolDispatchCount(run, 'book_appointment')
    }
  })

  return [...grouped.values()].map((summary) => ({
    agent_id: summary.agent_id,
    agent_name: summary.agent_name,
    last_run_at: summary.last_run_at,
    last_run_status: summary.last_run_status,
    runs_24h: summary.runs_24h,
    success_rate: summary.runs_24h > 0 ? Math.round((summary.successful_runs / summary.runs_24h) * 100) : 0,
    kb_hits_24h: summary.kb_hits_24h,
    tool_calls_24h: summary.agent_id === 'voice_orchestrator' ? summary.tool_calls_24h ?? 0 : undefined,
    search_props_24h: summary.agent_id === 'voice_orchestrator' ? summary.search_props_24h ?? 0 : undefined,
    qualify_lead_24h: summary.agent_id === 'voice_orchestrator' ? summary.qualify_lead_24h ?? 0 : undefined,
    book_appt_24h: summary.agent_id === 'voice_orchestrator' ? summary.book_appt_24h ?? 0 : undefined,
    calls_in_flight: summary.agent_id === 'voice_orchestrator' ? voiceInFlightRuns.length : undefined,
    in_flight_runs: summary.agent_id === 'voice_orchestrator' ? voiceInFlightRuns : undefined,
  }))
}

export async function getRecentRuns(limit: number = 8): Promise<AgentDashboardRun[]> {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const runs = await collection
    .find(
      {},
      {
        projection: {
          _id: 1,
          run_id: 1,
          agent_id: 1,
          agent_name: 1,
          start_time: 1,
          started_at: 1,
          end_time: 1,
          completed_at: 1,
          execution_time_ms: 1,
          status: 1,
          input_data: 1,
          reasoning_steps: 1,
          actions: 1,
          output_data: 1,
          reasoning_summary: 1,
          summary_failed: 1,
          summary_error: 1,
          errors: 1,
          metadata: 1,
          created_at: 1,
          updated_at: 1,
        },
      }
    )
    .toArray()

  const ordered = runs
    .sort((a, b) => new Date(b.started_at || b.created_at || 0).getTime() - new Date(a.started_at || a.created_at || 0).getTime())
    .slice(0, limit)

  return enrichRuns(ordered)
}

export async function listActivityRuns(options: {
  limit?: number
  skip?: number
  agentId?: ActivityRunFilter | string
} = {}): Promise<{ runs: AgentDashboardRun[]; total: number }> {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const rawRuns = await collection.find({}).toArray()
  const normalizedAgentId =
    options.agentId && options.agentId !== 'all'
      ? canonicalizeAgentId(options.agentId)
      : null

  const filtered = rawRuns
    .map((run) => ({
      ...run,
      agent_id: canonicalizeAgentId(run.agent_id),
      agent_name: canonicalizeAgentName(canonicalizeAgentId(run.agent_id), run.agent_name),
    }))
    .filter((run) => (normalizedAgentId ? run.agent_id === normalizedAgentId : true))
    .sort((a, b) => new Date(b.started_at || b.created_at || 0).getTime() - new Date(a.started_at || a.created_at || 0).getTime())

  const total = filtered.length
  const paginated = filtered.slice(options.skip || 0, (options.skip || 0) + (options.limit || 50))
  return {
    runs: await enrichRuns(paginated),
    total,
  }
}

export async function getRunDetail(runId: string): Promise<AgentDashboardRun | null> {
  const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
  const run = await collection.findOne(
    { run_id: runId },
    {
      projection: {
        _id: 1,
        run_id: 1,
        agent_id: 1,
        agent_name: 1,
        start_time: 1,
        started_at: 1,
        end_time: 1,
        completed_at: 1,
        execution_time_ms: 1,
        status: 1,
        input_data: 1,
        reasoning_steps: 1,
        actions: 1,
        output_data: 1,
        reasoning_summary: 1,
        summary_failed: 1,
        summary_error: 1,
        errors: 1,
        metadata: 1,
        created_at: 1,
        updated_at: 1,
      },
    }
  )

  if (!run) {
    return null
  }

  const [enrichedRun] = await enrichRuns([run])
  return enrichedRun ?? null
}

export async function getHealthStrip(): Promise<HealthStripData> {
  const runs = await getLast24hRuns()

  const runs24h = runs.length
  const callsDialed = runs.reduce((total, run) => total + extractCallsDialed(run), 0)
  const openAiTokens = runs.reduce((total, run) => total + extractOpenAiTokens(run), 0)
  const vapiMinutes = Number(runs.reduce((total, run) => total + extractVapiMinutes(run), 0).toFixed(1))
  const mongoWrites = runs.reduce((total, run) => total + extractMongoWrites(run), 0)
  const systemStatus = runs24h === 0 ? 'Idle' : runs.some((run) => isFailureStatus(run.status)) ? 'Attention' : 'Healthy'

  return {
    runs24h,
    callsDialed,
    openAiTokens,
    vapiMinutes,
    mongoWrites,
    systemStatus,
  }
}
