import type { AgentRunContext } from '@/lib/runAgent'

function parseScheduledAt(dateInput: string, timeInput?: string) {
  const scheduledAt = new Date(dateInput)
  if (timeInput) {
    const [hours, minutes] = String(timeInput).split(':').map(Number)
    if (!Number.isNaN(hours)) {
      scheduledAt.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    }
  }
  return scheduledAt
}

export async function bookAppointmentTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.customer_phone || !args.property_title || !args.preferred_date) {
    throw new Error('customer_phone, property_title, and preferred_date are required')
  }

  await ctx.think('evaluation', `Booking appointment for ${args.customer_phone} at ${args.property_title}.`)

  const leads = await ctx.db.findMany('leads', { phone: args.customer_phone })
  const properties = await ctx.db.findMany('properties', {
    title: { $regex: String(args.property_title), $options: 'i' },
  })

  const lead = leads[0] || null
  const property = properties[0] || null
  const scheduledAt = parseScheduledAt(String(args.preferred_date), args.preferred_time)

  const insertResult = await ctx.db.insertOne('appointments', {
    lead_id: lead?._id?.toString?.() || '',
    property_id: property?._id?.toString?.() || '',
    agent_id: '',
    scheduled_at: scheduledAt,
    status: 'scheduled',
    reminder_sent: false,
    notes: args.notes || '',
    lead_name: lead?.name || args.customer_name || 'Unknown',
    lead_phone: args.customer_phone,
    property_title: property?.title || args.property_title,
    property_location: property?.location || '',
    created_at: new Date(),
    updated_at: new Date(),
  })

  await ctx.act('appointment_booked', `Booked appointment ${insertResult.insertedId} for ${args.customer_phone}`, {
    parameters: { customer_phone: args.customer_phone, property_title: args.property_title },
    result: { appointment_id: insertResult.insertedId.toString(), calendar_sync: 'stubbed_phase8' },
  })

  return {
    status: 'booked',
    appointment_id: insertResult.insertedId.toString(),
    message: `Appointment booked for ${scheduledAt.toLocaleString('en-IN')}.`,
    calendar_sync: 'stubbed_phase8',
  }
}
