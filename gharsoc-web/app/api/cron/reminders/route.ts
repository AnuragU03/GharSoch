import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { triggerReminderCall } from '@/lib/vapiClient'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

// This endpoint should be triggered by a Cron job every morning at 9:00 AM
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const appointmentsCollection = await getCollection('appointments')
    const leadsCollection = await getCollection('leads')
    const propertiesCollection = await getCollection('properties')
    const callsCollection = await getCollection('calls')

    const now = new Date()
    // Look for appointments in the next 48 hours
    const tomorrowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const dueAppointments = await appointmentsCollection.find({
      status: 'scheduled',
      reminder_sent: { $ne: true },
      scheduled_at: { $gte: now, $lte: tomorrowEnd }
    }).toArray()

    if (dueAppointments.length === 0) {
      const agentLogsCollection = await getCollection('agent_logs')
      await agentLogsCollection.insertOne({
        agent_name: 'The Appointment Guardian',
        action: 'Scan complete. No upcoming appointments in the next 48 hours need reminders.',
        status: 'success',
        created_at: new Date()
      })
      return NextResponse.json({ success: true, message: 'No upcoming appointments found for reminders', triggered: 0 })
    }

    let triggeredCount = 0

    for (const appt of dueAppointments) {
      // Fetch lead details
      const lead = await leadsCollection.findOne({ _id: new ObjectId(appt.lead_id) })
      // Fetch property details
      const property = await propertiesCollection.findOne({ _id: new ObjectId(appt.property_id) })

      if (!lead || !property) {
        console.error(`[API/Cron/Reminders] Missing lead or property for appointment ${appt._id}`)
        continue
      }

      // Check DND
      if (lead.dnd_status === true) {
        continue
      }

      const result = await triggerReminderCall({
        _id: appt._id,
        lead_name: lead.name,
        lead_phone: lead.phone,
        property_title: property.title,
        property_location: property.location,
        scheduled_at: appt.scheduled_at
      })

      if (result.success) {
        // Mark reminder as sent so we don't call them twice for the same appointment
        await appointmentsCollection.updateOne(
          { _id: appt._id },
          { $set: { reminder_sent: true } }
        )

        // Log the call creation
        await callsCollection.insertOne({
          lead_id: lead._id.toString(),
          lead_name: lead.name,
          lead_phone: lead.phone,
          agent_name: 'Arya Reminder',
          agent_id: process.env.VAPI_ASSISTANT_REMINDER_ID || 'system',
          campaign_id: 'auto-reminders',
          direction: 'outbound',
          call_type: 'reminder',
          duration: 0,
          disposition: 'queued',
          call_outcome: 'pending',
          vapi_call_id: result.callId,
          created_at: new Date(),
        })

        triggeredCount++
      }
      
      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'The Appointment Guardian',
      action: `Scanned ${dueAppointments.length} upcoming appointments. Triggered ${triggeredCount} reminder calls.`,
      status: 'success',
      created_at: new Date()
    })

    return NextResponse.json({
      success: true,
      message: `Triggered ${triggeredCount} appointment reminder calls`,
      triggered: triggeredCount,
      total_due: dueAppointments.length
    })

  } catch (error) {
    console.error('[API/Cron/Reminders] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute reminders cron job' },
      { status: 500 }
    )
  }
}
