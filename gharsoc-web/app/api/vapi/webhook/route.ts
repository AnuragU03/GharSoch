import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createEvent } from '@/lib/googleCalendar';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Vapi sends various message types. We specifically want to intercept 'tool-calls'
    if (payload.message?.type === 'tool-calls') {
      const toolCalls = payload.message.toolCalls;
      const results: any[] = [];

      for (const toolCall of toolCalls) {
        const { function: fn, id: toolCallId } = toolCall;
        const args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments;

        console.log(`[VAPI Webhook] Tool Called: ${fn.name}`, args);

        let resultData: any;

        try {
          switch (fn.name) {
            case 'check_calendar_availability':
              resultData = await checkAvailability(args.timeMin, args.timeMax);
              break;

            case 'schedule_property_viewing':
              resultData = await createEvent(
                args.summary || 'GharSoch Property Viewing',
                args.description || 'Scheduled via GharSoch Voice Orchestrator',
                args.startTime,
                args.endTime,
                args.attendees
              );
              break;

            case 'calculate_affordability':
              // Simple mock implementation of affordability for the Voice Orchestrator
              // In a full implementation, this could call callAIAgent with the Financial Agent ID
              const { income, expenses, propertyPrice } = args;
              const surplus = income - expenses;
              const emi = propertyPrice * 0.008; // Rough estimate 8% over 20 years
              
              if (surplus >= emi * 1.5) {
                resultData = { signal: 'Go', message: 'Comfortably affordable' };
              } else if (surplus >= emi) {
                resultData = { signal: 'Reconsider', message: 'Tight budget, consider financial restructuring' };
              } else {
                resultData = { signal: 'No-Go', message: 'Cannot afford this property currently' };
              }
              break;

            default:
              resultData = { error: `Unknown tool: ${fn.name}` };
          }
        } catch (toolError: any) {
          resultData = { error: toolError.message };
        }

        // Vapi expects an array of results matching the tool call IDs
        results.push({
          toolCallId: toolCallId,
          result: resultData,
        });
      }

      return NextResponse.json({ results });
    }

    if (payload.message?.type === 'end-of-call-report') {
      console.log('[VAPI Webhook] Processing end-of-call-report...');
      const transcript = payload.message.transcript || '';
      
      // Basic extraction (in production, this goes to Post-Call Sync Agent via OpenAI)
      const sentimentScore = transcript.toLowerCase().includes('good') || transcript.toLowerCase().includes('yes') ? 0.8 : 0.5;
      const affordabilitySignal = transcript.toLowerCase().includes('salary') ? 'Reconsider' : 'Unknown';

      // Gracefully handle missing DB
      if (!process.env.DATABASE_URL) {
        console.log('[Mock DB] Saved Call Log:', { transcript, sentimentScore });
        return NextResponse.json({ success: true });
      }

      const { getCollection } = await import('@/lib/mongodb');
      const callLogs = await getCollection('call_logs');

      await callLogs.insertOne({
        direction: 'outbound',
        duration: payload.message.duration || 0,
        timestamp: new Date().toISOString(),
        sentiment_score: sentimentScore,
        transcript_summary: transcript.substring(0, 200) + '...',
        affordability_signal: affordabilitySignal,
      });

      return NextResponse.json({ success: true, message: 'Call log saved' });
    }

    // For any other message types (like transcript, etc.), just acknowledge
    console.log(`[VAPI Webhook] Received message type: ${payload.message?.type}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[VAPI Webhook] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
