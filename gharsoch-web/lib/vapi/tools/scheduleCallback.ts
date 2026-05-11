import type { AgentRunContext } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

// ── W3: Smart date/time parser (shared pattern with bookAppointment) ───────────

/**
 * Parse natural-language date+time args into a concrete Date.
 * Priority: preferred_date + preferred_time → fallback tomorrow 11am IST.
 */
function parseCallbackAt(args: Record<string, any>): Date {
  const preferredDate = args.preferred_date
  const preferredTime = String(args.preferred_time || args.time || '11:00')
  let baseDate: Date | null = null

  if (preferredDate) {
    const lower = String(preferredDate).toLowerCase().trim()

    if (lower === 'today') {
      baseDate = new Date()
    } else if (lower === 'tomorrow') {
      baseDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    } else if (lower === 'day-after-tomorrow' || lower === 'day after tomorrow') {
      baseDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
    } else {
      const parsed = new Date(preferredDate)
      if (!isNaN(parsed.getTime())) baseDate = parsed
    }

  }

  const relativeMatch = String(preferredTime).match(/^in\s+(\d+)\s*(min|minute|minutes|hr|hrs|hour|hours)/i)
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2].toLowerCase()
    const isHours = unit.startsWith('h')
    const futureDate = new Date(Date.now() + amount * (isHours ? 60 : 1) * 60 * 1000)
    console.log('[PARSE_DATE] Relative time:', amount, unit, '->', futureDate.toISOString())
    return futureDate
  }

  const bareRelativeMatch = String(preferredTime).match(/^(\d+)\s*(min|minute|minutes|hr|hrs|hour|hours)\s*(from\s+now|later)?$/i)
  if (bareRelativeMatch) {
    const amount = parseInt(bareRelativeMatch[1], 10)
    const unit = bareRelativeMatch[2].toLowerCase()
    const isHours = unit.startsWith('h')
    const futureDate = new Date(Date.now() + amount * (isHours ? 60 : 1) * 60 * 1000)
    console.log('[PARSE_DATE] Bare relative time:', amount, unit, '->', futureDate.toISOString())
    return futureDate
  }

  if (baseDate) {
    const timeMatch = String(preferredTime).match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = parseInt(timeMatch[2], 10) || 0
      const ampm = (timeMatch[3] || '').toLowerCase()

      if (ampm === 'pm' && hours < 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0

      // Convert IST to UTC
      baseDate.setUTCHours(hours - 5, minutes - 30, 0, 0)

      if (baseDate < new Date()) {
        baseDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
      }

      return baseDate
    }
  }

  // Final fallback: tomorrow 11am IST
  const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000)
  fallback.setUTCHours(5, 30, 0, 0)
  console.warn('[SCHEDULE_CALLBACK] Used final fallback (tomorrow 11am IST), AI args were:', JSON.stringify(args))
  return fallback
}

// ── Main tool ─────────────────────────────────────────────────────────────────

export async function scheduleCallbackTool(args: Record<string, any>, ctx: AgentRunContext) {
  console.log('[SCHEDULE_CALLBACK] AI parameters:', JSON.stringify(args))

  // F2 pattern: resolve from call context, never trust AI-provided customer_phone
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
  if (!preferredDate) {
    return { error: 'preferred_date is required (e.g., "tomorrow", "Friday", "2026-05-12")' }
  }

  const callbackAt = parseCallbackAt(args)
  const leadObjectId = new ObjectId(leadId)

  // ── W1: Idempotency guard — skip if already scheduled in last 15 min ──────
  const existing = await ctx.db.findOne('leads', { _id: leadObjectId })
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
  if (
    existing?.next_follow_up_date &&
    existing?.status === 'follow_up' &&
    existing?.updated_at &&
    new Date(existing.updated_at) >= fifteenMinAgo
  ) {
    console.log('[SCHEDULE_CALLBACK] Idempotency: callback already scheduled within 15min, returning existing')
    return {
      status: 'already_scheduled',
      message: `Callback already scheduled for ${new Date(existing.next_follow_up_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. No duplicate created.`,
      next_follow_up_date: existing.next_follow_up_date,
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

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

  await ctx.act('callback_scheduled', `Scheduled callback for ${existing?.phone || callRow.lead_phone || 'lead'}`, {
    parameters: {
      vapi_call_id: vapiCallId,
      lead_id: leadId,
      preferred_date: preferredDate,
      preferred_time: args.preferred_time || '11:00',
    },
    result: { next_follow_up_date: callbackAt.toISOString() },
  })

  return {
    status: 'scheduled',
    message: `Callback scheduled for ${callbackAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    next_follow_up_date: callbackAt.toISOString(),
  }
}
