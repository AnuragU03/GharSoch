/**
 * Call Archive Endpoint
 * GET: List recent archives
 * POST: Trigger manual archive export with filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { callArchiveService } from '@/lib/callArchiveService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const archives = await callArchiveService.getRecentArchives(limit)

    return NextResponse.json({
      success: true,
      data: {
        archives,
        count: archives.length,
      },
    })
  } catch (error) {
    console.error('[API/Archive/Calls] GET Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start_date, end_date, filters } = body

    if (!start_date || !end_date) {
      return NextResponse.json(
        { success: false, error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'start_date must be before end_date' },
        { status: 400 }
      )
    }

    const archive = await callArchiveService.archiveByDateRange(startDate, endDate, filters)

    if (!archive) {
      return NextResponse.json(
        { success: true, message: 'No calls found in date range', archive: null },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Archive created successfully',
      data: archive,
    })
  } catch (error) {
    console.error('[API/Archive/Calls] POST Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}
