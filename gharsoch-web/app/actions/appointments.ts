'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { appointmentService } from '@/lib/services/appointmentService'

export async function createAppointmentAction(formData: FormData) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: filter/select leads and properties by session.user.brokerage_id.
  const lead_id = String(formData.get('lead_id') || '').trim()
  const property_id = String(formData.get('property_id') || '').trim()
  const scheduled_at = String(formData.get('scheduled_at') || '').trim()
  const notes = String(formData.get('notes') || '').trim()

  if (!lead_id || !property_id || !scheduled_at) {
    return { success: false, error: 'Lead, property, and booking time are required.' }
  }

  try {
    await appointmentService.create({ lead_id, property_id, scheduled_at, notes })
    revalidatePath('/appointments')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create appointment.' }
  }
}
