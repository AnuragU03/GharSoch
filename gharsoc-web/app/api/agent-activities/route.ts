import { NextResponse } from 'next/server'
import { getCollection, getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()

    // Ensure agent_logs collection exists — create it if not
    const collections = await db.listCollections({ name: 'agent_logs' }).toArray()
    if (collections.length === 0) {
      // Initialize the collection so future writes work
      await db.createCollection('agent_logs')
    }

    const agentLogsCollection = db.collection('agent_logs')
    const logs = await agentLogsCollection
      .find({})
      .sort({ created_at: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('[API/AgentActivities] GET Error:', error)
    // Return empty instead of crashing — collection may not exist yet
    return NextResponse.json({ success: true, data: [] })
  }
}
