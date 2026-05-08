import { NextResponse } from 'next/server'
import { getCollection, getDb } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()

    // Ensure agent_logs collection exists; create it if not.
    const collections = await db.listCollections({ name: 'agent_logs' }).toArray()
    if (collections.length === 0) {
      // Initialize the collection so future writes work
      await db.createCollection('agent_logs')
    }

    const agentLogsCollection = db.collection('agent_logs')
    // NOTE: Cosmos DB rejects .sort() on un-indexed fields.
    // Fetch without sort, then sort in JavaScript.
    const logs = await agentLogsCollection
      .find({})
      .limit(100)
      .toArray()

    // Sort by created_at descending in JavaScript
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const latest = logs.slice(0, 50)

    return NextResponse.json({ success: true, data: latest })
  } catch (error) {
    console.error('[API/AgentActivities] GET Error:', error)
    // Return empty instead of crashing if the collection is unavailable.
    return NextResponse.json({ success: true, data: [] })
  }
}
