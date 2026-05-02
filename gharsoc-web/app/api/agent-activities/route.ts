import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'

export async function GET() {
  try {
    const agentLogsCollection = await getCollection('agent_logs')
    
    // Fetch the 50 most recent agent logs
    const logs = await agentLogsCollection
      .find({})
      .sort({ created_at: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json({
      success: true,
      data: logs
    })
  } catch (error) {
    console.error('[API/AgentActivities] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent activities' },
      { status: 500 }
    )
  }
}
