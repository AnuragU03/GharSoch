import type { AgentRunContext } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

function tomorrowAt11Ist() {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istTomorrow = new Date(now.getTime() + istOffsetMs + 24 * 60 * 60 * 1000)
  istTomorrow.setUTCHours(11, 0, 0, 0)
  return new Date(istTomorrow.getTime() - istOffsetMs)
}

function parseCallbackAt(dateInput: string, timeInput?: string) {
  const callbackAt = new Date(dateInput)

  if (timeInput) {
    const [hours, minutes] = String(timeInput).split(':').map(Number)
    if (!Number.isNaN(hours)) {
      callbackAt.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    }
  }

  if (Number.isNaN(callbackAt.getTime()) || callbackAt < new Date()) {
    console.warn('[SCHEDULE_CALLBACK] AI provided invalid date, defaulting to tomorrow 11am IST:', dateInput)
    const fallback = tomorrowAt11Ist()
    if (timeInput) {
      const [hours, minutes] = String(timeInput).split(':').map(Number)
      if (!Number.isNaN(hours)) {
        fallback.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
      }
    }
    return fallback
  }

  return callbackAt
}

export async function scheduleCallbackTool(args: Record<string, any>, ctx: AgentRunContext) {
  console.log('[SCHEDULE_CALLBACK] AI parameters:', JSON.stringify(args))

  const vapiCallId = args.__vapi_call_id || args.vapi_call_id || args.call_id
  if (!vapiCallId) {
    return { error: 'No call context (missing vapi_call_id). Cannot schedule callback.' }
  }

  const callRow = await ctx.db.findOne('calls', { vapi_call_id: vapiCallId })
  if (!callRow?.lead_id) {
    return { error: 'No lead context for this call. Cannot schedule callback.' }
  }

  const leadId = String(callRow.lead_id)
  if (!ObjectId.isValid(leadId)) {
    return { error: 'Invalid lead context for this call. Cannot schedule callback.' }
  }

  const preferredDate = args.preferred_date
  const preferredTime = args.preferred_time || '11:00'
  if (!preferredDate) {
    return { error: 'preferred_date is required (e.g., "tomorrow", "Friday", "2026-05-12")' }
  }

  const callbackAt = parseCallbackAt(String(preferredDate), preferredTime)
  const leadObjectId = new ObjectId(leadId)
  const lead = await ctx.db.findOne('leads', { _id: leadObjectId })

  await ctx.db.updateOne(
    'leads',
    { _id: leadObjectId },
    {
      $set: {
        next_follow_up_date: callbackAt,
        status: 'follow_up',
        followup_reason: args.notes || `Callback requested via voice agent on ${new Date().toISOString()}`,
        updated_at: new Date(),
      },
    }
  )

  await ctx.act('callback_scheduled', `Scheduled callback for ${lead?.phone || callRow.lead_phone || 'lead'}`, {
    parameters: {
      vapi_call_id: vapiCallId,
      lead_id: leadId,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
    },
    result: { next_follow_up_date: callbackAt.toISOString() },
  })

  return {
    status: 'scheduled',
    message: `Callback scheduled for ${callbackAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    next_follow_up_date: callbackAt.toISOString(),
  }
}
