import type { AgentRunContext } from '@/lib/runAgent'

export async function markDndTool(args: Record<string, any>, ctx: AgentRunContext) {
  if (!args.phone) {
    throw new Error('phone is required')
  }

  const leads = await ctx.db.findMany('leads', { phone: args.phone })
  const updatedCount = leads.length

  for (const lead of leads) {
    await ctx.db.updateOne(
      'leads',
      { _id: lead._id },
      { $set: { dnd_status: true, notes: `DNC: ${args.reason || 'Customer requested'}`, updated_at: new Date() } }
    )
  }

  await ctx.act('lead_marked_dnd', `Marked ${args.phone} as DND`, {
    parameters: { phone: args.phone, reason: args.reason || 'customer_requested' },
    result: { updated_count: updatedCount },
  })

  return {
    status: 'blocked',
    message: `${args.phone} has been added to the Do Not Call list.`,
    updated_count: updatedCount,
  }
}
