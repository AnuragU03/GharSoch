import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function getPropertyCollection() {
  return await getCollection('properties')
}

export interface Property {
  _id?: ObjectId
  title: string
  type: string
  city: string
  location: string
  price: number
  area_sqft: number
  bedrooms: number
  status: string
  builder: string
  images: string[]
  description: string
  amenities: string[]
  created_at: Date
  updated_at: Date
}

export const DEFAULT_PROPERTY: Omit<Property, '_id'> = {
  title: '',
  type: '',
  city: '',
  location: '',
  price: 0,
  area_sqft: 0,
  bedrooms: 0,
  status: 'available',
  builder: '',
  images: [],
  description: '',
  amenities: [],
  created_at: new Date(),
  updated_at: new Date(),
}
