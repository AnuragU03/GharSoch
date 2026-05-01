import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { triggerCampaignCall } from '@/lib/vapiClient'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { campaignId, leadId } = data

    // Single lead trigger
    if (leadId) {
      const leads = await getCollection('leads')
      const lead = await leads.findOne({ _id: new ObjectId(leadId) })

      if (!lead) {
        return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
      }

      if (lead.dnd_status) {
        return NextResponse.json({ success: false, error: 'Lead is on DNC list' }, { status: 403 })
      }

      const result = await triggerCampaignCall({
        phone: lead.phone,
        name: lead.name,
        budget_range: lead.budget_range,
        location_pref: lead.location_pref,
        property_type: lead.property_type,
        notes: lead.notes,
      })

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 502 })
      }

      // Update lead's last contacted timestamp
      await leads.updateOne(
        { _id: new ObjectId(leadId) },
        { $set: { last_contacted_at: new Date(), updated_at: new Date() }, $inc: { total_calls: 1 } }
      )

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

      for (const lead of targetLeads) {
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
          }
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
        results,
      })
    }

    return NextResponse.json({ success: false, error: 'leadId or campaignId is required' }, { status: 400 })
  } catch (error) {
    console.error('[Campaign Trigger] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
