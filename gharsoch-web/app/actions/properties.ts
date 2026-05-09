'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { propertyService } from '@/lib/services/propertyService'

function parseAmenities(value: FormDataEntryValue | null) {
  const text = String(value || '').trim()
  if (!text) return []
  return text.split(',').map((item) => item.trim()).filter(Boolean)
}

export async function savePropertyAction(formData: FormData) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: stamp and filter properties by session.user.brokerage_id.
  const id = String(formData.get('id') || '')
  const payload = {
    title: String(formData.get('title') || '').trim(),
    builder: String(formData.get('builder') || '').trim(),
    type: String(formData.get('type') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    price: Number(formData.get('price') || 0),
    area_sqft: Number(formData.get('area_sqft') || 0),
    bedrooms: Number(formData.get('bedrooms') || 0),
    status: String(formData.get('status') || 'available').trim(),
    description: String(formData.get('description') || '').trim(),
    amenities: parseAmenities(formData.get('amenities')),
  }

  if (!payload.title || !payload.builder || !payload.city || !payload.location || !payload.price) {
    return { success: false, error: 'Title, builder, city, location, and price are required.' }
  }

  try {
    if (id) {
      await propertyService.update(id, payload)
    } else {
      await propertyService.create(payload)
    }

    revalidatePath('/properties')
    revalidatePath('/ai-operations')

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to save property.' }
  }
}
