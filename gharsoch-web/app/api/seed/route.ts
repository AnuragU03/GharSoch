import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { SEED_PROPERTIES } from '@/data/propertySeed'
import { authErrorResponse, requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireRole(['admin', 'tech'])
    // Phase 11.5: seed only brokerage-scoped demo data when multi-tenant lands.
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
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[API/Seed] Error:', error)
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 })
  }
}
