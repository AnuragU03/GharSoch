import { NextRequest, NextResponse } from 'next/server'
import { runMatchmaker } from '@/lib/agents/matchmaker'
import { authErrorResponse, requireRole } from '@/lib/auth'
import { GET as runFollowUpRoute } from '@/app/api/cron/follow-up/route'
import { POST as runReEngageRoute } from '@/app/api/cron/re-engage/route'
import { POST as runRemindersRoute } from '@/app/api/cron/reminders/route'

export const dynamic = 'force-dynamic'

const AGENT_RUNNERS = {
  matchmaker: async () => {
    const data = await runMatchmaker()
    return { success: true, status: 200, message: data?.summary || 'Matchmaker run completed.', data }
  },
  reminders: async () => routeToJson(runRemindersRoute, 'POST', { 'x-cron-secret': process.env.CRON_SECRET || '' }),
  're-engage': async () => routeToJson(runReEngageRoute, 'POST', { 'x-cron-secret': process.env.CRON_SECRET || '' }),
  'follow-up': async () => routeToJson(runFollowUpRoute, 'GET', { authorization: `Bearer ${process.env.CRON_SECRET || ''}` }),
} as const

type AgentId = keyof typeof AGENT_RUNNERS

async function readJson(response: Response | NextResponse) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

async function routeToJson(
  handler: (request: NextRequest) => Promise<Response | NextResponse>,
  method: string,
  headers: HeadersInit
) {
  const response = await handler(
    new NextRequest('http://internal.local/manual-agent-run', {
      method,
      headers,
    })
  )
  const data = await readJson(response)
  const message = data.message || data.error || response.statusText || 'Agent run completed.'

  return {
    success: response.ok && data.success !== false,
    status: response.status,
    message,
    data,
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: attach actor brokerage_id to manual agent runs when multi-tenant lands.
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

    const result = await runner()

    return NextResponse.json(
      {
        success: result.success,
        status: result.status,
        agent_id,
        message: result.message,
        data: result.data,
      },
      { status: result.success ? 200 : result.status }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Agent/Run] POST Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to manually run agent.' },
      { status: 500 }
    )
  }
}
