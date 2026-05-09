'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { campaignService } from '@/lib/services/campaignService'

export async function createCampaignAction(formData: FormData) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: scope campaign writes to session.user.brokerage_id.
  const intent = String(formData.get('intent') || 'draft')
  const payload = {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    voice_assistant: String(formData.get('voice_assistant') || '').trim(),
    script_template: String(formData.get('script_template') || '').trim(),
    start_date: String(formData.get('start_date') || '').trim() || null,
    end_date: String(formData.get('end_date') || '').trim() || null,
    target_filter: String(formData.get('target_filter') || '').trim(),
  }

  if (!payload.name || !payload.voice_assistant || !payload.script_template) {
    return { success: false, error: 'Campaign name, voice assistant, and script template are required.' }
  }

  try {
    const campaign = await campaignService.create(payload)

    if (intent === 'launch') {
      await campaignService.launch(campaign._id)
    }

    revalidatePath('/campaigns')
    return { success: true, launched: intent === 'launch' }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create campaign.' }
  }
}

export async function launchCampaignAction(id: string) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: verify campaign belongs to session.user.brokerage_id.
  await campaignService.launch(id)
  revalidatePath('/campaigns')
  return { success: true }
}

export async function pauseCampaignAction(id: string) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: verify campaign belongs to session.user.brokerage_id.
  await campaignService.pause(id)
  revalidatePath('/campaigns')
  return { success: true }
}

export async function resumeCampaignAction(id: string) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: verify campaign belongs to session.user.brokerage_id.
  await campaignService.resume(id)
  revalidatePath('/campaigns')
  return { success: true }
}
