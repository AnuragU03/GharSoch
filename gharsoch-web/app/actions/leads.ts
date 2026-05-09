'use server'

import { revalidatePath } from 'next/cache'

import { leadService, type LeadPipelineStage } from '@/lib/services/leadService'

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export async function moveLeadToStageAction(leadId: string, newStage: LeadPipelineStage) {
  await leadService.moveToStage(leadId, newStage)
  revalidatePath('/leads')
  return { success: true }
}

export async function exportLeadsCsvAction() {
  const leads = await leadService.listAll()
  const headers = ['Name', 'Phone', 'Email', 'Status', 'Interest', 'Budget', 'Location', 'Property Type', 'Created']
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.email,
    lead.status,
    lead.interest_level,
    lead.budget_range,
    lead.location_pref,
    lead.property_type,
    lead.created_at,
  ])

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
  return {
    filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  }
}
