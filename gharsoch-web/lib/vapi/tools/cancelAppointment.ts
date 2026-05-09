import { ObjectId } from 'mongodb'

import type { AgentRunContext } from '@/lib/runAgent'

export async function appointmentCancelTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.appointment_id || !ObjectId.isValid(String(args.appointment_id))) {
    throw new Error('Valid appointment_id is required')
  }

  const appointmentId = new ObjectId(String(args.appointment_id))
  await ctx.db.updateOne(
    'appointments',
    { _id: appointmentId },
    { $set: { status: 'cancelled', notes: args.reason || '', updated_at: new Date() } }
  )

  await ctx.act('appointment_cancelled', `Cancelled appointment ${args.appointment_id}`, {
    parameters: { appointment_id: args.appointment_id, reason: args.reason || '' },
    result: { status: 'cancelled' },
  })

  return {
    status: 'cancelled',
    message: 'Appointment cancelled.',
  }
}
