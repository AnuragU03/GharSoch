import { NextRequest, NextResponse } from 'next/server'
import { Collection, Filter, UpdateFilter } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generic CRUD handler for MongoDB collections.
 * Replaces the Lyzr-Architect Model API (findAll, create, update, delete).
 */
export async function handleGet(col: Collection<any>, req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (id) {
    const doc = await col.findOne({ id } as Filter<any>)
    return NextResponse.json({ success: true, data: doc })
  }
  const docs = await col.find({}).sort({ _id: -1 }).limit(200).toArray()
  return NextResponse.json({ success: true, data: docs })
}

export async function handlePost(col: Collection<any>, req: NextRequest) {
  const body = await req.json()
  const record = { id: uuidv4(), ...body, createdAt: new Date().toISOString() }
  await col.insertOne(record)
  return NextResponse.json({ success: true, data: record }, { status: 201 })
}

export async function handlePut(col: Collection<any>, req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
  const result = await col.findOneAndUpdate(
    { id } as Filter<any>,
    { $set: { ...updates, updatedAt: new Date().toISOString() } } as UpdateFilter<any>,
    { returnDocument: 'after' }
  )
  return NextResponse.json({ success: true, data: result })
}

export async function handleDelete(col: Collection<any>, req: NextRequest) {
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
  await col.deleteOne({ id } as Filter<any>)
  return NextResponse.json({ success: true })
}
