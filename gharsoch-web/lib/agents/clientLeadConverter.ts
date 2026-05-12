import { runAgent } from '@/lib/runAgent'
import { createLead } from '@/lib/services/leadService'
import { ObjectId } from 'mongodb'

export async function runClientLeadConverter(clientId: string): Promise<{ runId: string; lead_id?: string; rejected?: boolean; reason?: string; score?: number; rationale?: string }> {
  const { runId, output } = await runAgent({
    agentId: 'client_lead_converter',
    agentName: 'Client → Lead Converter',
    trigger: 'event',
    input: { client_id: clientId },
    handler: async (ctx) => {
      await ctx.think('evaluation', `Loading client ${clientId} for qualification`)
      const client = await ctx.db.findOne('clients', { _id: new ObjectId(clientId) })
      if (!client) throw new Error('Client not found')

      // Quality gates
      const missingFields: string[] = []
      if (!client.phone) missingFields.push('phone')
      if (!client.budget_range && !client.location_pref) missingFields.push('budget_or_location')
      if (missingFields.length) {
        await ctx.think('decision', `Insufficient info: missing ${missingFields.join(', ')} → rejecting`)
        await ctx.db.updateOne('clients', { _id: client._id }, { $set: { conversion_status: 'rejected', conversion_reason: 'insufficient_info', updated_at: new Date() } })
        await ctx.act('client_rejected', 'Insufficient info', { client_id: clientId, reason: 'insufficient_info' })
        return { 
          rejected: true, 
          reason: 'insufficient_info',
          summary: `Rejected due to missing info: ${missingFields.join(', ')}`,
          lead_details: [{ lead_name: client.name, status: 'rejected', recommendation: 'Missing info' }]
        }
      }

      // GPT-4o lead-score
      await ctx.think('decision', 'Calling gpt-4o for lead qualification')
      const gptResult = await ctx.openai.chat({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are qualifying a real estate client. Score 0-100 (intent + completeness + responsiveness signal). Return a JSON object with {score: number, rationale: string, qualified: boolean}. qualified=true if score >= 50.' },
          { role: 'user', content: JSON.stringify(client) }
        ]
      })
      const parsed = JSON.parse(gptResult.content)

      if (!parsed.qualified) {
        await ctx.db.updateOne('clients', { _id: client._id }, { $set: { conversion_status: 'rejected', conversion_reason: parsed.rationale, lead_score: parsed.score, updated_at: new Date() } })
        await ctx.act('client_rejected', 'Failed qualification', { client_id: clientId, score: parsed.score })
        return { 
          rejected: true, 
          reason: parsed.rationale, 
          score: parsed.score,
          summary: parsed.rationale,
          lead_details: [{ lead_name: client.name, status: 'rejected', recommendation: parsed.rationale }]
        }
      }

      // Create Lead from Client
      if (!client.broker_id) {
        console.error(`[clientLeadConverter] client ${client._id} has no broker_id — cannot create lead`)
        return { ok: false, rejected: true, reason: 'client_missing_broker', error: 'Client missing broker_id' }
      }

      const result = await createLead({
        broker_id: client.broker_id,
        client_id: client._id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        location_pref: client.location_pref,
        property_type: client.property_type,
        budget_range: client.budget_range,
        notes: client.notes,
        source: client.source ?? 'client_converter',
        interest_level: parsed.score >= 75 ? 'hot' : parsed.score >= 60 ? 'warm' : 'cold',
        lead_score: parsed.score,
        qualification_rationale: parsed.rationale,
        qualification_status: 'pending',
        status: 'new',
        dnd_status: false,
      })

      if (!result.ok) {
        console.error(`[clientLeadConverter] createLead failed: ${result.reason}`)
        return { ok: false, rejected: true, reason: result.reason, error: 'Lead creation failed' }
      }

      const leadId = result.lead_id as ObjectId

      await ctx.db.updateOne('clients', { _id: client._id }, { $set: { conversion_status: 'converted', lead_id: leadId, lead_score: parsed.score, updated_at: new Date() } })
      await ctx.act('lead_created', 'Lead qualified and created', { lead_id: leadId.toString(), client_id: clientId, score: parsed.score })

      await ctx.think('result_analysis', `Converted client ${client.name} → lead ${leadId} with score ${parsed.score}. Matchmaker will be triggered separately by the route.`)

      return { 
        lead_id: leadId.toString(), 
        score: parsed.score, 
        rationale: parsed.rationale,
        summary: parsed.rationale,
        lead_details: [
          {
            lead_name: client.name,
            status: 'converted',
            recommendation: parsed.rationale,
          }
        ]
      }
    }
  })
  return { runId, ...(output as any) }
}
