import type { AgentRunContext } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/mongodb'

// ── W3: Smart date/time parser ────────────────────────────────────────────────

/**
 * Parse natural-language date+time args from the AI into a concrete Date.
 * Priority: ISO scheduled_at → preferred_date + preferred_time → fallback tomorrow 11am IST.
 * Handles: "tomorrow", "today", "day after tomorrow", ISO dates, "4pm", "16:00", "4:30 PM".
 */
function parseDateTime(args: Record<string, any>): Date {
  // 1. Try direct ISO scheduled_at
  if (args.scheduled_at) {
    const d = new Date(args.scheduled_at)
    if (!isNaN(d.getTime()) && d > new Date()) return d
  }

  const preferredDate = args.preferred_date
  const preferredTime = String(args.preferred_time || args.time || '11:00')

  if (preferredDate) {
    let baseDate: Date | null = null
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

    if (baseDate) {
      // Parse preferred_time: "4pm", "16:00", "4:30 PM", "11"
      const timeMatch = String(preferredTime).match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i)
      if (timeMatch) {
        let hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2]) || 0
        const ampm = (timeMatch[3] || '').toLowerCase()

        if (ampm === 'pm' && hours < 12) hours += 12
        if (ampm === 'am' && hours === 12) hours = 0

        // Convert IST to UTC: IST = UTC+5:30, so UTC = IST - 5:30
        baseDate.setUTCHours(hours - 5, minutes - 30, 0, 0)

        // If result is in the past, push one day forward
        if (baseDate < new Date()) {
          baseDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
        }

        return baseDate
      }
    }
  }

  // Final fallback: tomorrow 11am IST = 05:30 UTC
  const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000)
  fallback.setUTCHours(5, 30, 0, 0)
  console.warn('[BOOK_APPOINTMENT] Used final fallback (tomorrow 11am IST), AI args were:', JSON.stringify(args))
  return fallback
}

// ── Main tool ─────────────────────────────────────────────────────────────────

export async function bookAppointmentTool(args: Record<string, any>, ctx: AgentRunContext) {
  const vapiCallId = args.__vapi_call_id || args.vapi_call_id || args.call_id
  console.log('[BOOK_APPOINTMENT] AI parameters:', JSON.stringify(args))

  if (!vapiCallId) {
    return { error: 'No call context for this booking request. Cannot book appointment.' }
  }

  // Resolve call context (F2 pattern)
  const callRow = await ctx.db.findOne('calls', { vapi_call_id: vapiCallId })
  console.log('[BOOK_APPOINTMENT] Call context:', JSON.stringify({
    vapi_call_id: vapiCallId,
    lead_id_from_call: callRow?.lead_id?.toString?.() || callRow?.lead_id || null,
    matched_property_id_from_call: callRow?.matched_property_id?.toString?.() || callRow?.matched_property_id || null,
  }))

  if (!callRow?.lead_id) {
    return { error: 'No lead context for this call. Cannot book appointment.' }
  }

  // Resolve property_id: AI arg first, then matched_property_id from call context
  let propertyIdRaw = args.property_id || args.propertyId
  if (!propertyIdRaw && callRow?.matched_property_id) {
    propertyIdRaw = callRow.matched_property_id.toString()
    console.log('[BOOK_APPOINTMENT] Using matched_property_id from call context:', propertyIdRaw)
  }

  if (!propertyIdRaw || !ObjectId.isValid(String(propertyIdRaw))) {
    return { error: 'Invalid or missing property_id. AI did not provide one and no matched_property_id in call context.' }
  }

  const leadId = String(callRow.lead_id)
  const propertyId = new ObjectId(String(propertyIdRaw))
  const scheduledAt = parseDateTime(args)

  // ── W1: Idempotency guard — block duplicate bookings within 15 min ─────────
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
  const appointmentsCol = await getCollection('appointments')
  const existing = await appointmentsCol.findOne({
    lead_id: leadId,
    property_id: propertyId.toString(),
    created_at: { $gte: fifteenMinAgo },
  })

  if (existing) {
    console.log('[BOOK_APPOINTMENT] Idempotency: existing appointment found within 15min, returning that')
    return {
      status: 'already_booked',
      appointment_id: existing._id.toString(),
      message: `Appointment already booked for ${new Date(existing.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. No duplicate created.`,
      scheduled_at: existing.scheduled_at,
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  await ctx.think('evaluation', `Booking appointment for lead ${leadId} and property ${propertyId.toString()}.`)

  const lead = ObjectId.isValid(leadId)
    ? await ctx.db.findOne('leads', { _id: new ObjectId(leadId) })
    : null
  const property = await ctx.db.findOne('properties', { _id: propertyId })

  if (!property) {
    return { error: 'Property not found for property_id' }
  }

  const insertResult = await appointmentsCol.insertOne({
    lead_id: leadId,
    property_id: propertyId.toString(),
    agent_id: '',
    scheduled_at: scheduledAt,
    status: 'scheduled',
    reminder_sent: false,
    notes: args.notes || '',
    source: 'voice_agent',
    vapi_call_id: vapiCallId,
    lead_name: lead?.name || callRow.lead_name || args.customer_name || 'Unknown',
    lead_phone: lead?.phone || callRow.lead_phone || args.customer_phone || '',
    property_title: property.title || args.property_title || '',
    property_location: property.location || '',
    created_at: new Date(),
    updated_at: new Date(),
  })

  await ctx.act('appointment_booked', `Booked appointment ${insertResult.insertedId} for lead ${leadId}`, {
    parameters: { vapi_call_id: vapiCallId, lead_id: leadId, property_id: propertyId.toString(), scheduled_at: scheduledAt.toISOString() },
    result: { appointment_id: insertResult.insertedId.toString(), calendar_sync: 'stubbed_phase8' },
  })

  return {
    status: 'booked',
    appointment_id: insertResult.insertedId.toString(),
    message: `Appointment booked for ${scheduledAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    calendar_sync: 'stubbed_phase8',
  }
}
