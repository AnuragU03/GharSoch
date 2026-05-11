import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { authErrorResponse, requireRole } from '@/lib/auth';
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

    // Phase 11.5: stamp ingested leads with session.user.brokerage_id.
    const data = await request.json();
    
    // Validate basics
    if (!data.name || !data.phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }

    // Gracefully handle missing DB
    if (!process.env.DATABASE_URL) {
      console.log('[Mock DB] Ingested Lead:', data.name, data.phone);
      return NextResponse.json({ success: true, message: 'Mock lead ingested (No DB Configured)' });
    }

    const clientProfiles = await getCollection('client_profiles');
    
    // Check if exists
    const query: any = { phone: data.phone };
    if (brokerId) query.broker_id = brokerId;
    const existing = await clientProfiles.findOne(query);
    if (existing) {
      return NextResponse.json({ success: true, message: 'Lead already exists', id: existing._id });
    }

    const newLead = {
      name: data.name,
      phone: data.phone,
      email: data.email || '',
      budget: data.budget || '',
      location_prefs: data.location_prefs || [],
      property_type: data.property_type || '',
      lead_temperature: 'warm',
      tc_consent: false,
      do_not_call: false,
      broker_id: brokerId,
      created_at: new Date().toISOString(),
    };

    const result = await clientProfiles.insertOne(newLead);

    return NextResponse.json({ 
      success: true, 
      message: 'Lead successfully ingested', 
      id: result.insertedId 
    });

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('Lead Webhook Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
