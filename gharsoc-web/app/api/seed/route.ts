import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { SEED_PROPERTIES } from '@/data/propertySeed'

export async function GET() {
  try {
    const properties = await getCollection('properties')
    
    // Clear existing properties
    await properties.deleteMany({})
    
    // Insert new properties
    const result = await properties.insertMany(SEED_PROPERTIES)
    
    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${result.insertedCount} properties`,
    })
  } catch (error) {
    console.error('[API/Seed] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
