'use server'

import { revalidatePath } from 'next/cache'
import { ObjectId } from 'mongodb'

import { requireRole } from '@/lib/auth'
import { getCollection } from '@/lib/mongodb'
import { propertyService, softDeletePropertyCascade } from '@/lib/services/propertyService'

function parseAmenities(value: FormDataEntryValue | null) {
  const text = String(value || '').trim()
  if (!text) return []
  return text.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseImages(value: FormDataEntryValue | null) {
  const text = String(value || '').trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    // Fall back to comma-separated input if callers don't send JSON.
  }

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
      await propertyService.create({ ...payload, is_deleted: false } as any)
    }

    revalidatePath('/properties')
    revalidatePath('/ai-operations')

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to save property.' }
  }
}

export async function deletePropertyAction(propertyId: string) {
  await requireRole(['admin', 'tech'])
  if (!ObjectId.isValid(propertyId)) {
    return { ok: false, error: 'Invalid property ID' }
  }
  try {
    const result = await softDeletePropertyCascade(propertyId)
    if (!result.ok) {
      const errorMsg = result.error === 'property_not_found_or_already_deleted'
        ? 'Property not found or already deleted'
        : `Failed to delete property: ${result.error}`
      return { ok: false, error: errorMsg }
    }
    revalidatePath('/properties')
    revalidatePath('/leads')
    revalidatePath('/ai-operations')
    return { ok: true, leads_unmatched: result.leads_unmatched }
  } catch (err) {
    console.error('[DELETE_PROPERTY]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updatePropertyAction(formData: FormData) {
  await requireRole(['admin', 'tech'])

  const propertyId = String(formData.get('id') || '').trim()
  if (!ObjectId.isValid(propertyId)) {
    return { ok: false, error: 'Invalid property ID' }
  }

  const updates: Record<string, unknown> = {}

  const title = String(formData.get('title') || '').trim()
  if (title) updates.title = title

  const location = String(formData.get('location') || '').trim()
  if (location) updates.location = location

  const status = String(formData.get('status') || '').trim()
  if (status) updates.status = status

  const description = String(formData.get('description') || '').trim()
  if (description) {
    updates.description = description
  } else if (formData.has('description')) {
    updates.description = ''
  }

  if (formData.has('price')) {
    const rawPrice = String(formData.get('price') || '').trim()
    if (rawPrice) {
      const price = Number(rawPrice)
      if (!Number.isFinite(price) || price < 0) {
        return { ok: false, error: 'Price must be a valid number.' }
      }
      updates.price = price
    }
  }

  if (formData.has('bhk')) {
    const rawBhk = String(formData.get('bhk') || '').trim()
    if (rawBhk) {
      const bhk = Number(rawBhk)
      if (!Number.isFinite(bhk) || bhk < 0) {
        return { ok: false, error: 'BHK must be a valid number.' }
      }
      updates.bedrooms = bhk
    }
  }

  if (formData.has('amenities')) {
    updates.amenities = parseAmenities(formData.get('amenities'))
  }

  if (formData.has('images')) {
    updates.images = parseImages(formData.get('images'))
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No valid property fields provided for update.' }
  }

  try {
    const col = await getCollection('properties')
    const result = await col.updateOne(
      { _id: new ObjectId(propertyId), is_deleted: { $ne: true } },
      { $set: { ...updates, updated_at: new Date() } },
    )

    if (result.matchedCount === 0) {
      return { ok: false, error: 'Property not found' }
    }

    revalidatePath('/properties')
    revalidatePath('/ai-operations')
    return { ok: true }
  } catch (err) {
    console.error('[UPDATE_PROPERTY]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
