import { ObjectId } from 'mongodb'

import type { AgentRunContext } from '@/lib/runAgent'

export async function appointmentConfirmTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.appointment_id || !ObjectId.isValid(String(args.appointment_id))) {
    throw new Error('Valid appointment_id is required')
  }

  const appointmentId = new ObjectId(String(args.appointment_id))
  await ctx.db.updateOne(
    'appointments',
    { _id: appointmentId },
    { $set: { status: 'confirmed', updated_at: new Date() } }
  )

  await ctx.act('appointment_confirmed', `Confirmed appointment ${args.appointment_id}`, {
    parameters: { appointment_id: args.appointment_id },
    result: { status: 'confirmed' },
  })

  return {
    status: 'confirmed',
    message: 'Appointment confirmed.',
  }
}
