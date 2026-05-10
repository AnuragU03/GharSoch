import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import type { AgentRunContext } from '@/lib/runAgent'
import { runAgent } from '@/lib/runAgent'
import { handleEndOfCallReport } from '@/lib/vapi/callReportHandler'
import { dispatchTool } from '@/lib/vapi/toolRouter'

export const dynamic = 'force-dynamic'

type VapiToolCall = {
  id?: string
  function?: {
    name?: string
    arguments?: string | Record<string, any>
  }
}

type ParsedWebhookPayload = {
  raw: any
  type: string
  toolCalls: VapiToolCall[]
  callId?: string
}

function safeCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer)
}

function validateVapiSignature(request: NextRequest, rawBody: string) {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  const signature = request.headers.get('x-vapi-signature')

  if (secret && signature) {
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
    const sigStripped = signature.trim().replace(/^sha256=/, '')
    const matchesHex = safeCompare(sigStripped, expectedHex)
    const matchesB64 = safeCompare(sigStripped, expectedB64)

    if (!matchesHex && !matchesB64) {
      console.error('[VAPI WEBHOOK] Signature mismatch — rejecting request')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    return null
  }

  if (secret && !signature) {
    console.warn('[VAPI WEBHOOK] VAPI_WEBHOOK_SECRET set but no x-vapi-signature header. Accepting request — disable this once Vapi sends signatures.')
    return null
  }

  if (!secret && signature) {
    console.warn('[VAPI WEBHOOK] x-vapi-signature header present but VAPI_WEBHOOK_SECRET unset. Configure secret to enable validation.')
    return null
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[VAPI WEBHOOK] No signature validation — VAPI_WEBHOOK_SECRET unset')
  }

  return null
}

function normalizeType(payload: any) {
  const rawType = payload?.type || payload?.message?.type || ''
  if (rawType === 'tool-calls') return 'function-call'
  return String(rawType)
}

function extractCallId(payload: any) {
  return (
    payload?.callId ||
    payload?.call?.id ||
    payload?.message?.callId ||
    payload?.message?.call?.id ||
    payload?.message?.artifact?.callId ||
    payload?.artifact?.callId ||
    undefined
  )
}

function parseWebhookPayload(rawBody: string): ParsedWebhookPayload {
  const payload = JSON.parse(rawBody)
  return {
    raw: payload,
    type: normalizeType(payload),
    toolCalls: payload?.toolCalls || payload?.message?.toolCalls || [],
    callId: extractCallId(payload),
  }
}

function summarizeToolCalls(toolCalls: VapiToolCall[]) {
  return toolCalls
    .map((toolCall) => toolCall.function?.name)
    .filter((name): name is string => Boolean(name))
}

async function handleTranscriptEvent(ctx: AgentRunContext, payload: any) {
  const callId = extractCallId(payload)
  const transcript =
    payload?.transcript ||
    payload?.message?.transcript ||
    payload?.artifact?.transcript ||
    payload?.message?.artifact?.transcript

  await ctx.think('evaluation', `Received transcript event for ${callId || 'unknown_call'}.`)

  if (!callId || !transcript) {
    return { success: true, message: 'Transcript event acknowledged' }
  }

  const existingCall = await ctx.db.findOne('calls', { vapi_call_id: callId })
  if (existingCall?._id) {
    await ctx.db.updateOne(
      'calls',
      { _id: existingCall._id },
      { $set: { transcript, updated_at: new Date() } }
    )
    await ctx.act('transcript_saved', `Updated transcript for call ${callId}`, {
      parameters: { call_id: callId },
      result: { transcript_saved: true },
    })
  }

  return { success: true, message: 'Transcript processed' }
}

async function handleStatusUpdateEvent(ctx: AgentRunContext, payload: any) {
  const callId = extractCallId(payload)
  const status =
    payload?.status ||
    payload?.message?.status ||
    payload?.call?.status ||
    payload?.message?.call?.status

  await ctx.think('evaluation', `Received status update ${status || 'unknown'} for ${callId || 'unknown_call'}.`)

  if (!callId || !status) {
    return { success: true, message: 'Status update acknowledged' }
  }

  const existingCall = await ctx.db.findOne('calls', { vapi_call_id: callId })
  if (existingCall?._id) {
    await ctx.db.updateOne(
      'calls',
      { _id: existingCall._id },
      { $set: { call_status: status, updated_at: new Date() } }
    )
    await ctx.act('status_updated', `Updated call ${callId} to ${status}`, {
      parameters: { call_id: callId, status },
      result: { call_status: status },
    })
  }

  return { success: true, message: 'Status update processed' }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    const signatureError = validateVapiSignature(request, rawBody)
    if (signatureError) return signatureError

    const parsed = parseWebhookPayload(rawBody)
    const toolNames = summarizeToolCalls(parsed.toolCalls)

    const { output } = await runAgent({
      agentId: 'voice_orchestrator',
      agentName: 'Voice Orchestrator',
      trigger: 'event',
      input: {
        webhook_type: parsed.type,
        call_id: parsed.callId,
        tool_names: toolNames,
      },
      metadata: {
        source: 'vapi_webhook',
        webhook_type: parsed.type,
      },
      handler: async (ctx) => {
        await ctx.think(
          'evaluation',
          `Routing Vapi webhook type ${parsed.type || 'unknown'} for ${parsed.callId || 'unknown_call'}.`,
          { metadata: { tool_count: parsed.toolCalls.length } }
        )

        switch (parsed.type) {
          case 'function-call': {
            await ctx.think(
              'decision',
              toolNames.length > 0
                ? `Dispatching ${toolNames.length} tool call(s): ${toolNames.join(', ')}.`
                : 'Function-call event received with no tool calls.'
            )

            const results = []
            for (const toolCall of parsed.toolCalls) {
              const toolName = toolCall.function?.name || 'unknown_tool'
              let result: Record<string, any>

              try {
                const args = typeof toolCall.function?.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function?.arguments || {}
                const argsWithCallContext = {
                  ...args,
                  __vapi_call_id: parsed.callId,
                }

                await ctx.act('tool_dispatch', `Dispatching Vapi tool ${toolName}`, {
                  parameters: { tool_name: toolName, tool_call_id: toolCall.id, args: argsWithCallContext },
                })

                result = await dispatchTool(toolName, argsWithCallContext, ctx)
              } catch (toolError: any) {
                const message = typeof toolError?.message === 'string' ? toolError.message : `Tool ${toolName} failed`
                await ctx.act('tool_dispatch_failed', `Vapi tool ${toolName} failed`, {
                  parameters: { tool_name: toolName, tool_call_id: toolCall.id },
                  error: message,
                })
                result = { error: message }
              }

              results.push({
                toolCallId: toolCall.id || toolName,
                result,
              })
            }

            return { results }
          }

          case 'end-of-call-report': {
            await ctx.think('decision', 'Processing end-of-call-report and persisting call artifacts.')
            return await handleEndOfCallReport(parsed.raw, ctx)
          }

          case 'status-update':
            return await handleStatusUpdateEvent(ctx, parsed.raw)

          case 'transcript':
            return await handleTranscriptEvent(ctx, parsed.raw)

          default:
            await ctx.think('result_analysis', `Unhandled Vapi webhook type ${parsed.type || 'unknown'} acknowledged.`)
            return { success: true, message: `Unhandled webhook type: ${parsed.type || 'unknown'}` }
        }
      },
    })

    return NextResponse.json(output || { success: true })
  } catch (error: any) {
    console.error('[VAPI WEBHOOK] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: typeof error?.message === 'string' ? error.message : 'Vapi webhook failed',
        runId: error?.runId,
      },
      { status: 500 }
    )
  }
}
