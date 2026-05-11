import type { AgentRunContext } from '@/lib/runAgent'
import { runMatchmakerForLead } from '@/lib/agents/matchmaker'

function buildLeadScoringPayload(args: Record<string, any>) {
  return {
    customer_phone: args.customer_phone,
    customer_name: args.customer_name,
    budget_range: args.budget_range,
    location_pref: args.location_pref,
    property_type: args.property_type,
    timeline: args.timeline,
    interest_level: args.interest_level,
    objections: args.objections,
    customer_requirements: args.customer_requirements,
  }
}

export async function qualifyLeadTool(args: Record<string, any>, ctx: AgentRunContext) {
  const vapiCallId = args.__vapi_call_id || args.vapi_call_id || args.call_id
  let phone = args.customer_phone

  // Z2: Phone Resolution — If Vapi confuses name/phone, resolve from call context
  if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
    console.warn('[QUALIFY_LEAD] Invalid phone provided by AI:', phone, '— attempting resolution from call context:', vapiCallId);
    if (vapiCallId) {
      const callRow = await ctx.db.findOne('calls', { vapi_call_id: vapiCallId });
      if (callRow?.lead_phone) {
        console.info('[QUALIFY_LEAD] Resolved phone from call context:', callRow.lead_phone);
        phone = callRow.lead_phone;
      }
    }
  }

  if (!phone) {
    throw new Error('customer_phone is required and could not be resolved from context')
  }

  await ctx.think('evaluation', `Qualifying lead for ${phone}.`)

  const matchingLeads = await ctx.db.findMany('leads', { phone })
  let lead = matchingLeads[0] || null
  const wasExistingLead = Boolean(lead?._id)

  const scoring = await ctx.openai.chat({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content: 'You are qualifying a real estate lead from a live phone call. Score 0-100 based on intent, completeness, urgency, and responsiveness. Return JSON: { score: number, rationale: string, interest_level: "hot" | "warm" | "cold" | "not_interested" }.',
      },
      {
        role: 'user',
        content: JSON.stringify(buildLeadScoringPayload({ ...args, customer_phone: phone })),
      },
    ],
  })

  const parsed = JSON.parse(scoring.content || '{}')
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0))
  const interestLevel = String(parsed.interest_level || args.interest_level || (score >= 75 ? 'hot' : score >= 50 ? 'warm' : 'cold'))
  const qualificationStatus = score >= 50 ? 'qualified' : 'unqualified'
  
  const updateData: any = {
    budget_range: args.budget_range || lead?.budget_range || '',
    location_pref: args.location_pref || lead?.location_pref || '',
    property_type: args.property_type || lead?.property_type || '',
    timeline: args.timeline || lead?.timeline || '',
    objections: args.objections || lead?.objections || '',
    customer_requirements: args.customer_requirements || lead?.customer_requirements || '',
    interest_level: interestLevel,
    qualification_status: qualificationStatus,
    lead_score: score,
    last_contacted_at: new Date(),
    updated_at: new Date(),
    dnd_status: lead?.dnd_status === true,
    notes: parsed.rationale || lead?.notes || '',
  }

  // Z4: Status Propagation — Ensure status is at least 'contacted' after qualification
  if (!lead?.status || lead.status === 'new') {
    updateData.status = 'contacted';
  }

  if (lead?._id) {
    await ctx.db.updateOne('leads', { _id: lead._id }, { $set: updateData })
  } else {
    const insertResult = await ctx.db.insertOne('leads', {
      name: args.customer_name || 'Unknown',
      phone: phone,
      email: '',
      source: 'inbound_call',
      status: 'contacted',
      place: args.location_pref || '',
      preferred_contact_time: '',
      availability_window: '',
      availability_days: [],
      follow_up_count: 0,
      total_calls: 1,
      first_call_completed: true,
      next_follow_up_date: null,
      assigned_agent_id: '',
      created_at: new Date(),
      ...updateData,
    })
    lead = { _id: insertResult.insertedId, name: args.customer_name || 'Unknown', phone }
  }

  if (score >= 75 && lead?._id) {
    queueMicrotask(() => {
      void runMatchmakerForLead(String(lead?._id)).catch((error) => {
        console.error('[VAPI TOOL] qualify_lead matchmaker trigger failed:', error)
      })
    })
  }

  await ctx.act('lead_qualified', `Qualified lead ${phone} with score ${score}`, {
    parameters: { customer_phone: phone },
    result: { score, interest_level: interestLevel, qualification_status: qualificationStatus },
  })

  return {
    status: wasExistingLead ? 'updated' : 'created',
    message: `Lead qualified as ${interestLevel} with score ${score}.`,
    score,
    interest_level: interestLevel,
    qualification_status: qualificationStatus,
    rationale: parsed.rationale || '',
    matchmaker_triggered: score >= 75,
  }
}
