import { ObjectId } from 'mongodb'

import type { AgentRunContext } from '@/lib/runAgent'

function parseNewDate(dateInput: string, timeInput?: string) {
  const scheduledAt = new Date(dateInput)
  if (timeInput) {
    const [hours, minutes] = String(timeInput).split(':').map(Number)
    if (!Number.isNaN(hours)) {
      scheduledAt.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    }
  }
  return scheduledAt
}

export async function appointmentRescheduleTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.appointment_id || !ObjectId.isValid(String(args.appointment_id)) || !args.new_date) {
    throw new Error('Valid appointment_id and new_date are required')
  }

  const appointmentId = new ObjectId(String(args.appointment_id))
  const scheduledAt = parseNewDate(String(args.new_date), args.new_time)

  await ctx.db.updateOne(
    'appointments',
    { _id: appointmentId },
    { $set: { scheduled_at: scheduledAt, status: 'rescheduled', updated_at: new Date() } }
  )

  await ctx.act('appointment_rescheduled', `Rescheduled appointment ${args.appointment_id}`, {
    parameters: { appointment_id: args.appointment_id },
    result: { scheduled_at: scheduledAt.toISOString() },
  })

  return {
    status: 'rescheduled',
    message: `Appointment moved to ${scheduledAt.toLocaleString('en-IN')}.`,
    scheduled_at: scheduledAt.toISOString(),
  }
}
