import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'
import { getCollection } from '@/lib/mongodb'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, call, type } = body

    console.log('[Vapi/Webhook] Received:', type)

    // Handle different Vapi event types
    if (type === 'conversation-update') {
      // Logic for real-time monitoring? 
    }

    if (type === 'tool-call') {
      const { toolCalls } = body
      const results: any[] = []

      for (const toolCall of toolCalls) {
        const { function: fn, id } = toolCall
        const args = JSON.parse(fn.arguments || '{}')

        console.log(`[Vapi/Tool] Calling: ${fn.name}`, args)

        let result = {}
        
        // Tool Routing Logic
        if (fn.name === 'analyze_affordability') {
          const config = getAgentConfig('69e8f7086aa016932b1c1a83') // Financial Agent
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: config?.systemPrompt || '' },
              { role: 'user', content: `Analyze: ${JSON.stringify(args)}` }
            ],
            response_format: { type: 'json_object' }
          })
          const parsedResult = JSON.parse(completion.choices[0].message.content || '{}')
          result = {
            message: (parsedResult as any).message || (parsedResult as any).text || (parsedResult as any).response || 'Task completed',
            data: parsedResult
          }
        }

        if (fn.name === 'schedule_meeting') {
          // Mock scheduling logic
          result = { success: true, message: 'Meeting scheduled successfully', date: args.date }
        }

        results.push({
          toolCallId: id,
          result: JSON.stringify(result)
        })
      }

      return NextResponse.json({ results })
    }

    if (type === 'end-of-call-report') {
      // Store call log in DB
      const logs = await getCollection('call_logs')
      await logs.insertOne({
        id: call.id,
        client_id: body.customer?.id || 'unknown',
        direction: call.type === 'inbound' ? 'inbound' : 'outbound',
        duration: call.duration,
        timestamp: new Date().toISOString(),
        sentiment_score: body.analysis?.sentiment === 'positive' ? 80 : 40,
        transcript_summary: body.analysis?.summary || '',
        agent_assigned: 'Voice Orchestrator',
        raw_data: body
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Vapi/Webhook] Error:', error)
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 })
  }
}
