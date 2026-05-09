import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { authErrorResponse, requireRole } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
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
    const existing = await clientProfiles.findOne({ phone: data.phone });
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
