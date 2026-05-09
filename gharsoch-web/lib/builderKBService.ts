/**
 * Builder KB Service
 * Retrieves builder information from the Knowledge Base
 */

import { getCollection } from '@/lib/mongodb'

export interface BuilderKBData {
  builder_id: string
  builder_name: string
  reputation_score: number // 0-100
  completed_projects: number
  ongoing_projects: number
  average_rating: number // 0-5
  payment_plans: Array<{
    plan_name: string
    tranches: Array<{
      percentage: number
      payment_schedule: string
      description: string
    }>
    total_duration_months: number
  }>
  service_locations: string[]
  portfolio_descriptions: string
  customer_reviews_summary: string
  financing_options: string[]
  avg_project_delivery_months: number
  eco_certifications?: string[]
  warranty_coverage?: string
}

export type BuilderListItem = BuilderKBData & {
  last_queried_at: string | null
  queries_24h: number
  region: string
  project_count: number
  document_count: number
  updated_at?: string | null
  raw_profile?: Record<string, any>
}

class BuilderKBService {
  /**
   * Get builder data from KB by builder name or ID
   */
  async getBuilderData(builderNameOrId: string): Promise<BuilderKBData | null> {
    try {
      const kbCollection = await getCollection('knowledge_base')

      // Search for builder by name or ID
      const builderEntry = await kbCollection.findOne({
        $or: [
          { 'builders.builder_name': new RegExp(builderNameOrId, 'i') },
          { 'builders.builder_id': builderNameOrId },
          { type: 'builder', name: new RegExp(builderNameOrId, 'i') },
        ],
      })

      if (!builderEntry) {
        console.log(`[BuilderKBService] Builder not found: ${builderNameOrId}`)
        return null
      }

      // Extract builder data from KB entry
      const builderData: BuilderKBData = {
        builder_id: builderEntry.builder_id || builderEntry._id?.toString() || '',
        builder_name: builderEntry.builder_name || builderEntry.name || builderNameOrId,
        reputation_score: builderEntry.reputation_score || 75,
        completed_projects: builderEntry.completed_projects || 0,
        ongoing_projects: builderEntry.ongoing_projects || 0,
        average_rating: builderEntry.average_rating || 4.0,
        payment_plans: builderEntry.payment_plans || [],
        service_locations: builderEntry.service_locations || [],
        portfolio_descriptions: builderEntry.portfolio_descriptions || '',
        customer_reviews_summary: builderEntry.customer_reviews_summary || '',
        financing_options: builderEntry.financing_options || [],
        avg_project_delivery_months: builderEntry.avg_project_delivery_months || 24,
        eco_certifications: builderEntry.eco_certifications || [],
        warranty_coverage: builderEntry.warranty_coverage || '',
      }

      return builderData
    } catch (error) {
      console.error('[BuilderKBService] Error fetching builder data:', error)
      return null
    }
  }

  /**
   * Get all available builders from KB
   */
  async getAllBuilders(): Promise<BuilderKBData[]> {
    try {
      const kbCollection = await getCollection('knowledge_base')

      const builders = await kbCollection
        .find({
          $or: [
            { type: 'builder' },
            { 'builders': { $exists: true } },
          ],
        })
        .limit(50)
        .toArray()

      return builders.map((builder: any) => ({
        builder_id: builder.builder_id || builder._id?.toString() || '',
        builder_name: builder.builder_name || builder.name || '',
        reputation_score: builder.reputation_score || 75,
        completed_projects: builder.completed_projects || 0,
        ongoing_projects: builder.ongoing_projects || 0,
        average_rating: builder.average_rating || 4.0,
        payment_plans: builder.payment_plans || [],
        service_locations: builder.service_locations || [],
        portfolio_descriptions: builder.portfolio_descriptions || '',
        customer_reviews_summary: builder.customer_reviews_summary || '',
        financing_options: builder.financing_options || [],
        avg_project_delivery_months: builder.avg_project_delivery_months || 24,
        eco_certifications: builder.eco_certifications || [],
        warranty_coverage: builder.warranty_coverage || '',
      }))
    } catch (error) {
      console.error('[BuilderKBService] Error fetching all builders:', error)
      return []
    }
  }

