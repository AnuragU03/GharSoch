import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { leadId } = data;

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 });
    }

    // Gracefully handle missing DB
    if (!process.env.DATABASE_URL) {
      console.log(`[Mock DB] Attempting to trigger call for lead: ${leadId}`);
      return NextResponse.json({ success: true, message: 'Mock call triggered' });
    }

    const clientProfiles = await getCollection('client_profiles');
    
    // Find the lead
    const lead = await clientProfiles.findOne({ _id: leadId });
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    // Call Vapi Outbound API
    const VAPI_API_KEY = process.env.VAPI_API_KEY;
    const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!VAPI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ success: false, error: 'Vapi API Key or Assistant ID missing in environment' }, { status: 500 });
    }

    const vapiResponse = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: ASSISTANT_ID,
        customer: {
          number: lead.phone,
          name: lead.name,
        },
      }),
    });

    if (!vapiResponse.ok) {
      const errorData = await vapiResponse.text();
      console.error('[Vapi Error]', errorData);
      return NextResponse.json({ success: false, error: 'Failed to trigger Vapi call' }, { status: 502 });
    }

    const vapiData = await vapiResponse.json();

    return NextResponse.json({ 
      success: true, 
      message: 'Call successfully queued', 
      callId: vapiData.id 
    });

  } catch (error) {
    console.error('Campaign Trigger Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
