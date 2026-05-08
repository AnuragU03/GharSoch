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
}

export const builderKBService = new BuilderKBService()
