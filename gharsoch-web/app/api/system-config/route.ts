import { NextRequest, NextResponse } from 'next/server'
import getSystemConfigModel from '@/models/systemConfig'
import { handleGet, handlePost, handlePut, handleDelete } from '@/lib/crudHandler'
import { authErrorResponse, requireRole, requireSession } from '@/lib/auth'

async function getCol() { return getSystemConfigModel() }

export async function GET(req: NextRequest) {
  try { await requireSession(); return handleGet(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: decide whether system_config remains global or becomes brokerage-scoped. */ return handlePost(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function PUT(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: decide whether system_config remains global or becomes brokerage-scoped. */ return handlePut(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function DELETE(req: NextRequest) {
  try { await requireRole(['admin', 'tech']); /* Phase 11.5: decide whether system_config remains global or becomes brokerage-scoped. */ return handleDelete(await getCol(), req) } catch (e: any) { const authResponse = authErrorResponse(e); if (authResponse) return authResponse; return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
