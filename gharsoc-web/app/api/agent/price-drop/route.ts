import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

// This endpoint should be triggered when a property price is lowered
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET // Optional, depending on if it's an admin internal call

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In a real scenario, you'd probably check for an Admin JWT here
      // return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { property_id, new_price_lakhs } = await request.json()

    if (!property_id || !new_price_lakhs) {
      return NextResponse.json({ success: false, error: 'Missing property_id or new_price_lakhs' }, { status: 400 })
    }

    const leadsCollection = await getCollection('leads')
    const propertiesCollection = await getCollection('properties')
    const callsCollection = await getCollection('calls')

    const property = await propertiesCollection.findOne({ _id: new ObjectId(property_id) })
    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found' }, { status: 404 })
    }

    // Find leads who:
    // 1. Have price/budget objections
    // 2. Are looking in the same location
    // 3. Haven't opted out of calls
    const targetLeads = await leadsCollection.find({
      dnd_status: { $ne: true },
      objections: { $regex: /price|expensive|budget|cost/i },
      location_pref: { $regex: new RegExp(property.location, 'i') }
    }).limit(20).toArray() // Limit to 20 to avoid spamming too many at once

    if (targetLeads.length === 0) {
      return NextResponse.json({ success: true, message: 'No leads found matching price objections for this location', triggered: 0 })
    }

    let triggeredCount = 0

    for (const lead of targetLeads) {
      // Trigger the call via Vapi Outbound Assistant
      const result = await triggerCampaignCall(
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
          script_template: `Great news! You previously mentioned that properties in ${property.location} were a bit outside your budget. The builder for ${property.title} just dropped the price to ${new_price_lakhs} Lakhs! Are you still interested in scheduling a visit?`,
        }
      )

      if (result.success) {
        // Log the call creation
        await callsCollection.insertOne({
          lead_id: lead._id.toString(),
          lead_name: lead.name,
          lead_phone: lead.phone,
          agent_name: 'Arya Outbound',
          agent_id: process.env.VAPI_ASSISTANT_OUTBOUND_ID || 'system',
          campaign_id: `price-drop-${property_id}`,
          direction: 'outbound',
          call_type: 'negotiation',
          duration: 0,
          disposition: 'queued',
          call_outcome: 'pending',
          vapi_call_id: result.callId,
          created_at: new Date(),
        })

        // Update the lead notes
        await leadsCollection.updateOne(
          { _id: lead._id },
          { 
            $set: { 
              status: 'contacted', 
              updated_at: new Date(),
              notes: `${lead.notes || ''}\n[System] Triggered price drop negotiation call for property ${property.title}.`
            }
          }
        )

        triggeredCount++
      }
      
      // Delay slightly between calls to avoid hitting Vapi rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'The Price Drop Negotiator',
      action: `Scanned ${targetLeads.length} leads with budget objections for ${property.title}. Triggered ${triggeredCount} negotiation calls.`,
      status: 'success',
      created_at: new Date()
    })

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} price drop negotiation calls`,
      triggered: triggeredCount,
      total_due: targetLeads.length
    })

  } catch (error) {
    console.error('[API/Agent/PriceDrop] POST Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute price drop negotiator' },
      { status: 500 }
    )
  }
}
