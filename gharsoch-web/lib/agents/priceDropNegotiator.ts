import { runAgent } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

type PriceDropInput = {
  property_id: string
  new_price?: number
  new_price_lakhs?: number
  old_price?: number | null
}

export async function runPriceDropNegotiator(input: PriceDropInput) {
  const { property_id, old_price } = input
  const parsedLakhs = Number(input.new_price_lakhs)
  const parsedRaw = Number(input.new_price)
  const priceForMessage =
    Number.isFinite(parsedLakhs) && parsedLakhs > 0
      ? parsedLakhs
      : Number.isFinite(parsedRaw) && parsedRaw > 0
        ? Math.round(parsedRaw / 100_000)
        : null

  if (!property_id || !priceForMessage) {
    throw new Error('Missing required fields: property_id, new_price (or new_price_lakhs)')
  }

  const propertyObjectId = new ObjectId(property_id)

  return runAgent({
    agentId: 'price_drop_negotiator',
    agentName: 'The Price Drop Negotiator',
    trigger: 'event',
    input: {
      property_id,
      new_price: input.new_price ?? null,
      new_price_lakhs: priceForMessage,
      old_price: old_price ?? null,
      event: 'property.price_dropped',
    },
    metadata: { event_type: 'price_drop', property_id },
    handler: async (ctx) => {
      await ctx.think(
        'evaluation',
        `Price drop event received for property ${property_id}. New price: Rs ${priceForMessage}L. Looking up property details and scanning for leads with price objections in this location.`,
        { confidence: 1.0, metadata: { property_id, new_price_lakhs: priceForMessage } }
      )

      const property = await ctx.db.findOne<any>('properties', { _id: propertyObjectId })
      if (!property) {
        await ctx.think('result_analysis', `Property ${property_id} not found in DB. Aborting.`, { confidence: 1.0 })
        return {
          triggered_calls: 0,
          total_scanned: 0,
          summary: `Property ${property_id} not found.`,
        }
      }

      const targetLeads = await ctx.db.findMany<any>('leads', {
        dnd_status: { $ne: true },
        $or: [
          { objections: { $regex: /price|expensive|budget|cost|afford/i } },
          { objection: { $regex: /price|expensive|budget|cost|afford/i } },
          { notes: { $regex: /price|expensive|budget|too costly|out of budget/i } },
        ],
        location_pref: { $regex: new RegExp(String(property.location || ''), 'i') },
      })

      const batch = targetLeads.slice(0, 20)

      await ctx.think(
        'decision',
        batch.length === 0
          ? `No leads with budget objections matched location "${property.location}". No calls needed.`
          : `Found ${batch.length} lead(s) with price objections near ${property.location}. Will call each with the Rs ${priceForMessage}L price drop news for ${property.title}.`,
        {
          confidence: 0.95,
          metadata: {
            property_title: property.title,
            property_location: property.location,
            eligible_leads: batch.length,
          },
        }
      )

      if (batch.length === 0) {
        return {
          triggered_calls: 0,
          total_scanned: 0,
          property: { id: property_id, title: property.title },
          summary: `No leads with budget objections matched "${property.location}".`,
        }
      }

      let triggeredCount = 0
      const lead_details: Array<Record<string, any>> = []

      for (const lead of batch) {
        const leadId = String(lead._id)
        const result = await ctx.vapi.triggerCampaignCall(
          {
            phone: lead.phone,
            name: lead.name,
            budget_range: lead.budget_range,
            location_pref: lead.location_pref,
            property_type: lead.property_type,
            notes: lead.notes,
          },
          {
            campaign_name: 'Price Drop Negotiation',
            script_template: `Great news! You mentioned that properties in ${property.location} were outside your budget. The builder just dropped the price of ${property.title} to Rs ${priceForMessage} Lakhs. Would you like to revisit and schedule a site visit?`,
          }
        )

        if (result.success) {
          await ctx.db.insertOne('calls', {
            lead_id: leadId,
            lead_name: lead.name,
            lead_phone: lead.phone,
            agent_name: 'The Price Drop Negotiator',
            agent_id: process.env.VAPI_ASSISTANT_OUTBOUND_ID || 'system',
            campaign_id: `price-drop-${property_id}`,
            direction: 'outbound',
            call_type: 'negotiation',
            duration: 0,
            disposition: 'queued',
            call_outcome: 'pending',
            vapi_call_id: result.callId,
            property_id,
            new_price_lakhs: priceForMessage,
            created_at: new Date(),
          })

          await ctx.db.updateOne(
            'leads',
            { _id: lead._id },
            {
              $set: {
                status: 'contacted',
                updated_at: new Date(),
                last_contacted_at: new Date(),
              },
              $push: {
                notes_history: `[Price Drop Negotiator] Called re: ${property.title} price drop to Rs ${priceForMessage}L`,
              } as any,
            }
          )

          await ctx.act('negotiation_call_triggered', `Price-drop call queued for ${lead.name} re: ${property.title}`, {
            parameters: { lead_id: leadId, property_id, new_price_lakhs: priceForMessage },
            result: { vapi_call_id: result.callId },
          })

          lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'called', vapi_call_id: result.callId })
          triggeredCount += 1
        } else {
          await ctx.act('negotiation_call_failed', `Vapi call failed for ${lead.name}`, {
            parameters: { lead_id: leadId },
            error: result.error || 'vapi_error',
          })
          lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'failed', error: result.error })
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      await ctx.think(
        'result_analysis',
        `Price Drop Negotiator complete for ${property.title} (Rs ${priceForMessage}L). Triggered ${triggeredCount} / ${batch.length} outbound call(s). ${batch.length - triggeredCount} failed or were skipped.`,
        {
          confidence: 0.95,
          metadata: { triggered: triggeredCount, total: batch.length, property_id },
        }
      )

      return {
        triggered_calls: triggeredCount,
        total_scanned: batch.length,
        property: { id: property_id, title: property.title, new_price_lakhs: priceForMessage },
        lead_details,
        summary: `Price-drop event for ${property.title}: notified ${triggeredCount} lead(s) with budget objections.`,
      }
    },
  })
}
