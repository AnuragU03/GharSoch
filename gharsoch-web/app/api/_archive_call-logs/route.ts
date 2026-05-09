import { NextRequest, NextResponse } from 'next/server'
import getCallLogModel from '@/models/callLog'
import { handleGet, handlePost, handlePut, handleDelete } from '@/lib/crudHandler'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'

async function getCol() { return getCallLogModel() }

export async function GET(req: NextRequest) {
  try { await requireSession(); return handleGet(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: filter archived call logs by session.user.brokerage_id. */ return handlePost(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function PUT(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: filter archived call logs by session.user.brokerage_id. */ return handlePut(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function DELETE(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: filter archived call logs by session.user.brokerage_id. */ return handleDelete(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
