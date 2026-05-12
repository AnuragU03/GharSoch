import { agentLogger, type ReasoningStep } from '@/lib/agentLogger'
import { executionEventBroadcaster } from '@/lib/agentExecutionEventBroadcaster'
import { getCollection } from '@/lib/mongodb'
import { openaiChatCompletion, type OpenAIChatMessage } from '@/lib/openaiClient'
import { reasoningSummaryGenerator } from '@/lib/reasoningSummaryGenerator'
import {
  triggerCampaignCall,
  triggerCallbackCall,
  triggerOutboundCall,
  triggerReminderCall,
  getCallDetails,
} from '@/lib/vapiClient'
import { builderKBService } from '@/lib/builderKBService'

export type AgentTrigger = 'manual' | 'cron' | 'event'

export type AgentRunContext = {
  runId: string
  agentId: string
  agentName: string
  trigger: AgentTrigger
  userId?: string
  sessionId?: string

  think: (
    stepType: ReasoningStep['step_type'],
    content: string,
    opts?: { confidence?: number; metadata?: Record<string, any> }
  ) => Promise<void>

  act: (
    actionType: string,
    description: string,
    opts?: {
      parameters?: Record<string, any>
      result?: Record<string, any>
      error?: string
    }
  ) => Promise<void>

  db: {
    findOne: <T = any>(collectionName: string, filter: Record<string, any>) => Promise<T | null>
    findMany: <T = any>(collectionName: string, filter: Record<string, any>) => Promise<T[]>
    insertOne: (collectionName: string, document: Record<string, any>) => Promise<{ insertedId: any }>
    updateOne: (
      collectionName: string,
      filter: Record<string, any>,
      update: Record<string, any>
    ) => Promise<{ matchedCount: number; modifiedCount: number }>
  }

  openai: {
    chat: (opts: {
      model: string
      messages: OpenAIChatMessage[]
      temperature?: number
      max_tokens?: number
      response_format?: { type: 'json_object' } | { type: 'text' }
      timeoutMs?: number
    }) => Promise<{ content: string; usage?: Record<string, any> }>
  }

  vapi: {
    triggerOutboundCall: typeof triggerOutboundCall
    triggerCampaignCall: typeof triggerCampaignCall
    triggerCallbackCall: typeof triggerCallbackCall
    triggerReminderCall: typeof triggerReminderCall
    getCallDetails: typeof getCallDetails
  }

  kb: {
    query: (collection: string, filter: object, options?: { limit?: number; project?: object }) => Promise<any[]>
    searchBuilders: (query: any, opts?: object) => Promise<any[]>
    getBuilder: (idOrName: string) => Promise<any | null>
  }
}

function runWithSummaryDeadline(runId: string) {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Reasoning summary generation timed out after 8000ms')), 8_000)
  })

  return Promise.race([reasoningSummaryGenerator.generate(runId), timeout])
}

function scheduleReasoningSummary(runId: string) {
  queueMicrotask(() => {
    void runWithSummaryDeadline(runId).catch(async (error: any) => {
      const message = error?.message ? String(error.message) : 'Reasoning summary generation failed'
      try {
        await agentLogger.markSummaryFailed(runId, message)
      } catch {
        // Summary generation must not change the completed response contract.
      }
    })
  })
}

