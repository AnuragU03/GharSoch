import type { AgentRunContext } from '@/lib/runAgent'

function parseCallbackAt(dateInput: string, timeInput?: string) {
  const callbackAt = new Date(dateInput)
  if (timeInput) {
    const [hours, minutes] = String(timeInput).split(':').map(Number)
    if (!Number.isNaN(hours)) {
      callbackAt.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0)
    }
  }
  return callbackAt
}

export async function scheduleCallbackTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.customer_phone || !args.preferred_date) {
    throw new Error('customer_phone and preferred_date are required')
  }

  const callbackAt = parseCallbackAt(String(args.preferred_date), args.preferred_time)
  const leads = await ctx.db.findMany('leads', { phone: args.customer_phone })
  const lead = leads[0] || null

  if (!lead?._id) {
    throw new Error('Lead not found for callback scheduling')
  }

  await ctx.db.updateOne(
    'leads',
    { _id: lead._id },
    { $set: { next_follow_up_date: callbackAt, status: 'follow_up', updated_at: new Date() } }
  )

  await ctx.act('callback_scheduled', `Scheduled callback for ${args.customer_phone}`, {
    parameters: { customer_phone: args.customer_phone },
    result: { next_follow_up_date: callbackAt.toISOString() },
  })

  return {
    status: 'scheduled',
    message: `Callback scheduled for ${callbackAt.toLocaleString('en-IN')}.`,
    next_follow_up_date: callbackAt.toISOString(),
  }
}
