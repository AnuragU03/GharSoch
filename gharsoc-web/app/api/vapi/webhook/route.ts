import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    // ── Tool Calls (real-time during voice call) ──
    if (payload.message?.type === 'tool-calls') {
      const toolCalls = payload.message.toolCalls
      const results: any[] = []

      for (const toolCall of toolCalls) {
        const { function: fn, id: toolCallId } = toolCall
        const args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments
        console.log(`[VAPI Webhook] Tool: ${fn.name}`, args)

        let resultData: any

        try {
          switch (fn.name) {
            case 'search_properties': {
              const properties = await getCollection('properties')
              const filter: Record<string, any> = { status: 'available' }

              if (args.location) filter.location = { $regex: args.location, $options: 'i' }
              if (args.city) filter.city = { $regex: args.city, $options: 'i' }
              if (args.property_type) filter.type = { $regex: args.property_type, $options: 'i' }
              if (args.bedrooms) filter.bedrooms = args.bedrooms
              if (args.budget_min || args.budget_max) {
                filter.price = {}
                if (args.budget_min) filter.price.$gte = args.budget_min
                if (args.budget_max) filter.price.$lte = args.budget_max
              }

              const matches = await properties.find(filter).limit(5).toArray()
              resultData = {
                found: matches.length,
                properties: matches.map(p => ({
                  title: p.title,
                  type: p.type,
                  location: p.location,
                  city: p.city,
                  price: p.price >= 10000000 ? `₹${(p.price / 10000000).toFixed(1)} Crores` : `₹${(p.price / 100000).toFixed(0)} Lakhs`,
                  price_raw: p.price,
                  area: `${p.area_sqft} sqft`,
                  area_sqft: p.area_sqft,
                  bedrooms: p.bedrooms,
                  builder: p.builder,
                  amenities: p.amenities || [],
                  description: p.description,
                  status: p.status,
                })),
              }
              break
            }

            case 'qualify_lead': {
              const leads = await getCollection('leads')
              const updateData: Record<string, any> = {
                updated_at: new Date(),
              }
              if (args.budget_range) updateData.budget_range = args.budget_range
              if (args.location_pref) updateData.location_pref = args.location_pref
              if (args.property_type) updateData.property_type = args.property_type
              if (args.timeline) updateData.timeline = args.timeline
              if (args.interest_level) updateData.interest_level = args.interest_level
              if (args.objections) updateData.objections = args.objections
              if (args.customer_requirements) updateData.customer_requirements = args.customer_requirements

              if (args.interest_level === 'hot') {
                updateData.qualification_status = 'qualified'
                updateData.lead_score = 80
              } else if (args.interest_level === 'warm') {
                updateData.qualification_status = 'qualified'
                updateData.lead_score = 50
              } else if (args.interest_level === 'cold') {
                updateData.lead_score = 20
              }

              const result = await leads.updateOne(
                { phone: args.customer_phone },
                { $set: updateData }
              )

              if (result.matchedCount === 0 && args.customer_phone) {
                await leads.insertOne({
                  name: args.customer_name || 'Unknown',
                  phone: args.customer_phone,
                  email: '',
                  source: 'inbound_call',
                  status: 'contacted',
                  dnd_status: false,
                  place: args.location_pref || '',
                  notes: '',
                  preferred_contact_time: '',
                  availability_window: '',
                  availability_days: [],
                  follow_up_count: 0,
                  total_calls: 1,
                  first_call_completed: true,
                  last_contacted_at: new Date(),
                  next_follow_up_date: null,
                  assigned_agent_id: '',
                  created_at: new Date(),
                  ...updateData,
                })
                resultData = { status: 'created', message: 'New lead created and qualified' }
              } else {
                resultData = { status: 'updated', message: 'Lead qualification updated' }
              }
              break
            }

            case 'book_appointment': {
              const appointments = await getCollection('appointments')
              const leads = await getCollection('leads')

              const lead = await leads.findOne({ phone: args.customer_phone })
              const properties = await getCollection('properties')
              const property = args.property_title
                ? await properties.findOne({ title: { $regex: args.property_title, $options: 'i' } })
                : null

              const scheduledAt = new Date(args.preferred_date)
              if (args.preferred_time) {
                const [hours, minutes] = args.preferred_time.split(':').map(Number)
                if (!isNaN(hours)) scheduledAt.setHours(hours, minutes || 0)
              }

              await appointments.insertOne({
                lead_id: lead?._id?.toString() || '',
                property_id: property?._id?.toString() || '',
                agent_id: '',
                scheduled_at: scheduledAt,
                status: 'scheduled',
                reminder_sent: false,
                notes: args.notes || '',
                lead_name: lead?.name || 'Unknown',
                lead_phone: args.customer_phone,
                property_title: args.property_title || '',
                property_location: property?.location || '',
                created_at: new Date(),
                updated_at: new Date(),
              })

              resultData = {
                status: 'booked',
                message: `Appointment booked for ${scheduledAt.toLocaleDateString('en-IN')} at ${args.property_title || 'the property'}`,
                date: scheduledAt.toISOString(),
              }
              break
            }

            case 'schedule_callback': {
              const leads = await getCollection('leads')
              const scheduledAt = new Date(args.preferred_date)
              if (args.preferred_time) {
                const [hours, minutes] = args.preferred_time.split(':').map(Number)
                if (!isNaN(hours)) scheduledAt.setHours(hours, minutes || 0)
              }
              
              const result = await leads.updateOne(
                { phone: args.customer_phone },
                { $set: { next_follow_up_date: scheduledAt, status: 'follow_up', updated_at: new Date() } }
              )

              if (result.matchedCount === 0) {
                 resultData = { error: 'Lead not found to schedule callback' }
              } else {
                 resultData = { status: 'scheduled', message: `Callback scheduled for ${scheduledAt.toLocaleString()}` }
              }
              break
            }

            case 'mark_dnd': {
              const leads = await getCollection('leads')
              await leads.updateMany(
                { phone: args.phone },
                { $set: { dnd_status: true, updated_at: new Date() } }
              )
              resultData = { status: 'blocked', message: `${args.phone} added to DNC list` }
              break
            }

            case 'calculate_affordability': {
              const income = args.monthly_income || 0
              const expenses = (args.existing_emis || 0) + (args.monthly_expenses || 0)
              const surplus = income - expenses
              const loanAmount = (args.property_price || 0) - (args.down_payment || 0)
              const emi = loanAmount * 0.008 // Rough 8% over 20 years

              let signal: string
              let message: string

              if (surplus >= emi * 1.5) {
                signal = 'Go'
                message = `Comfortably affordable. EMI ≈ ₹${Math.round(emi).toLocaleString()}/month, surplus ₹${Math.round(surplus).toLocaleString()}/month.`
              } else if (surplus >= emi) {
                signal = 'Reconsider'
                message = `Tight budget. EMI ≈ ₹${Math.round(emi).toLocaleString()}/month would consume most surplus.`
              } else {
                signal = 'No-Go'
                message = `Cannot afford. EMI ≈ ₹${Math.round(emi).toLocaleString()}/month exceeds surplus of ₹${Math.round(surplus).toLocaleString()}/month.`
              }

              resultData = { signal, message, emi: Math.round(emi), surplus: Math.round(surplus) }
              break
            }

            case 'confirm_appointment': {
              const appointments = await getCollection('appointments')
              await appointments.updateOne(
                { _id: new ObjectId(args.appointment_id) },
                { $set: { status: 'confirmed', updated_at: new Date() } }
              )
              resultData = { status: 'confirmed', message: 'Appointment confirmed' }
              break
            }

            case 'reschedule_appointment': {
              const appointments = await getCollection('appointments')
              const newDate = new Date(args.new_date)
              if (args.new_time) {
                const [h, m] = args.new_time.split(':').map(Number)
                if (!isNaN(h)) newDate.setHours(h, m || 0)
              }
              await appointments.updateOne(
                { _id: new ObjectId(args.appointment_id) },
                { $set: { scheduled_at: newDate, status: 'rescheduled', updated_at: new Date() } }
              )
              resultData = { status: 'rescheduled', message: `Rescheduled to ${newDate.toLocaleDateString('en-IN')}` }
              break
            }

            case 'cancel_appointment': {
              const appointments = await getCollection('appointments')
              await appointments.updateOne(
                { _id: new ObjectId(args.appointment_id) },
                { $set: { status: 'cancelled', notes: args.reason || '', updated_at: new Date() } }
              )
              resultData = { status: 'cancelled', message: 'Appointment cancelled' }
              break
            }

            default:
              resultData = { error: `Unknown tool: ${fn.name}` }
          }
        } catch (toolError: any) {
          console.error(`[VAPI Webhook] Tool ${fn.name} error:`, toolError)
          resultData = { error: toolError.message }
        }

        results.push({ toolCallId, result: resultData })
      }

      return NextResponse.json({ results })
    }

    // ── End of Call Report (post-call processing) ──
    if (payload.message?.type === 'end-of-call-report') {
      console.log('[VAPI Webhook] Processing end-of-call-report...')

      // Handle both old and new VAPI payload formats
      const msgData = payload.message
      const callData = msgData.call || {}
      const artifactData = msgData.artifact || {}

      // Extract transcript — try multiple locations
      const transcript = msgData.transcript
        || artifactData.transcript
        || (Array.isArray(artifactData.messages)
          ? artifactData.messages
              .filter((m: any) => m.role && m.message)
              .map((m: any) => `${m.role === 'assistant' ? 'Agent' : 'Customer'}: ${m.message}`)
              .join('\n')
          : '')
        || ''

      const recordingUrl = msgData.recordingUrl || artifactData.recordingUrl || ''
      const duration = msgData.duration || 0
      const callId = callData.id || msgData.callId || ''
      const customerPhone = callData.customer?.number || msgData.customer?.number || ''
      const endedReason = msgData.endedReason || callData.endedReason || ''

      // Use VAPI's built-in analysis if available
      const vapiAnalysis = msgData.analysis || artifactData.analysis || {}

      // Use GPT-4 to extract structured data from the transcript
      let extractedData: any = {}

      if (vapiAnalysis.summary) {
        // Use VAPI analysis directly
        const sd = vapiAnalysis.structuredData || {}
        extractedData = {
          call_summary: vapiAnalysis.summary,
          disposition: sd.disposition || '',
          call_outcome: sd.call_outcome || sd.callOutcome || '',
          customer_interest_level: sd.customer_interest_level || sd.interestLevel || '',
          key_requirements: sd.key_requirements || sd.requirements || '',
          customer_objections: sd.customer_objections || sd.objections || '',
          follow_up_required: sd.follow_up_required || false,
          follow_up_notes: sd.follow_up_notes || '',
          next_steps: sd.next_steps || sd.nextSteps || '',
        }
      } else if (transcript && transcript.length > 20 && process.env.OPENAI_API_KEY) {
        try {
          const extraction = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are a post-call analyst. Extract structured data from a real estate call transcript. Return JSON with these fields:
                - call_summary: 2-3 sentence summary
                - disposition: one of [interested, not_interested, callback, voicemail, no_answer, wrong_number]
                - call_outcome: one of [appointment_booked, follow_up_needed, qualified, disqualified, dnc_requested]
                - customer_interest_level: one of [hot, warm, cold, not_interested]
                - key_requirements: what the customer wants
                - customer_objections: any objections raised
                - follow_up_required: boolean
                - follow_up_notes: if follow-up needed, what should happen
                - next_steps: recommended next action
                - sentiment_score: 0-100 (100 = very positive)`
              },
              { role: 'user', content: `Transcript:\n${transcript}` },
            ],
            response_format: { type: 'json_object' },
          })

          extractedData = JSON.parse(extraction.choices[0].message.content || '{}')
        } catch (err) {
          console.error('[VAPI Webhook] GPT extraction error:', err)
        }
      } else {
        // No meaningful transcript — infer from endedReason
        if (endedReason.includes('no-answer') || endedReason.includes('busy')) {
          extractedData = { disposition: 'no_answer', call_summary: `Call not answered. Reason: ${endedReason}` }
        } else if (endedReason.includes('voicemail')) {
          extractedData = { disposition: 'voicemail', call_summary: 'Call went to voicemail.' }
        }
      }

      // Find the lead by phone number
      const leads = await getCollection('leads')
      const lead = customerPhone ? await leads.findOne({ phone: customerPhone }) : null

      // Check if there's an existing call record (created at trigger time) to update
      const calls = await getCollection('calls')
      const existingCall = callId ? await calls.findOne({ vapi_call_id: callId }) : null

      const callRecord = {
        lead_id: lead?._id?.toString() || '',
        lead_name: lead?.name || '',
        lead_phone: customerPhone,
        agent_name: 'GharSoch AI',
        agent_id: callData.assistantId || '',
        campaign_id: '',
        direction: 'outbound',
        call_type: 'outbound',
        duration,
        disposition: extractedData.disposition || '',
        call_outcome: extractedData.call_outcome || '',
        call_summary: extractedData.call_summary || transcript.substring(0, 500),
        customer_availability: '',
        preferred_callback_time: '',
        preferred_callback_days: [],
        customer_interest_level: extractedData.customer_interest_level || '',
        follow_up_required: extractedData.follow_up_required || false,
        follow_up_date: extractedData.follow_up_required ? new Date(Date.now() + 86400000) : null,
        follow_up_notes: extractedData.follow_up_notes || '',
        key_requirements: extractedData.key_requirements || '',
        customer_objections: extractedData.customer_objections || '',
        next_steps: extractedData.next_steps || '',
        recording_url: recordingUrl,
        transcript,
        trai_compliant: true,
        call_status: 'completed',
        vapi_call_id: callId,
        updated_at: new Date(),
      }

      if (existingCall) {
        // Update the existing in-progress record
        await calls.updateOne(
          { _id: existingCall._id },
          { $set: callRecord }
        )
        console.log(`[VAPI Webhook] Updated existing call record ${existingCall._id}`)
      } else {
        // Insert new record (webhook arrived before polling or no trigger record)
        await calls.insertOne({
          ...callRecord,
          created_at: new Date(),
        })
        console.log('[VAPI Webhook] Created new call record')
      }

      // Update lead with extracted insights
      if (lead && extractedData.customer_interest_level) {
        const leadUpdate: Record<string, any> = {
          interest_level: extractedData.customer_interest_level,
          updated_at: new Date(),
          last_contacted_at: new Date(),
          first_call_completed: true,
        }
        if (extractedData.customer_interest_level === 'hot') {
          leadUpdate.qualification_status = 'qualified'
          leadUpdate.lead_score = Math.max(lead.lead_score || 0, 80)
        }
        if (extractedData.follow_up_required) {
          leadUpdate.next_follow_up_date = new Date(Date.now() + 86400000)
          leadUpdate.status = 'follow_up'
        }
        if (extractedData.customer_objections) {
          leadUpdate.objections = extractedData.customer_objections
        }

        await leads.updateOne({ _id: lead._id }, { $set: leadUpdate })
      }

      return NextResponse.json({ success: true, message: 'Call record saved' })
    }

    // ── Other message types ──
    console.log(`[VAPI Webhook] Message type: ${payload.message?.type}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[VAPI Webhook] Error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
