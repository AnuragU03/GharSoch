import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/runAgent'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

/**
 * POST /api/agent/price-drop
 * The Price Drop Negotiator — trigger: 'event'
 * Fired in-process from app/api/properties/route.ts PATCH when price decreases.
 * Phase 3.5 will wire the event dispatch; for now the route is callable directly.
 * Finds leads who rejected a property on price grounds and calls them with the news.
 */
export async function POST(request: NextRequest) {
  // ── Auth — event routes still require x-cron-secret for manual/cron calls;
  // when called in-process from properties PATCH, the header is forwarded there.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, any> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { property_id, new_price, new_price_lakhs, old_price } = body

  // Resolve price in Lakhs for the script
  const parsedLakhs = Number(new_price_lakhs)
  const parsedRaw = Number(new_price)
  const priceForMessage =
    Number.isFinite(parsedLakhs) && parsedLakhs > 0
      ? parsedLakhs
      : Number.isFinite(parsedRaw) && parsedRaw > 0
        ? Math.round(parsedRaw / 100_000)
        : null

  if (!property_id || !priceForMessage) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: property_id, new_price (or new_price_lakhs)' },
      { status: 400 }
    )
  }

  let propertyObjectId: ObjectId
  try {
    propertyObjectId = new ObjectId(property_id)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid property_id' }, { status: 400 })
  }

  try {
    const { runId, output } = await runAgent({
      agentId: 'price_drop_negotiator',
      agentName: 'The Price Drop Negotiator',
      trigger: 'event',          // This is intentionally 'event' even while on cron invocation
      input: {
        property_id,
        new_price,
        new_price_lakhs: priceForMessage,
        old_price: old_price ?? null,
        event: 'property.price_dropped',
      },
      metadata: { event_type: 'price_drop', property_id },

      handler: async (ctx) => {
        // ── Step 1: evaluation ─────────────────────────────────────────────
        await ctx.think('evaluation',
          `Price drop event received for property ${property_id}. New price: ₹${priceForMessage}L. Looking up property details and scanning for leads with price/budget objections in this location.`,
          { confidence: 1.0, metadata: { property_id, new_price_lakhs: priceForMessage } }
        )

        const property = await ctx.db.findOne('properties', { _id: propertyObjectId })
        if (!property) {
          await ctx.think('result_analysis', `Property ${property_id} not found in DB. Aborting.`, { confidence: 1.0 })
          return {
            triggered_calls: 0,
            total_scanned: 0,
            summary: `Property ${property_id} not found.`,
          }
        }

        // Find leads with price-related objections in the same location
        const targetLeads = await ctx.db.findMany('leads', {
          dnd_status: { $ne: true },
          $or: [
            { objections: { $regex: /price|expensive|budget|cost|afford/i } },
            { objection: { $regex: /price|expensive|budget|cost|afford/i } },
            { notes: { $regex: /price|expensive|budget|too costly|out of budget/i } },
          ],
          location_pref: { $regex: new RegExp((property as any).location || '', 'i') },
        })

        const batch = (targetLeads as any[]).slice(0, 20)

        // ── Step 2: decision ───────────────────────────────────────────────
        await ctx.think('decision',
          batch.length === 0
            ? `No leads with budget objections matched location "${(property as any).location}". No calls needed.`
            : `Found ${batch.length} lead(s) with price objections near ${(property as any).location}. Will call each with the ₹${priceForMessage}L price drop news for ${(property as any).title}.`,
          {
            confidence: 0.95,
            metadata: {
              property_title: (property as any).title,
              property_location: (property as any).location,
              eligible_leads: batch.length,
            },
          }
        )

        if (batch.length === 0) {
          return {
            triggered_calls: 0,
            total_scanned: 0,
            property: { id: property_id, title: (property as any).title },
            summary: `No leads with budget objections matched "${(property as any).location}".`,
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
              script_template: `Great news! You previously mentioned that properties in ${(property as any).location} were outside your budget. The builder just dropped the price of ${(property as any).title} to ₹${priceForMessage} Lakhs — a significant reduction. Would you like to revisit and schedule a site visit?`,
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

            await ctx.db.updateOne('leads', { _id: lead._id }, {
              $set: {
                status: 'contacted',
                updated_at: new Date(),
                last_contacted_at: new Date(),
              },
              $push: {
                notes_history: `[Price Drop Negotiator] Called re: ${(property as any).title} price drop to ₹${priceForMessage}L`,
              } as any,
            })

            await ctx.act('negotiation_call_triggered', `Price-drop call queued for ${lead.name} re: ${(property as any).title}`, {
              parameters: { lead_id: leadId, property_id, new_price_lakhs: priceForMessage },
              result: { vapi_call_id: result.callId },
            })

            lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'called', vapi_call_id: result.callId })
            triggeredCount++
          } else {
            await ctx.act('negotiation_call_failed', `Vapi call failed for ${lead.name}`, {
              parameters: { lead_id: leadId },
              error: result.error || 'vapi_error',
            })
            lead_details.push({ lead_id: leadId, lead_name: lead.name, status: 'failed', error: result.error })
          }

          await new Promise((r) => setTimeout(r, 1000))
        }

        // ── Step 3: result_analysis ───────────────────────────────────────
        await ctx.think('result_analysis',
          `Price Drop Negotiator complete for ${(property as any).title} (₹${priceForMessage}L). Triggered ${triggeredCount} / ${batch.length} outbound call(s). ${batch.length - triggeredCount} failed or skipped.`,
          {
            confidence: 0.95,
            metadata: { triggered: triggeredCount, total: batch.length, property_id },
          }
        )

        return {
          triggered_calls: triggeredCount,
          total_scanned: batch.length,
          property: { id: property_id, title: (property as any).title, new_price_lakhs: priceForMessage },
          lead_details,
          summary: `Price-drop event for ${(property as any).title}: notified ${triggeredCount} lead(s) with budget objections.`,
        }
      },
    })

    return NextResponse.json({
      success: true,
      runId,
      triggered: (output as any)?.triggered_calls ?? 0,
      total_due: (output as any)?.total_scanned ?? 0,
      property: (output as any)?.property ?? {},
      summary: (output as any)?.summary ?? '',
    })

  } catch (error: any) {
    console.error('[Agent/PriceDrop] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Price Drop Negotiator run failed', run_id: error?.runId },
      { status: 500 }
    )
  }
}
