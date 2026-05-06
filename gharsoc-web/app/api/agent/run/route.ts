import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const AGENT_RUNNERS = {
  matchmaker: { endpoint: '/api/agent/matchmaker', method: 'POST' },
  reminders: { endpoint: '/api/cron/reminders', method: 'GET' },
  're-engage': { endpoint: '/api/cron/re-engage', method: 'GET' },
  'follow-up': { endpoint: '/api/cron/follow-up', method: 'GET' },
} as const

type AgentId = keyof typeof AGENT_RUNNERS

async function readJson(response: Response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agent_id } = await request.json()

    if (agent_id === 'price-drop') {
      return NextResponse.json(
        {
          success: false,
          message: 'Run Price Drop from a property row so the property and new price are included.',
        },
        { status: 400 }
      )
    }

    const runner = AGENT_RUNNERS[agent_id as AgentId]
    if (!runner) {
      return NextResponse.json(
        { success: false, message: 'Unknown agent selected for manual run.' },
        { status: 400 }
      )
    }

    const cronSecret = process.env.CRON_SECRET
    // Use http://localhost:3000 for internal API calls to avoid SSL certificate validation errors
    // (Azure reverse proxy causes issues with external domain HTTPS for internal requests)
    const targetUrl = new URL(runner.endpoint, 'http://localhost:3000')
    const headers: HeadersInit = { 'Content-Type': 'application/json' }

    if (cronSecret) {
      headers.authorization = `Bearer ${cronSecret}`
    }

    const response = await fetch(targetUrl, {
      method: runner.method,
      headers,
      cache: 'no-store',
    }).catch((fetchError) => {
      console.error(`[API/Agent/Run] Fetch failed for ${runner.endpoint}:`, fetchError)
      throw new Error(`Failed to reach ${runner.endpoint}: ${fetchError.message}`)
    })
    const data = await readJson(response)
    const message = data.message || data.error || response.statusText || 'Agent run completed.'

    return NextResponse.json(
      {
        success: response.ok && data.success !== false,
        status: response.status,
        agent_id,
        message,
        data,
      },
      { status: response.ok ? 200 : response.status }
    )
  } catch (error) {
    console.error('[API/Agent/Run] POST Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to manually run agent.' },
      { status: 500 }
    )
  }
}
