/**
 * Automatic Call Archive Cron Job
 * Runs daily to archive calls older than 30 days
 */

import { NextRequest, NextResponse } from 'next/server'
import { callArchiveService } from '@/lib/callArchiveService'
import { getCollection } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const archiveDaysOld = parseInt(process.env.ARCHIVE_DAYS_OLD || '30')

    const archive = await callArchiveService.archiveClosedCalls(archiveDaysOld)

    if (!archive) {
      const agentLogsCollection = await getCollection('agent_logs')
      await agentLogsCollection.insertOne({
        agent_name: 'Call Archive Service',
        action: `Scan complete. No calls older than ${archiveDaysOld} days found.`,
        status: 'success',
        created_at: new Date(),
      })

      return NextResponse.json({
        success: true,
        message: 'No calls to archive',
        archived_count: 0,
      })
    }

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'Call Archive Service',
      action: `Automatically archived ${archive.metadata.total_calls} calls to blob storage.`,
      status: 'success',
      created_at: new Date(),
      details: {
        archive_id: archive.archive_id,
        blob_url: archive.blob_info.blob_url,
        total_calls: archive.metadata.total_calls,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Archive created successfully',
      archived_count: archive.metadata.total_calls,
      archive_id: archive.archive_id,
      blob_url: archive.blob_info.blob_url,
    })
  } catch (error) {
    console.error('[API/Cron/Archive] Error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Server error'

    const agentLogsCollection = await getCollection('agent_logs')
    await agentLogsCollection.insertOne({
      agent_name: 'Call Archive Service',
      action: `Archive job failed: ${errorMsg}`,
      status: 'failed',
      created_at: new Date(),
    })

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}
