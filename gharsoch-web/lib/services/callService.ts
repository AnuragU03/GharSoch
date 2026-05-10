import clientPromise from '@/lib/mongodb'
import type { Call } from '@/models/Call'
import { ObjectId } from 'mongodb'

const DB_NAME = 'test'
const COLLECTION = 'calls'

export type SerializedCall = Omit<Call, '_id' | 'created_at' | 'updated_at' | 'follow_up_date'> & {
  _id: string
  created_at: string
  updated_at: string
  follow_up_date: string | null
}

export type CallDetail = SerializedCall & {
  linked_lead?: {
    _id: string
    name: string
    phone: string
    status?: string
    interest_level?: string
  } | null
  linked_property?: {
    _id: string
    title: string
    location?: string
    builder?: string
  } | null
  linked_run?: {
    run_id: string
    agent_id: string
    agent_name: string
    status: string
    started_at: string
    reasoning_summary?: {
      summary: string
      confidence: number
      generated_at?: string
    }
    input_data?: Record<string, any>
    output_data?: Record<string, any>
    reasoning_steps?: any[]
    actions?: any[]
  } | null
  tool_dispatches: Array<{
    run_id: string
    agent_id: string
    agent_name: string
    status: string
    started_at: string
    tool_name: string
    reasoning_summary?: {
      summary: string
      confidence: number
      generated_at?: string
    }
    input_data?: Record<string, any>
    output_data?: Record<string, any>
    reasoning_steps?: any[]
    actions?: any[]
  }>
}

