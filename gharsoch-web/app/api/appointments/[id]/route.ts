import { NextRequest, NextResponse } from 'next/server'
import { appointmentService } from '@/lib/services/appointmentService'
import { authErrorResponse, requireSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession()
    // Phase 11.5: verify appointment belongs to session.user.brokerage_id.
    const detail = await appointmentService.get(params.id)
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: detail })
  } catch (err: any) {
    const authResponse = authErrorResponse(err)
    if (authResponse) return authResponse
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
