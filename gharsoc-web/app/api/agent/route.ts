import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAgentConfig } from '@/lib/agentRegistry'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, agent_id, context } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const agentConfig = getAgentConfig(agent_id)
    if (!agentConfig) {
      return NextResponse.json(
        { success: false, error: `Agent with ID ${agent_id} not found in registry` },
        { status: 404 }
      )
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: agentConfig.model || 'gpt-4o',
      messages: [
        { role: 'system', content: agentConfig.systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0].message.content
    let parsedResult = {}
    try {
      parsedResult = JSON.parse(responseContent || '{}')
    } catch (e) {
      parsedResult = { text: responseContent }
    }

    // Normalize response to match the expected format of the frontend
    return NextResponse.json({
      success: true,
      status: 'completed',
      response: {
        status: 'success',
        result: parsedResult,
        message: (parsedResult as any).message || (parsedResult as any).text || (parsedResult as any).response || 'Task completed',
        metadata: {
          agent_name: agentConfig.name,
          timestamp: new Date().toISOString(),
        }
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[API/Agent] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
