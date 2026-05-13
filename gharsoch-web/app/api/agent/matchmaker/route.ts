import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import OpenAI from 'openai'
import { authErrorResponse, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
    if (!isCronAuthorized) {
      await requireRole(['admin', 'tech'])
    }
    // Phase 11.5: filter matchmaker candidate leads/properties by session.user.brokerage_id.
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leadsCollection = await getCollection('leads')
    const propertiesCollection = await getCollection('properties')

    // Fetch unmatched clients (status: new or qualification_status: unqualified)
    const clients = await leadsCollection.find({
      status: 'new',
      dnd_status: { $ne: true },
      is_deleted: { $ne: true }
    }).toArray()

    if (clients.length === 0) {
      const agentLogsCollection = await getCollection('agent_logs')
      await agentLogsCollection.insertOne({
        agent_name: 'The Matchmaker',
        action: 'Scan complete. No new unmatched clients found in the pipeline.',
        status: 'success',
        created_at: new Date()
      })
      return NextResponse.json({ success: true, message: 'No unmatched clients found.' })
    }

    // Fetch all available properties
    const properties = await propertiesCollection.find({
      is_deleted: { $ne: true },
      status: 'available'
    }).toArray()

    if (properties.length === 0) {
      const agentLogsCollection = await getCollection('agent_logs')
      await agentLogsCollection.insertOne({
        agent_name: 'The Matchmaker',
        action: `Scan complete. Found ${clients.length} clients to match but no available properties in inventory.`,
        status: 'success',
        created_at: new Date()
      })
      return NextResponse.json({ success: true, message: 'No available properties to match against.' })
    }

    // Prepare data for OpenAI
    const clientData = clients.map(c => ({
      id: c._id.toString(),
      name: c.name,
      budget: c.budget_range,
      location: c.location_pref,
      type: c.property_type,
      timeline: c.timeline,
      notes: c.notes
    }))

    const propertyData = properties.map(p => ({
      id: p._id.toString(),
      title: p.title,
      price: p.price,
      location: p.location,
      type: p.type,
      bedrooms: p.bedrooms
    }))

    console.log(`[AI Matchmaker] Analyzing ${clientData.length} clients against ${propertyData.length} properties...`)

    // Ask OpenAI to find perfect matches
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert real estate matchmaker AI. Your job is to analyze a list of clients and a list of properties, and find any perfect or highly suitable matches based on budget, location, and property type.
          
          You must return a JSON object with a single array called "matches".
          Each object in the array should have:
          - client_id (string)
          - property_id (string)
          - match_reason (string, e.g., "Perfect budget fit and exact location match")
          - match_score (number between 1-100)
          
          Only return a match if the score would be 75 or higher. If there are no matches, return an empty array for "matches".`
        },
        {
          role: "user",
          content: JSON.stringify({
            clients: clientData,
            properties: propertyData
          })
        }
      ]
    })

    const result = JSON.parse(completion.choices[0].message.content || '{"matches": []}')
    const matches = result.matches || []

    let updatedCount = 0

    // Process matches
    for (const match of matches) {
      if (match.match_score >= 75) {
        const { ObjectId } = require('mongodb')
        const clientObjId = ObjectId.createFromHexString(match.client_id)

        // Update the lead record with match info
        await leadsCollection.updateOne(
          { _id: clientObjId },
          {
            $set: {
              qualification_status: 'matched',
              interest_level: 'warm',
              matched_property_id: match.property_id,
              notes: `[AI Matchmaker] Automatically matched with property ${match.property_id}. Reason: ${match.match_reason} (Score: ${match.match_score})`,
              updated_at: new Date()
            }
          }
        )

        // Also update the clients collection entry if it exists
        const clientsCollection = await getCollection('clients')
        await clientsCollection.updateOne(
          { _id: clientObjId },
          {
            $set: {
              status: 'matched',
              ai_match_status: 'matched',
              matched_property_id: match.property_id,
              matched_property_title: properties.find(p => p._id.toString() === match.property_id)?.title || match.property_id,
              match_score: match.match_score,
              match_reason: match.match_reason,
              updated_at: new Date()
            }
          }
        )

        updatedCount++
        console.log(`[AI Matchmaker] Matched client ${match.client_id} to property ${match.property_id}`)
      }
    }

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'The Matchmaker',
      action: `Scanned ${clientData.length} clients. Found ${updatedCount} matches.`,
      status: 'success',
      created_at: new Date()
    })

    return NextResponse.json({
      success: true,
      message: `Matchmaker run complete. Found ${updatedCount} matches out of ${clientData.length} clients.`,
      matches_found: updatedCount,
      matches_data: matches
    })

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Agent/Matchmaker] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute AI matchmaker' },
      { status: 500 }
    )
  }
}
