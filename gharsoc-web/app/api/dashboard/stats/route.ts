import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { AGENT_REGISTRY } from '@/lib/agentRegistry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        activeCalls: 0,
        callsToday: 0,
        avgSentiment: 0,
        meetingsBooked: 0,
        signalMix: { go: 0, reconsider: 0, noGo: 0 },
        recentActivity: [],
        agentsSummary: Object.values(AGENT_REGISTRY).map(agent => ({
          name: agent.name,
          status: 'idle',
          actions: 0
        }))
      });
    }

    const callLogs = await getCollection('call_logs');
    const scheduledMeetings = await getCollection('scheduled_meetings');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch calls today
    const callsTodayArray = await callLogs.find({
      timestamp: { $gte: today.toISOString() }
    }).toArray();

    // Meetings booked today
    const meetingsTodayCount = await scheduledMeetings.countDocuments({
      created_at: { $gte: today.toISOString() }
    });

    // Calculate Average Sentiment
    let avgSentiment = 0;
    if (callsTodayArray.length > 0) {
      const validScores = callsTodayArray
        .map(c => c.sentiment_score)
        .filter(s => typeof s === 'number');
      if (validScores.length > 0) {
         const sum = validScores.reduce((a, b) => a + b, 0);
         avgSentiment = Math.round((sum / validScores.length) * 100);
      }
    }

    // Signal Mix
    const signalMix = { go: 0, reconsider: 0, noGo: 0 };
    callsTodayArray.forEach(call => {
      if (call.affordability_signal === 'Go') signalMix.go++;
      else if (call.affordability_signal === 'Reconsider') signalMix.reconsider++;
      else if (call.affordability_signal === 'No-Go') signalMix.noGo++;
    });

    // Recent Activity (Last 6 calls)
    const recentCalls = await callLogs.find({})
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray();

    const recentActivity = recentCalls.map(call => {
      const timeDiff = Math.max(0, Math.floor((Date.now() - new Date(call.timestamp).getTime()) / 60000));
      return {
        time: timeDiff === 0 ? 'Just now' : `${timeDiff} min ago`,
        event: call.transcript_summary || `Call completed (${call.direction})`,
        agent: 'Voice Orchestrator',
        type: 'call',
        signal: call.affordability_signal !== 'Unknown' ? call.affordability_signal : undefined
      };
    });

    // Agents Summary
    const agentsSummary = Object.values(AGENT_REGISTRY).map(agent => ({
      name: agent.name,
      status: 'active', // Ideally, this would check if the agent had actions today
      actions: callsTodayArray.length // Mocking actions per agent based on total calls for now
    }));

    return NextResponse.json({
      activeCalls: 0, // Vapi active calls requires live API fetch
      callsToday: callsTodayArray.length,
      avgSentiment,
      meetingsBooked: meetingsTodayCount,
      signalMix,
      recentActivity,
      agentsSummary
    });

  } catch (error) {
    console.error('Dashboard Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
