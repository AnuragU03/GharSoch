import clientPromise from '@/lib/mongodb'
import type { Property } from '@/models/Property'
import { runMatchmaker } from '@/lib/agents/matchmaker'
import { runPriceDropNegotiator } from '@/lib/agents/priceDropNegotiator'
import { ObjectId } from 'mongodb'

const DB_NAME = 'test'
const COLLECTION = 'properties'

export type SerializedProperty = Omit<Property, '_id' | 'created_at' | 'updated_at'> & {
  _id: string
  created_at: string
  updated_at: string
  last_price?: number
  price_drop_pct?: number
  price_drop_at?: string | null
}

export type PropertyStatusFilter = 'available' | 'negotiation' | 'sold'

export type PropertyInput = {
  title: string
  builder: string
  type: string
  city: string
  location: string
  price: number
  area_sqft: number
  bedrooms: number
  status: string
  description: string
  amenities?: string[]
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function serializeProperty(property: any): SerializedProperty {
  return {
    ...property,
    _id: String(property._id),
    created_at: toIso(property.created_at) || new Date().toISOString(),
    updated_at: toIso(property.updated_at) || new Date().toISOString(),
    price_drop_at: toIso(property.price_drop_at),
  }
}

function byRecentTimestamp(a: any, b: any) {
  const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
  const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
  return bTime - aTime
}

function normalizeStatus(status?: string) {
  const value = String(status || '').toLowerCase()
  if (value === 'in negotiation' || value === 'in_negotiation') return 'negotiation'
  return value || 'available'
}

async function getCollection() {
  const client = await clientPromise
  return client.db(DB_NAME).collection<Property>(COLLECTION)
}

export const propertyService = {
  async list(options: {
    status?: PropertyStatusFilter
    location?: string
    builder?: string
    type?: string
    limit?: number
  } = {}): Promise<SerializedProperty[]> {
    const collection = await getCollection()
    const filter: Record<string, any> = {
      deleted_at: { $exists: false }, // X2: hide soft-deleted properties
    }

    if (options.status && options.status !== 'available') {
      filter.status =
        options.status === 'negotiation'
          ? { $in: ['negotiation', 'in negotiation', 'in_negotiation'] }
          : options.status
    } else if (options.status === 'available') {
      filter.status = 'available'
    }

    if (options.location) filter.location = { $regex: options.location, $options: 'i' }
    if (options.builder) filter.builder = { $regex: options.builder, $options: 'i' }
    if (options.type) filter.type = options.type

    const properties = (await collection.find(filter).toArray())
      .sort(byRecentTimestamp)
      .slice(0, options.limit || 60)

    return properties.map(serializeProperty)
  },

  async get(id: string): Promise<SerializedProperty | null> {
    const collection = await getCollection()
    const property = await collection.findOne({ _id: new ObjectId(id) })
    return property ? serializeProperty(property) : null
  },

  async create(input: PropertyInput) {
    const collection = await getCollection()
    const now = new Date()
    const document: any = {
      ...input,
      status: normalizeStatus(input.status),
      amenities: input.amenities || [],
      images: [],
      created_at: now,
      updated_at: now,
      last_price: input.price,
      price_drop_pct: 0,
      price_drop_at: null,
    }

    const result = await collection.insertOne(document)
    const created = { ...document, _id: result.insertedId }

    queueMicrotask(() => {
      void runMatchmaker().catch((error) => {
        console.error('[PROPERTY SERVICE] Matchmaker trigger failed after create:', error)
      })
    })

    return serializeProperty(created)
  },

  async update(id: string, patch: Partial<PropertyInput>) {
    const collection = await getCollection()
    const existing = await collection.findOne({ _id: new ObjectId(id) })

    if (!existing) {
      throw new Error('Property not found')
    }

    const nextPrice = patch.price !== undefined ? Number(patch.price) : Number(existing.price || 0)
    const currentPrice = Number(existing.price || 0)
    const priceDropped = Number.isFinite(nextPrice) && nextPrice > 0 && currentPrice > 0 && nextPrice < currentPrice

    const updateDoc: Record<string, any> = {
      ...patch,
      updated_at: new Date(),
    }

    if (patch.status) updateDoc.status = normalizeStatus(patch.status)
    if (patch.price !== undefined) updateDoc.price = nextPrice
    if (patch.area_sqft !== undefined) updateDoc.area_sqft = Number(patch.area_sqft)
    if (patch.bedrooms !== undefined) updateDoc.bedrooms = Number(patch.bedrooms)

    if (priceDropped) {
      updateDoc.last_price = currentPrice
      updateDoc.price_drop_pct = Number((((currentPrice - nextPrice) / currentPrice) * 100).toFixed(1))
      updateDoc.price_drop_at = new Date()
    }

    await collection.updateOne({ _id: existing._id }, { $set: updateDoc })

    if (priceDropped) {
      queueMicrotask(() => {
        void runPriceDropNegotiator({
          property_id: id,
          old_price: currentPrice,
          new_price: nextPrice,
        }).catch((error) => {
          console.error('[PROPERTY SERVICE] Price-drop trigger failed after update:', error)
        })
      })
    }

    const updated = await collection.findOne({ _id: existing._id })
    if (!updated) throw new Error('Property not found after update')
    return serializeProperty(updated)
  },

  async delete(id: string) {
    const collection = await getCollection()
    const result = await collection.deleteOne({ _id: new ObjectId(id) })
    if (result.deletedCount === 0) {
      throw new Error('Property not found or already deleted')
    }
    return { success: true }
  },
}
