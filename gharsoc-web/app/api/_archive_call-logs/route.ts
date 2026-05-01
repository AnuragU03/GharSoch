import { NextRequest, NextResponse } from 'next/server'
import getCallLogModel from '@/models/callLog'
import { handleGet, handlePost, handlePut, handleDelete } from '@/lib/crudHandler'

async function getCol() { return getCallLogModel() }

export async function GET(req: NextRequest) {
  try { return handleGet(await getCol(), req) } catch (e: any) { return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try { return handlePost(await getCol(), req) } catch (e: any) { return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function PUT(req: NextRequest) {
  try { return handlePut(await getCol(), req) } catch (e: any) { return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
export async function DELETE(req: NextRequest) {
  try { return handleDelete(await getCol(), req) } catch (e: any) { return NextResponse.json({ success: false, error: e?.message }, { status: 500 }) }
}
