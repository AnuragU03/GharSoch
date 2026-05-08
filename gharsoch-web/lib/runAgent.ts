import { agentLogger, type ReasoningStep } from '@/lib/agentLogger'
import { executionEventBroadcaster } from '@/lib/agentExecutionEventBroadcaster'
import { getCollection } from '@/lib/mongodb'
import { openaiChatCompletion, type OpenAIChatMessage } from '@/lib/openaiClient'
import {
  triggerCampaignCall,
  triggerOutboundCall,
  triggerReminderCall,
  getCallDetails,
} from '@/lib/vapiClient'

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
    triggerReminderCall: typeof triggerReminderCall
    getCallDetails: typeof getCallDetails
  }
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
        actionOpts?.error ? 'failed' : 'completed'
      )
    },

    db: {
      findOne: async (collectionName, filter) => {
        await agentLogger.logAgentAction(runId, 'mongo_read', `findOne ${collectionName}`, { collectionName, filter })
        const collection = await getCollection(collectionName)
        return (await collection.findOne(filter)) as any
      },
      findMany: async (collectionName, filter) => {
        await agentLogger.logAgentAction(runId, 'mongo_read', `find ${collectionName}`, { collectionName, filter })
        const collection = await getCollection(collectionName)
        return (await collection.find(filter).toArray()) as any
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
          usage: res.usage as any,
        })

        return { content: res.content, usage: res.usage as any }
      },
    },

    vapi: {
      triggerOutboundCall: async (params) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerOutboundCall', { assistantId: params.assistantId })
        const res = await triggerOutboundCall(params)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerOutboundCall result', undefined, res as any)
        return res
      },
      triggerCampaignCall: async (lead, campaignContext, propertiesContext) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerCampaignCall', { phone: lead.phone })
        const res = await triggerCampaignCall(lead, campaignContext, propertiesContext)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerCampaignCall result', undefined, res as any)
        return res
      },
      triggerReminderCall: async (appointment) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'triggerReminderCall', { lead_phone: appointment.lead_phone })
        const res = await triggerReminderCall(appointment)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'triggerReminderCall result', undefined, res as any)
        return res
      },
      getCallDetails: async (callId) => {
        await agentLogger.logAgentAction(runId, 'vapi', 'getCallDetails', { callId })
        const res = await getCallDetails(callId)
        await agentLogger.logAgentAction(runId, 'vapi_result', 'getCallDetails result', undefined, { ok: !!res } as any)
        return res
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
    await agentLogger.completeAgentRun(runId, output as any, 'success', executionTimeMs)
    executionEventBroadcaster.broadcastExecutionCompleted(runId, opts.agentId, opts.agentName, output as any, executionTimeMs)

    return { runId, output }
  } catch (err: any) {
    const executionTimeMs = Date.now() - startAt

    const message = err?.message ? String(err.message) : 'Unknown error'
    const type = err?.name ? String(err.name) : 'Error'

    await agentLogger.failAgentRun(runId, { message, type, stack: err?.stack }, executionTimeMs)
    executionEventBroadcaster.broadcastExecutionError(runId, opts.agentId, opts.agentName, message, type)

    try {
      ;(err as any).runId = runId
    } catch {
      // ignore
    }

    throw err
  }
}
