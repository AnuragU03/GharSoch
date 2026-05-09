import { ObjectId } from 'mongodb'

import { getCollection } from '@/lib/mongodb'
import type { UserRole, UserStatus } from '@/models/User'

export type SerializedBrokerage = {
  _id: string
  name: string
  city: string
  vapi_assistant_id: string
  notes?: string
  created_at: string
  updated_at: string
}

export type SerializedUser = {
  _id: string
  email: string
  name: string
  image?: string | null
  role: UserRole
  status: UserStatus
  brokerage_id?: string | null
  brokerage?: SerializedBrokerage | null
  created_at: string
  last_login_at: string
  promoted_by_user_id?: string | null
  promoted_at?: string | null
}

export type BrokerageInput = {
  name: string
  city: string
  vapi_assistant_id: string
  notes?: string
}

function toObjectId(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid user id')
  }

  return new ObjectId(id)
}

function toOptionalObjectId(id?: string | null) {
  return id && ObjectId.isValid(id) ? new ObjectId(id) : null
}

function dateToIso(value: unknown) {
  if (!value) return ''
  return new Date(value as string | Date).toISOString()
}

function serializeBrokerage(doc: any): SerializedBrokerage | null {
  if (!doc) return null

  return {
    _id: doc._id.toString(),
    name: doc.name || '',
    city: doc.city || '',
    vapi_assistant_id: doc.vapi_assistant_id || '',
    notes: doc.notes || '',
    created_at: dateToIso(doc.created_at),
    updated_at: dateToIso(doc.updated_at),
  }
}

function serializeUser(doc: any, brokerage?: any): SerializedUser {
  return {
    _id: doc._id.toString(),
    email: doc.email || '',
    name: doc.name || doc.email || 'Unknown user',
    image: doc.image ?? null,
    role: doc.role || 'broker',
    status: doc.status || 'pending_approval',
    brokerage_id: doc.brokerage_id?.toString?.() ?? null,
    brokerage: serializeBrokerage(brokerage),
    created_at: dateToIso(doc.created_at),
    last_login_at: dateToIso(doc.last_login_at),
    promoted_by_user_id: doc.promoted_by_user_id?.toString?.() ?? null,
    promoted_at: doc.promoted_at ? dateToIso(doc.promoted_at) : null,
  }
}

async function loadBrokeragesById(ids: ObjectId[]) {
  if (ids.length === 0) return new Map<string, any>()

  const brokerages = await getCollection('brokerages')
  const rows = await brokerages.find({ _id: { $in: ids } }).toArray()
  return new Map(rows.map((row) => [row._id.toString(), row]))
}

async function getOrCreateBrokerage(input: BrokerageInput) {
  const brokerages = await getCollection('brokerages')
  const now = new Date()
  const name = input.name.trim()
  const name_key = name.toLowerCase()

  let brokerage = await brokerages.findOne({ name_key })
  if (!brokerage) {
    brokerage = await brokerages.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })
  }

  if (brokerage) {
    await brokerages.updateOne(
      { _id: brokerage._id },
      {
        $set: {
          name_key,
          city: input.city.trim(),
          vapi_assistant_id: input.vapi_assistant_id,
          notes: input.notes?.trim() || brokerage.notes || '',
          updated_at: now,
        },
      }
    )

    return brokerage._id as ObjectId
  }

  const result = await brokerages.insertOne({
    name,
    name_key,
    city: input.city.trim(),
    vapi_assistant_id: input.vapi_assistant_id,
    notes: input.notes?.trim() || '',
    created_at: now,
    updated_at: now,
  })

  return result.insertedId
}

async function stampUserChange(
  userId: string,
  adminUserId: string,
  patch: Record<string, unknown>
) {
  const users = await getCollection('users')
  const now = new Date()

  await users.updateOne(
    { _id: toObjectId(userId) },
    {
      $set: {
        ...patch,
        promoted_by_user_id: toOptionalObjectId(adminUserId),
        promoted_at: now,
        updated_at: now,
      },
    }
  )
}

export const userService = {
  async listUsers({
    status,
    role,
    limit = 50,
  }: {
    status?: UserStatus
    role?: UserRole
    limit?: number
  } = {}): Promise<SerializedUser[]> {
    const users = await getCollection('users')
    const query: Record<string, unknown> = {}

    if (status) query.status = status
    if (role) query.role = role

    const rows = await users.find(query).limit(Math.min(limit, 100)).toArray()
    rows.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })

    const brokerageIds = rows
      .map((row) => row.brokerage_id)
      .filter((id): id is ObjectId => id instanceof ObjectId)
    const brokeragesById = await loadBrokeragesById(brokerageIds)

    return rows.map((row) =>
      serializeUser(
        row,
        row.brokerage_id ? brokeragesById.get(row.brokerage_id.toString()) : null
      )
    )
  },

  async listBrokerages(): Promise<SerializedBrokerage[]> {
    const brokerages = await getCollection('brokerages')
    const rows = await brokerages.find({}).limit(100).toArray()
    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    return rows.map((row) => serializeBrokerage(row)).filter(Boolean) as SerializedBrokerage[]
  },

  async countPendingUsers(): Promise<number> {
    const users = await getCollection('users')
    return users.countDocuments({ status: 'pending_approval' })
  },

  async promoteToBroker(userId: string, brokerageInput: BrokerageInput, adminUserId: string) {
    const brokerageId = await getOrCreateBrokerage(brokerageInput)

    await stampUserChange(userId, adminUserId, {
      role: 'broker',
      status: 'active',
      brokerage_id: brokerageId,
    })
  },

  async promoteToTech(userId: string, adminUserId: string) {
    await stampUserChange(userId, adminUserId, {
      role: 'tech',
      status: 'active',
      brokerage_id: null,
    })
  },

  async promoteToAdmin(userId: string, adminUserId: string) {
    await stampUserChange(userId, adminUserId, {
      role: 'admin',
      status: 'active',
      brokerage_id: null,
    })
  },

  async suspendUser(userId: string, adminUserId: string) {
    await stampUserChange(userId, adminUserId, { status: 'suspended' })
  },

  async reinstateUser(userId: string, adminUserId: string) {
    await stampUserChange(userId, adminUserId, { status: 'active' })
  },
}