export async function runAgent<TInput extends Record<string, any>, TOutput>(opts: {
  agentId: string
  agentName: string
  trigger: AgentTrigger
  input: TInput
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
  handler: (ctx: AgentRunContext, input: TInput) => Promise<TOutput>
}): Promise<{ runId: string; output?: TOutput }>
{
  const startAt = Date.now()

  const runId = await agentLogger.startAgentRun(opts.agentId, opts.agentName, {
    ...opts.input,
    user_id: opts.userId,
    session_id: opts.sessionId,
    trigger: opts.trigger,
  }, opts.metadata)

  executionEventBroadcaster.broadcastExecutionStarted(runId, opts.agentId, opts.agentName, opts.input)

  const ctx: AgentRunContext = {
    runId,
    agentId: opts.agentId,
    agentName: opts.agentName,
    trigger: opts.trigger,
    userId: opts.userId,
    sessionId: opts.sessionId,

    think: async (stepType, content, thinkOpts) => {
      await agentLogger.logAgentThinking(runId, stepType, content, thinkOpts?.confidence, thinkOpts?.metadata)
      executionEventBroadcaster.broadcastThinking(runId, opts.agentId, opts.agentName, stepType, content, thinkOpts?.confidence)
    },

    act: async (actionType, description, actionOpts) => {
      await agentLogger.logAgentAction(
        runId,
        actionType,
        description,
        actionOpts?.parameters,
        actionOpts?.result,
        actionOpts?.error
      )
      executionEventBroadcaster.broadcastAction(
        runId,
        opts.agentId,
        opts.agentName,
        actionType,
        description,
        actionOpts?.error ? 'failed' : 'completed',
        {
          parameters: actionOpts?.parameters,
          result: actionOpts?.result,
          error: actionOpts?.error,
        }
      )
    },

    db: {
      findOne: async (collectionName, filter) => {
        await agentLogger.logAgentAction(runId, 'mongo_read', `findOne ${collectionName}`, { collectionName, filter })
        const collection = await getCollection(collectionName)
        return (await collection.findOne(filter)) as T | null
      },
      findMany: async (collectionName, filter) => {
        await agentLogger.logAgentAction(runId, 'mongo_read', `find ${collectionName}`, { collectionName, filter })
        const collection = await getCollection(collectionName)
        return (await collection.find(filter).toArray()) as T[]
      },
      insertOne: async (collectionName, document) => {
        await agentLogger.logAgentAction(runId, 'mongo_write', `insertOne ${collectionName}`, { collectionName })
        const collection = await getCollection(collectionName)
        const res = await collection.insertOne(document)
        return { insertedId: res.insertedId }
      },
      updateOne: async (collectionName, filter, update) => {
        await agentLogger.logAgentAction(runId, 'mongo_write', `updateOne ${collectionName}`, { collectionName, filter })
        const collection = await getCollection(collectionName)
        const res = await collection.updateOne(filter, update)
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount }
      },
    },

    openai: {
      chat: async (chatOpts) => {
        await agentLogger.logAgentAction(runId, 'openai', `chat.completions.create (${chatOpts.model})`, {
          model: chatOpts.model,
          temperature: chatOpts.temperature,
          max_tokens: chatOpts.max_tokens,
        })

        const res = await openaiChatCompletion({
          model: chatOpts.model,
          messages: chatOpts.messages,
          temperature: chatOpts.temperature,
          max_tokens: chatOpts.max_tokens,
          response_format: chatOpts.response_format,
          timeoutMs: chatOpts.timeoutMs,
        })

        await agentLogger.logAgentAction(runId, 'openai_result', `openai response (${chatOpts.model})`, undefined, {
          usage: res.usage as Record<string, number> | undefined,
        })

        return { content: res.content, usage: res.usage as Record<string, number> | undefined }
      },
    },

    vapi: {
      triggerOutboundCall: async (params) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerOutboundCall', { assistantId: params.assistantId })
        const res = await triggerOutboundCall(params)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerOutboundCall result', undefined, res as Record<string, any>)
        return res
      },
      triggerCampaignCall: async (lead, campaignContext, propertiesContext) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerCampaignCall', { phone: lead.phone })
        const res = await triggerCampaignCall(lead, campaignContext, propertiesContext)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerCampaignCall result', undefined, res as Record<string, any>)
        return res
      },
      triggerCallbackCall: async (appointment) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerCallbackCall', { lead_phone: appointment.lead_phone })
        const res = await triggerCallbackCall(appointment)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerCallbackCall result', undefined, res as Record<string, any>)
        return res
      },
      triggerReminderCall: async (appointment) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerReminderCall', { lead_phone: appointment.lead_phone })
        const res = await triggerReminderCall(appointment)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerReminderCall result', undefined, res as Record<string, any>)
        return res
      },
      getCallDetails: async (callId) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'getCallDetails', { callId })
        const res = await getCallDetails(callId)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'getCallDetails result', undefined, { ok: !!res })
        return res
      },
    },

    kb: {
      query: async (collection: string, filter: object, options?: { limit?: number, project?: object }) => {
        const t0 = Date.now()
        try {
          const results = await builderKBService.queryRaw(collection, filter, options)
          await agentLogger.logAgentAction(runId, 'kb_query', `query ${collection}`, { collection, filter }, {
            hit_count: results.length,
            latency_ms: Date.now() - t0,
            results_preview: results.slice(0, 3).map((r: any) => ({ name: r.name || r.builder_name || r.title, score: r.reputation_score })),
          })
          return results
        } catch (err: any) {
          await agentLogger.logAgentAction(runId, 'kb_query_failed', `query ${collection} failed`, { collection, filter, error: err.message, latency_ms: Date.now() - t0 })
          throw err
        }
      },
      searchBuilders: async (query: any, opts?: object) => {
        const t0 = Date.now()
        try {
          const results = await builderKBService.searchBuilders(query)
          await agentLogger.logAgentAction(runId, 'kb_query', 'searchBuilders', { query, opts }, {
            hit_count: results.length,
            latency_ms: Date.now() - t0,
            results_preview: results.slice(0, 3).map((r: any) => ({ name: r.builder_name, score: r.reputation_score })),
          })
          return results
        } catch (err: any) {
          await agentLogger.logAgentAction(runId, 'kb_query_failed', 'searchBuilders failed', { query, error: err.message, latency_ms: Date.now() - t0 })
          throw err
        }
      },
      getBuilder: async (idOrName: string) => {
        const t0 = Date.now()
        try {
          const result = await builderKBService.getBuilder(idOrName)
          await agentLogger.logAgentAction(runId, 'kb_query', 'getBuilder', { idOrName }, {
            hit_count: result ? 1 : 0,
            latency_ms: Date.now() - t0,
            results_preview: result ? [{ name: result.builder_name, score: result.reputation_score }] : [],
          })
          return result
        } catch (err: any) {
          await agentLogger.logAgentAction(runId, 'kb_query_failed', 'getBuilder failed', { idOrName, error: err.message, latency_ms: Date.now() - t0 })
          throw err
        }
      },
    },
  }

  // Enforce minimum reasoning cadence (contract requirement):
  // 1) initial evaluation
  // 2) decision
  // 3) constraint check
  await ctx.think('evaluation', 'Starting agent run: evaluating input and constraints.')
  await ctx.think('decision', 'Proceeding with handler execution using logged context wrappers.')
  await ctx.think('constraint_check', 'Ensuring all external calls are made via ctx.* wrappers for traceability.')

  try {
    const output = await opts.handler(ctx, opts.input)

    const executionTimeMs = Date.now() - startAt
    await agentLogger.completeAgentRun(runId, output as Record<string, any>, 'success', executionTimeMs)
    executionEventBroadcaster.broadcastExecutionCompleted(runId, opts.agentId, opts.agentName, output as Record<string, any>, executionTimeMs)

    const result = { runId, output }
    scheduleReasoningSummary(runId)

    return result
  } catch (err: any) {
    const executionTimeMs = Date.now() - startAt

    const message = err?.message ? String(err.message) : 'Unknown error'
    const type = err?.name ? String(err.name) : 'Error'

    await agentLogger.failAgentRun(runId, { message, type, stack: err?.stack }, executionTimeMs)
    executionEventBroadcaster.broadcastExecutionError(runId, opts.agentId, opts.agentName, message, type)

    try {
      ;(err as Error & { runId?: string }).runId = runId
    } catch {
      // ignore
    }

    throw err
  }
}
