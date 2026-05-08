import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createEvent } from '@/lib/googleCalendar';

export async function POST(request: NextRequest) {
  try {
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
    console.error('Scheduler API Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