  async listAllBuilders(): Promise<BuilderListItem[]> {
    try {
      const [buildersCollection, executionCollection] = await Promise.all([
        getCollection('builders'),
        getCollection('agent_execution_logs'),
      ])

      const [builders, runs] = await Promise.all([
        buildersCollection.find({}).limit(100).toArray(),
        executionCollection.find({}).limit(250).toArray(),
      ])

      const cutoff = Date.now() - 24 * 60 * 60 * 1000

      return builders
        .map((builder: any) => {
          const builderName = String(builder.name || builder.builder_name || '').trim()
          const relevantActions = runs.flatMap((run: any) => {
            const actions = Array.isArray(run.actions) ? run.actions : []
            return actions
              .filter((action: any) => action.action_type === 'kb_query')
              .filter((action: any) => {
                const serialized = JSON.stringify({
                  description: action.description,
                  parameters: action.parameters,
                  result: action.result,
                }).toLowerCase()
                return builderName ? serialized.includes(builderName.toLowerCase()) : false
              })
          })

          const lastQueriedAt = relevantActions
            .map((action: any) => action.timestamp)
            .filter(Boolean)
            .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] || null

          const queries24h = relevantActions.filter((action: any) => {
            return new Date(action.timestamp || 0).getTime() >= cutoff
          }).length

          return {
            builder_id: String(builder._id),
            builder_name: builderName,
            reputation_score: builder.reputation_score || 70,
            completed_projects: builder.completed_projects || 0,
            ongoing_projects: builder.ongoing_projects || 0,
            average_rating: builder.average_rating || 0,
            payment_plans: builder.payment_plans || [],
            service_locations: builder.service_locations || (builder.city ? [builder.city] : []),
            portfolio_descriptions: builder.portfolio_descriptions || builder.description || '',
            customer_reviews_summary: builder.customer_reviews_summary || '',
            financing_options: builder.financing_options || [],
            avg_project_delivery_months: builder.avg_project_delivery_months || 0,
            eco_certifications: builder.eco_certifications || [],
            warranty_coverage: builder.warranty_coverage || '',
            last_queried_at: lastQueriedAt,
            queries_24h: queries24h,
            region: builder.city || builder.region || 'Unknown region',
            project_count:
              Number(builder.completed_projects || 0) +
              Number(builder.ongoing_projects || 0) +
              (Array.isArray(builder.notable_projects) ? builder.notable_projects.length : 0),
            document_count: builder.document_count || 0,
            updated_at: builder.updated_at ? new Date(builder.updated_at).toISOString() : null,
            raw_profile: builder,
          } satisfies BuilderListItem
        })
        .sort((a, b) => a.builder_name.localeCompare(b.builder_name))
    } catch (error) {
      console.error('[BuilderKBService] Error listing builders:', error)
      return []
    }
  }

  async getBuilderRecentQueries(builderIdOrName: string): Promise<Array<{
    run_id: string
    agent_name: string
    timestamp: string
    description: string
    query: Record<string, any> | null
    hit_count: number
  }>> {
    try {
      const executionCollection = await getCollection('agent_execution_logs')
      const runs = await executionCollection.find({}).limit(250).toArray()
      const needle = String(builderIdOrName).toLowerCase()

      return runs
        .flatMap((run: any) => {
          const actions = Array.isArray(run.actions) ? run.actions : []
          return actions
            .filter((action: any) => action.action_type === 'kb_query')
            .filter((action: any) => {
              const serialized = JSON.stringify({
                description: action.description,
                parameters: action.parameters,
                result: action.result,
              }).toLowerCase()
              return serialized.includes(needle)
            })
            .map((action: any) => ({
              run_id: run.run_id,
              agent_name: run.agent_name,
              timestamp: action.timestamp || run.started_at || run.created_at || new Date().toISOString(),
              description: action.description || 'KB query',
              query: action.parameters?.query || action.parameters?.filter || null,
              hit_count: action.result?.hit_count || 0,
            }))
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
    } catch (error) {
      console.error('[BuilderKBService] Error fetching recent queries:', error)
      return []
    }
  }

  /**
   * Search builders by criteria
   */
  async searchBuilders(criteria: {
    location?: string
    minReputation?: number
    maxProjectDuration?: number
  }): Promise<BuilderKBData[]> {
    try {
      const kbCollection = await getCollection('knowledge_base')
      const query: any = { type: 'builder' }

      if (criteria.location) {
        query.service_locations = { $regex: criteria.location, $options: 'i' }
      }

      if (criteria.minReputation) {
        query.reputation_score = { $gte: criteria.minReputation }
      }

      if (criteria.maxProjectDuration) {
        query.avg_project_delivery_months = { $lte: criteria.maxProjectDuration }
      }

      const builders = await kbCollection.find(query).limit(20).toArray()

      return builders.map((builder: any) => ({
        builder_id: builder.builder_id || builder._id?.toString() || '',
        builder_name: builder.builder_name || builder.name || '',
        reputation_score: builder.reputation_score || 75,
        completed_projects: builder.completed_projects || 0,
        ongoing_projects: builder.ongoing_projects || 0,
        average_rating: builder.average_rating || 4.0,
        payment_plans: builder.payment_plans || [],
        service_locations: builder.service_locations || [],
        portfolio_descriptions: builder.portfolio_descriptions || '',
        customer_reviews_summary: builder.customer_reviews_summary || '',
        financing_options: builder.financing_options || [],
        avg_project_delivery_months: builder.avg_project_delivery_months || 24,
        eco_certifications: builder.eco_certifications || [],
        warranty_coverage: builder.warranty_coverage || '',
      }))
    } catch (error) {
      console.error('[BuilderKBService] Error searching builders:', error)
      return []
    }
  }
  /**
   * Raw query execution against a collection
   */
  async queryRaw(collectionName: string, filter: object, options?: { limit?: number, project?: object }): Promise<any[]> {
    try {
      const collection = await getCollection(collectionName)
      let cursor = collection.find(filter)
      if (options?.project) {
        cursor = cursor.project(options.project)
      }
      if (options?.limit) {
        cursor = cursor.limit(options.limit)
      }
      return cursor.toArray()
    } catch (error) {
      console.error('[BuilderKBService] Error in queryRaw:', error)
      throw error
    }
  }

  /**
   * Alias for getBuilderData
   */
  async getBuilder(builderNameOrId: string): Promise<BuilderKBData | null> {
    return this.getBuilderData(builderNameOrId)
  }
}

export const builderKBService = new BuilderKBService()
