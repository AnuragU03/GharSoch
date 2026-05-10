import type { AgentRunContext } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

function tomorrowAt11Ist() {
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istTomorrow = new Date(now.getTime() + istOffsetMs + 24 * 60 * 60 * 1000)
  istTomorrow.setUTCHours(11, 0, 0, 0)
  return new Date(istTomorrow.getTime() - istOffsetMs)
}

function parseScheduledAt(args: Record<string, any>) {
  const raw = args.scheduled_at || args.preferred_date || args.date
  const scheduledAt = new Date(raw)

  if (args.preferred_time && !Number.isNaN(scheduledAt.getTime())) {
    const [hours, minutes] = String(args.preferred_time).split(':').map(Number)
    if (!Number.isNaN(hours)) {
      scheduledAt.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    }
  }

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
    console.warn('[BOOK_APPOINTMENT] AI provided invalid date, defaulting to tomorrow 11am IST:', raw)
    return tomorrowAt11Ist()
  }

  return scheduledAt
}

export async function bookAppointmentTool(args: Record<string, any>, ctx: AgentRunContext) {
  const vapiCallId = args.__vapi_call_id || args.vapi_call_id || args.call_id
  console.log('[BOOK_APPOINTMENT] AI parameters:', JSON.stringify(args))

  if (!vapiCallId) {
    return { error: 'No call context for this booking request. Cannot book appointment.' }
  }

  const callRow = await ctx.db.findOne('calls', { vapi_call_id: vapiCallId })
  console.log('[BOOK_APPOINTMENT] Call context:', JSON.stringify({
    vapi_call_id: vapiCallId,
    lead_id_from_call: callRow?.lead_id?.toString?.() || callRow?.lead_id || null,
  }))

  if (!callRow?.lead_id) {
    return { error: 'No lead context for this call. Cannot book appointment.' }
  }

  const propertyIdRaw = args.property_id || args.propertyId
  if (!propertyIdRaw || !ObjectId.isValid(String(propertyIdRaw))) {
    return { error: 'Invalid or missing property_id' }
  }

  const leadId = String(callRow.lead_id)
  const propertyId = new ObjectId(String(propertyIdRaw))
  const scheduledAt = parseScheduledAt(args)

  await ctx.think('evaluation', `Booking appointment for lead ${leadId} and property ${propertyId.toString()}.`)

  const lead = ObjectId.isValid(leadId)
    ? await ctx.db.findOne('leads', { _id: new ObjectId(leadId) })
    : null
  const property = await ctx.db.findOne('properties', { _id: propertyId })

  if (!property) {
    return { error: 'Property not found for property_id' }
  }

  const insertResult = await ctx.db.insertOne('appointments', {
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
    message: `Appointment booked for ${scheduledAt.toLocaleString('en-IN')}.`,
    calendar_sync: 'stubbed_phase8',
  }
}
