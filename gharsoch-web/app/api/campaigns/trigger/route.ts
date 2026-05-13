import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'
import { authErrorResponse, requireRole } from '@/lib/auth'
import { leadHasRecentOutboundCall } from '@/lib/services/callService'
import { auth } from '@/lib/auth'
import { requireBrokerId, BrokerScopeMissingError } from '@/lib/auth/requireBroker'

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    const session = await auth()
    
    let brokerId: string;
    try {
      brokerId = requireBrokerId(session);
    } catch (e) {
      if (e instanceof BrokerScopeMissingError) {
        return NextResponse.json(
          { error: "broker_scope_missing", message: "Your account is not provisioned for a brokerage. Contact admin." },
          { status: 403 }
        );
      }
      throw e;
    }
    // Phase 11.5: verify campaign/lead belongs to session.user.brokerage_id.
    const data = await request.json()
    const { campaignId, leadId } = data

    // Single lead trigger
    if (leadId) {
      const leads = await getCollection('leads')
      const lead = await leads.findOne({ _id: new ObjectId(leadId), is_deleted: { $ne: true } })

      if (!lead) {
        return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
      }

      if (lead.dnd_status) {
        return NextResponse.json({ success: false, error: 'Lead is on DNC list' }, { status: 403 })
      }

      const cooldownMins = parseInt(process.env.OUTBOUND_COOLDOWN_MINUTES || '240')
      if (await leadHasRecentOutboundCall(lead._id, cooldownMins)) {
        return NextResponse.json({
          success: false,
          error: 'cooldown',
          message: `Lead contacted within ${cooldownMins}m cooldown window`,
          lead_id: lead._id.toString(),
        }, { status: 429 })
      }

      // Fetch premium properties for this lead's city to inject into Vapi memory
      const properties = await getCollection('properties')
      const matchingProperties = await properties.find({ 
        is_deleted: { $ne: true },
        city: { $regex: new RegExp(`^${lead.place || 'Ahmedabad'}$`, 'i') },
        status: 'available' 
      }).limit(5).toArray()

      const propertiesContext = matchingProperties.map(p => 
        `- ${p.title} by ${p.builder}: ${p.type} in ${p.location}, ₹${(p.price/100000).toFixed(2)} Lakhs, ${p.area_sqft} sqft. Amenities: ${p.amenities.slice(0, 3).join(', ')}.`
      ).join('\n')

      const result = await triggerCampaignCall({
        phone: lead.phone,
        name: lead.name,
        budget_range: lead.budget_range,
        location_pref: lead.location_pref,
        property_type: lead.property_type,
        notes: lead.notes,
      }, undefined, propertiesContext)

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 502 })
      }

      // Update lead's last contacted timestamp
      await leads.updateOne(
        { _id: new ObjectId(leadId) },
        { $set: { last_contacted_at: new Date(), updated_at: new Date() }, $inc: { total_calls: 1 } }
      )

      // Immediately save an initial call log so it appears in the UI right away
      const calls = await getCollection('calls')
      await calls.insertOne({
        lead_id: lead._id.toString(),
        lead_name: lead.name || '',
        lead_phone: lead.phone,
        agent_name: 'GharSoch AI',
        agent_id: '',
        campaign_id: '',
        direction: 'outbound',
        call_type: 'outbound',
        duration: 0,
        disposition: '',
        call_outcome: '',
        call_summary: '',
        customer_availability: '',
        preferred_callback_time: '',
        preferred_callback_days: [],
        customer_interest_level: '',
        follow_up_required: false,
        follow_up_date: null,
        follow_up_notes: '',
        key_requirements: '',
        customer_objections: '',
        next_steps: '',
        recording_url: '',
        transcript: '',
        trai_compliant: true,
        call_status: 'in-progress',
        vapi_call_id: result.callId || '',
        created_at: new Date(),
        updated_at: new Date(),
      })

      return NextResponse.json({
        success: true,
        message: 'Call triggered',
        callId: result.callId,
      })
    }

    // Campaign bulk trigger
    if (campaignId) {
      const campaigns = await getCollection('campaigns')
      const campaign = await campaigns.findOne({ _id: new ObjectId(campaignId) })

      if (!campaign) {
        return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
      }

      const leads = await getCollection('leads')
      const targetLeads = await leads.find({
        _id: { $in: campaign.target_lead_ids.map((id: string) => new ObjectId(id)) },
        dnd_status: { $ne: true },
        is_deleted: { $ne: true },
      }).toArray()

      if (targetLeads.length === 0) {
        return NextResponse.json({ success: false, error: 'No eligible leads found' }, { status: 400 })
      }

      // Update campaign status
      await campaigns.updateOne(
        { _id: new ObjectId(campaignId) },
        { $set: { status: 'active', updated_at: new Date() } }
      )

      const results: { leadId: string; success: boolean; callId?: string; error?: string }[] = []
      const cooldownSkips: { lead_id: string; reason: string }[] = []
      const cooldownMins = parseInt(process.env.OUTBOUND_COOLDOWN_MINUTES || '240')
      const propertiesColl = await getCollection('properties')
      const callsCol = await getCollection('calls')

      for (const lead of targetLeads) {
        if (await leadHasRecentOutboundCall(lead._id, cooldownMins)) {
          cooldownSkips.push({
            lead_id: lead._id.toString(),
            reason: `Lead contacted within ${cooldownMins}m cooldown window`,
          })
          continue
        }

        // Fetch premium properties for this lead's city to inject into Vapi memory
        const matchingProperties = await propertiesColl.find({ 
          is_deleted: { $ne: true },
          city: { $regex: new RegExp(`^${lead.place || 'Ahmedabad'}$`, 'i') },
          status: 'available' 
        }).limit(5).toArray()

        const propertiesContext = matchingProperties.map(p => 
          `- ${p.title} by ${p.builder}: ${p.type} in ${p.location}, ₹${(p.price/100000).toFixed(2)} Lakhs, ${p.area_sqft} sqft. Amenities: ${p.amenities.slice(0, 3).join(', ')}.`
        ).join('\n')

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
            campaign_name: campaign.name,
            script_template: campaign.script_template,
          },
          propertiesContext
        )

        results.push({
          leadId: lead._id.toString(),
          success: result.success,
          callId: result.callId,
          error: result.error,
        })

        if (result.success) {
          await leads.updateOne(
            { _id: lead._id },
            { $set: { last_contacted_at: new Date(), updated_at: new Date() }, $inc: { total_calls: 1 } }
          )

          const resultWithId = result as typeof result & { id?: string }
          const vapiCallId = result.callId || resultWithId.id
          if (vapiCallId) {
            try {
              await callsCol.insertOne({
                lead_id: lead._id,
                vapi_call_id: vapiCallId,
                direction: 'outbound',
                status: 'initiated',
                customer_number: lead.phone,
                agent_name: 'Campaign Conductor',
                campaign_id: campaign._id,
                triggered_by: 'campaign_bulk',
                created_at: new Date(),
                updated_at: new Date(),
              })
            } catch (err) {
              console.error(
                '[CAMPAIGNS BULK] Failed to log call to calls collection:',
                (err as Error).message,
                'lead_id:',
                lead._id.toString(),
                'vapi_call_id:',
                vapiCallId
              )
            }
          }
        }

        // 2 second delay between calls to avoid carrier throttling
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      const successCount = results.filter(r => r.success).length
      await campaigns.updateOne(
        { _id: new ObjectId(campaignId) },
        { $inc: { calls_made: successCount }, $set: { updated_at: new Date() } }
      )

      return NextResponse.json({
        success: true,
        message: `${successCount}/${targetLeads.length} calls triggered`,
        dialed: successCount,
        skipped: cooldownSkips.length,
        cooldown_skips: cooldownSkips,
        results,
      })
    }

    return NextResponse.json({ success: false, error: 'leadId or campaignId is required' }, { status: 400 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[Campaign Trigger] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
