import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createEvent } from '@/lib/googleCalendar';
import { authErrorResponse, requireRole } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: verify scheduled event belongs to session.user.brokerage_id.
    const body = await request.json();
    const { action, timeMin, timeMax, summary, description, startTime, endTime, attendees } = body;

    if (action === 'check_availability') {
      if (!timeMin || !timeMax) {
        return NextResponse.json({ success: false, error: 'timeMin and timeMax are required' }, { status: 400 });
      }
      const result = await checkAvailability(timeMin, timeMax);
      return NextResponse.json(result);
    } 
    
    if (action === 'create_event') {
      if (!summary || !startTime || !endTime) {
        return NextResponse.json({ success: false, error: 'summary, startTime, and endTime are required' }, { status: 400 });
      }
      const result = await createEvent(summary, description || '', startTime, endTime, attendees || []);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('Scheduler API Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
