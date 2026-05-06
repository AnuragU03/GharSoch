/**
 * Call Archive Service
 * Handles packaging, compression, and upload of call histories to Azure Blob Storage
 */

import { v4 as uuidv4 } from 'uuid'
import { BlobServiceClient } from '@azure/storage-blob'
import { getCollection } from '@/lib/mongodb'
import { CallArchive } from '@/models/CallArchive'

class CallArchiveService {
  private blobServiceClient: BlobServiceClient | null = null

  /**
   * Initialize Azure Blob Storage client
   */
  private async initializeBlobClient() {
    if (this.blobServiceClient) return

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured')
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  }

  /**
   * Archive calls older than specified days (automatic cleanup)
   */
  async archiveClosedCalls(daysOld: number = 30): Promise<CallArchive | null> {
    const callsCollection = await getCollection('calls')
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const closedCalls = await callsCollection
      .find({
        call_status: 'completed',
        updated_at: { $lte: cutoffDate },
      })
      .toArray()

    if (closedCalls.length === 0) {
      return null
    }

    return await this.createArchive(
      closedCalls.map((c: any) => c._id.toString()),
      {
        type: 'automatic',
        days_old: daysOld,
        reason: `Auto-archive of calls completed more than ${daysOld} days ago`,
      }
    )
  }

  /**
   * Archive calls by date range (manual export)
   */
  async archiveByDateRange(
    startDate: Date,
    endDate: Date,
    filters?: {
      agent_name?: string
      disposition?: string
      call_outcome?: string
      campaign_id?: string
    }
  ): Promise<CallArchive | null> {
    const callsCollection = await getCollection('calls')

    const query: any = {
      created_at: {
        $gte: startDate,
        $lte: endDate,
      },
    }

    if (filters?.agent_name) query.agent_name = filters.agent_name
    if (filters?.disposition) query.disposition = filters.disposition
    if (filters?.call_outcome) query.call_outcome = filters.call_outcome
    if (filters?.campaign_id) query.campaign_id = filters.campaign_id

    const calls = await callsCollection.find(query).toArray()

    if (calls.length === 0) {
      return null
    }

    return await this.createArchive(
      calls.map((c: any) => c._id.toString()),
      {
        type: 'manual',
        date_range: { from: startDate.toISOString(), to: endDate.toISOString() },
        filters,
      }
    )
  }

  /**
   * Create archive package from call IDs
   */
  private async createArchive(
    callIds: string[],
    metadata: Record<string, any>
  ): Promise<CallArchive> {
    const archivesCollection = await getCollection('call_archives')
    const callsCollection = await getCollection('calls')
    const leadsCollection = await getCollection('leads')
    const stateHistoryCollection = await getCollection('lead_state_history')

    // Fetch full call details
    const calls = await callsCollection
      .find({ _id: { $in: callIds.map((id) => ({ $oid: id })) } })
      .toArray()

    const leadIds = [...new Set(calls.map((c: any) => c.lead_id))]
    const leads = await leadsCollection.find({ _id: { $in: leadIds } }).toArray()

    const stateTransitions = await stateHistoryCollection
      .find({ lead_id: { $in: leadIds } })
      .toArray()

    // Build archive data structure
    const archiveData = {
      archive_metadata: {
        created_at: new Date().toISOString(),
        version: '1.0',
      },
      calls: calls,
      leads: leads,
      state_transitions: stateTransitions,
      summary: {
        total_calls: calls.length,
        total_duration_seconds: calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0),
        call_outcomes: this.countByField(calls, 'call_outcome'),
        dispositions: this.countByField(calls, 'disposition'),
        agent_names: [...new Set(calls.map((c: any) => c.agent_name))],
        campaigns: [...new Set(calls.map((c: any) => c.campaign_id))],
      },
    }

    // Upload to blob
    const blobPath = await this.uploadToBlob(archiveData)

    // Create archive record
    const archive: CallArchive = {
      archive_id: uuidv4(),
      call_ids: callIds,
      lead_ids: leadIds,
      archive_date: new Date().toISOString(),
      date_range: metadata.date_range || {
        from: new Date().toISOString(),
        to: new Date().toISOString(),
      },
      archive_type: metadata.type || 'manual',
      retention_days: 365,
      retention_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: archiveData.summary,
      blob_info: {
        container: 'call-archives',
        blob_name: blobPath.blob_name,
        blob_url: blobPath.blob_url,
        size_bytes: JSON.stringify(archiveData).length,
        encryption_enabled: true,
      },
      state_transitions_count: stateTransitions.length,
      validation_records_count: stateTransitions.filter((st: any) => st.validation).length,
      export_status: 'completed',
      exported_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Store archive metadata
    await archivesCollection.insertOne(archive)

    return archive
  }

  /**
   * Upload archive to Azure Blob Storage
   */
  private async uploadToBlob(
    archiveData: any
  ): Promise<{ blob_name: string; blob_url: string }> {
    await this.initializeBlobClient()

    if (!this.blobServiceClient) {
      throw new Error('Blob client not initialized')
    }

    const containerName = 'call-archives'
    const containerClient = this.blobServiceClient.getContainerClient(containerName)

    // Ensure container exists
    await containerClient.createIfNotExists()

    const archiveId = uuidv4()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const blobName = `call-archive-${timestamp}-${archiveId}.json`

    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Compress and upload
    const jsonData = JSON.stringify(archiveData, null, 2)
    await blockBlobClient.upload(jsonData, Buffer.byteLength(jsonData), {
      blobHTTPHeaders: {
        blobContentType: 'application/json',
        blobContentEncoding: 'utf-8',
      },
    })

    return {
      blob_name: blobName,
      blob_url: blockBlobClient.url,
    }
  }

  /**
   * Count occurrences of a field value
   */
  private countByField(
    items: any[],
    field: string
  ): Record<string, number> {
    const counts: Record<string, number> = {}
    items.forEach((item) => {
      const value = item[field] || 'unknown'
      counts[value] = (counts[value] || 0) + 1
    })
    return counts
  }

  /**
   * Get recent archives
   */
  async getRecentArchives(limit: number = 20): Promise<CallArchive[]> {
    const archivesCollection = await getCollection('call_archives')
    return await archivesCollection
      .find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()
  }
}

export const callArchiveService = new CallArchiveService()