export type CallStripData = {
  callsToday: number
  connected: number
  avgDuration: string
  booked: number
  dncMarked: number
  vapiMinutes: number
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function serializeCall(call: any): SerializedCall {
  return {
    ...call,
    _id: String(call._id),
    created_at: toIso(call.created_at) || new Date().toISOString(),
    updated_at: toIso(call.updated_at) || new Date().toISOString(),
    follow_up_date: toIso(call.follow_up_date),
  }
}

function byRecentTimestamp(a: any, b: any) {
  return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()
}

function isMissedCall(call: any) {
  const disposition = String(call.disposition || '').toLowerCase()
  const status = String(call.call_status || '').toLowerCase()
  return disposition === 'missed' || status === 'missed'
}

function isVoicemail(call: any) {
  const disposition = String(call.disposition || '').toLowerCase()
  const outcome = String(call.call_outcome || '').toLowerCase()
  return disposition === 'voicemail' || outcome.includes('voicemail')
}

function isConnected(call: any) {
  const status = String(call.call_status || '').toLowerCase()
  return status === 'completed' || status === 'connected'
}

async function getCollection() {
  const client = await clientPromise
  return client.db(DB_NAME).collection<Call>(COLLECTION)
}

function extractToolName(run: any) {
  const input = run.input_data || {}
  const output = run.output_data || {}
  const actions = Array.isArray(run.actions) ? run.actions : []
  const toolNames = Array.isArray(input.tool_names) ? input.tool_names.filter(Boolean) : []
  const outputTool = output.results?.[0]?.toolCallId
  const dispatched = actions.find((action: any) => action.action_type === 'tool_dispatch')
  return (
    input.tool_name ||
    input.function_name ||
    toolNames[0] ||
    dispatched?.parameters?.tool_name ||
    outputTool ||
    input.webhook_type ||
    'voice_event'
  )
}

export const callService = {
  async list(options: {
    direction?: string
    status?: string
    limit?: number
  } = {}): Promise<SerializedCall[]> {
    const collection = await getCollection()
    const calls = (await collection.find({}).toArray()).sort(byRecentTimestamp)

    const filtered = calls.filter((call: any) => {
      if (options.direction && call.direction !== options.direction) return false
      if (!options.status) return true

      if (options.status === 'missed') return isMissedCall(call)
      if (options.status === 'voicemail') return isVoicemail(call)
      if (options.status === 'connected') return isConnected(call)

      return String(call.call_status || '').toLowerCase() === options.status.toLowerCase()
    })

    return filtered.slice(0, options.limit || 50).map(serializeCall)
  },

  async get(id: string): Promise<CallDetail | null> {
    const collection = await getCollection()
    const call = await collection.findOne({ _id: new ObjectId(id) })

    if (!call) {
      return null
    }

    const client = await clientPromise
    const db = client.db(DB_NAME)
    const [lead, rawRuns, toolDispatchDocs, matchedProperty] = await Promise.all([
      call.lead_id ? db.collection('leads').findOne({ _id: new ObjectId(call.lead_id) }) : null,
      db.collection('agent_execution_logs').find({}).limit(250).toArray(),
      call.vapi_call_id
        ? db.collection('agent_execution_logs')
            .find({
              agent_id: 'voice_orchestrator',
              $or: [
                { 'input_data.vapi_call_id': call.vapi_call_id },
                { 'input_data.call_id': call.vapi_call_id },
                { 'output_data.callId': call.vapi_call_id },
                { 'output_data.call_id': call.vapi_call_id },
                { 'output_data.vapi_call_id': call.vapi_call_id },
              ],
            })
            .sort({ created_at: 1 })
            .limit(50)
            .toArray()
        : [],
      (async () => {
        if (!call.lead_id || !ObjectId.isValid(call.lead_id)) {
          return null
        }
        const matchingAppointment = await db
          .collection('appointments')
          .find({ lead_id: call.lead_id })
          .toArray()
        const appointment = matchingAppointment.sort(byRecentTimestamp)[0]
        if (!appointment?.property_id || !ObjectId.isValid(appointment.property_id)) {
          return null
        }
        return db.collection('properties').findOne({ _id: new ObjectId(appointment.property_id) })
      })(),
    ])

    const linkedRun = rawRuns
      .filter((run: any) => {
        const input = run.input_data || {}
        const output = run.output_data || {}
        const matches = Array.isArray(output.match_details) ? output.match_details : []

        return (
          input.call_id === call.vapi_call_id ||
          input.lead_id === call.lead_id ||
          output.callId === call.vapi_call_id ||
          output.call_id === call.vapi_call_id ||
          output.vapi_call_id === call.vapi_call_id ||
          matches.some((match: any) => match.vapi_call_id === call.vapi_call_id)
        )
      })
      .sort((a: any, b: any) => new Date(b.started_at || b.created_at || 0).getTime() - new Date(a.started_at || a.created_at || 0).getTime())[0]

    return {
      ...serializeCall(call),
      linked_lead: lead
        ? {
            _id: String(lead._id),
            name: lead.name || call.lead_name,
            phone: lead.phone || call.lead_phone,
            status: lead.status,
            interest_level: lead.interest_level,
          }
        : null,
      linked_property: matchedProperty
        ? {
            _id: String(matchedProperty._id),
            title: matchedProperty.title,
            location: matchedProperty.location,
            builder: matchedProperty.builder || matchedProperty.builder_name,
          }
        : null,
      linked_run: linkedRun
        ? {
            run_id: linkedRun.run_id,
            agent_id: linkedRun.agent_id,
            agent_name: linkedRun.agent_name,
            status: linkedRun.status,
            started_at: toIso(linkedRun.started_at || linkedRun.created_at) || new Date().toISOString(),
            reasoning_summary: linkedRun.reasoning_summary,
            input_data: linkedRun.input_data,
            output_data: linkedRun.output_data,
            reasoning_steps: linkedRun.reasoning_steps,
            actions: linkedRun.actions,
          }
        : null,
      tool_dispatches: toolDispatchDocs.map((run: any) => ({
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        status: run.status,
        started_at: toIso(run.started_at || run.created_at) || new Date().toISOString(),
        tool_name: extractToolName(run),
        reasoning_summary: run.reasoning_summary,
        input_data: run.input_data,
        output_data: run.output_data,
        reasoning_steps: run.reasoning_steps,
        actions: run.actions,
      })),
    }
  },

  async getStripData(): Promise<CallStripData> {
    const calls = (await (await getCollection()).find({}).toArray()).sort(byRecentTimestamp)
    const today = new Date().toDateString()
    const todaysCalls = calls.filter((call: any) => new Date(call.created_at).toDateString() === today)
    const connected = todaysCalls.filter(isConnected).length
    const booked = todaysCalls.filter((call: any) => String(call.call_outcome || '').toLowerCase().includes('book')).length
    const dncMarked = todaysCalls.filter((call: any) => {
      const disposition = String(call.disposition || '').toLowerCase()
      const summary = String(call.call_summary || '').toLowerCase()
      return disposition === 'dnd' || summary.includes('dnc')
    }).length
    const totalDuration = todaysCalls.reduce((sum: number, call: any) => sum + Number(call.duration || 0), 0)
    const avgSeconds = connected > 0 ? Math.round(totalDuration / connected) : 0

    return {
      callsToday: todaysCalls.length,
      connected,
      avgDuration: avgSeconds === 0 ? '0s' : avgSeconds < 60 ? `${avgSeconds}s` : `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`,
      booked,
      dncMarked,
      vapiMinutes: Number((totalDuration / 60).toFixed(1)),
    }
  },
}
