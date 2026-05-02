import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id
    
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 })
    }

    const callsCollection = await getCollection('calls')
    
    // Fetch calls where lead_id matches the requested ID, sort by newest first
    const calls = await callsCollection
      .find({ lead_id: leadId })
      .sort({ created_at: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      data: calls
    })
  } catch (error) {
    console.error('[API/Calls/Lead] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch call history' },
      { status: 500 }
    )
  }
}
