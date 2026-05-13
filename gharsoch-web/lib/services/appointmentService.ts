import clientPromise from '@/lib/mongodb'
import type { Appointment } from '@/models/Appointment'
import { ObjectId } from 'mongodb'

const DB_NAME = 'test'
const COLLECTION = 'appointments'
const IST_TIMEZONE = 'Asia/Kolkata'

export type SerializedAppointment = Omit<Appointment, '_id' | 'scheduled_at' | 'created_at' | 'updated_at'> & {
  _id: string
  scheduled_at: string
  created_at: string
  updated_at: string
}

export type AppointmentDetail = SerializedAppointment & {
  lead?: {
    _id: string
    name: string
    phone: string
    email?: string
    interest_level?: string
    status?: string
  } | null
  property?: {
    _id: string
    title: string
    builder?: string
    location?: string
    price?: number
    status?: string
  } | null
  related_runs: Array<{
    run_id: string
    agent_id: string
    agent_name: string
    status: string
    started_at: string
    summary?: string
  }>
}

export type AppointmentStripData = {
  total: number
  confirmed: number
  scheduled: number
  rescheduled: number
  awaiting: number
  completed: number
}

function toIso(value?: Date | string | null) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function serializeAppointment(appointment: any): SerializedAppointment {
  return {
    ...appointment,
    _id: String(appointment._id),
    scheduled_at: toIso(appointment.scheduled_at) || new Date().toISOString(),
    created_at: toIso(appointment.created_at) || new Date().toISOString(),
    updated_at: toIso(appointment.updated_at) || new Date().toISOString(),
  }
}

function byScheduledAtAscending(a: any, b: any) {
  return new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()
}

function getIstDateKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

async function getCollection() {
  const client = await clientPromise
  return client.db(DB_NAME).collection<Appointment>(COLLECTION)
}

async function listAllAppointments() {
  const collection = await getCollection()
  return (await collection.find({
    lead_id: { $exists: true, $nin: ['', null] },
    property_id: { $exists: true, $nin: ['', null] },
    is_deleted: { $ne: true },
  }).toArray()).sort(byScheduledAtAscending)
}

export const appointmentService = {
  async listToday(): Promise<SerializedAppointment[]> {
    const todayKey = getIstDateKey(new Date())
    const appointments = await listAllAppointments()

    return appointments
      .filter((appointment) => getIstDateKey(appointment.scheduled_at) === todayKey)
      .map(serializeAppointment)
  },

  async listUpcoming(days: number = 7): Promise<SerializedAppointment[]> {
    const todayKey = getIstDateKey(new Date())
    const appointments = await listAllAppointments()

    return appointments
      .filter((appointment) => {
        const key = getIstDateKey(appointment.scheduled_at)
        return key > todayKey
      })
      .slice(0, Math.max(days * 12, 50))
      .map(serializeAppointment)
  },

  async get(id: string): Promise<AppointmentDetail | null> {
    const collection = await getCollection()
    const appointment = await collection.findOne({ _id: new ObjectId(id) })

    if (!appointment) {
      return null
    }

    const client = await clientPromise
    const db = client.db(DB_NAME)

    const [lead, property, rawRuns] = await Promise.all([
      appointment.lead_id ? db.collection('leads').findOne({ _id: new ObjectId(appointment.lead_id), is_deleted: { $ne: true } }) : null,
      appointment.property_id ? db.collection('properties').findOne({ _id: new ObjectId(appointment.property_id), is_deleted: { $ne: true } }) : null,
      db.collection('agent_execution_logs').find({}).limit(200).toArray(),
    ])

    const related_runs = rawRuns
      .filter((run: any) => {
        const leadId = appointment.lead_id
        const propertyId = appointment.property_id
        const input = run.input_data || {}
        const output = run.output_data || {}
        const matches = Array.isArray(output.match_details) ? output.match_details : []

        return (
          input.lead_id === leadId ||
          input.client_id === leadId ||
          input.property_id === propertyId ||
          output.lead_id === leadId ||
          output.property_id === propertyId ||
          matches.some((match: any) => match.client_id === leadId || match.property_id === propertyId)
        )
      })
      .sort((a: any, b: any) => new Date(b.started_at || b.created_at || 0).getTime() - new Date(a.started_at || a.created_at || 0).getTime())
      .slice(0, 8)
      .map((run: any) => ({
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        status: run.status,
        started_at: toIso(run.started_at || run.created_at) || new Date().toISOString(),
        summary:
          run.reasoning_summary?.summary ||
          run.output_data?.summary ||
          run.reasoning_steps?.[run.reasoning_steps.length - 1]?.content ||
          '',
      }))

    return {
      ...serializeAppointment(appointment),
      lead: lead
        ? {
            _id: String(lead._id),
            name: lead.name || appointment.lead_name,
            phone: lead.phone || appointment.lead_phone,
            email: lead.email,
            interest_level: lead.interest_level,
            status: lead.status,
          }
        : null,
      property: property
        ? {
            _id: String(property._id),
            title: property.title || appointment.property_title,
            builder: property.builder || property.builder_name,
            location: property.location || appointment.property_location,
            price: property.price,
            status: property.status,
          }
        : null,
      related_runs,
    }
  },

  async update(id: string, patch: Partial<Appointment>) {
    const collection = await getCollection()
    const updateDoc: Record<string, any> = {
      ...patch,
      updated_at: new Date(),
    }

    if (patch.scheduled_at) {
      updateDoc.scheduled_at = new Date(patch.scheduled_at)
    }

    await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc })
  },

  async create(input: {
    lead_id: string
    property_id: string
    scheduled_at: string
    status?: string
    notes?: string
  }) {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const [lead, property] = await Promise.all([
      db.collection('leads').findOne({ _id: new ObjectId(input.lead_id), is_deleted: { $ne: true } }),
      db.collection('properties').findOne({ _id: new ObjectId(input.property_id), is_deleted: { $ne: true } }),
    ])

    if (!lead || !property) {
      throw new Error('Lead or property not found for manual booking.')
    }

    const collection = await getCollection()
    const now = new Date()
    const document: Omit<Appointment, '_id'> = {
      lead_id: input.lead_id,
      property_id: input.property_id,
      agent_id: '',
      scheduled_at: new Date(input.scheduled_at),
      status: input.status || 'scheduled',
      reminder_sent: false,
      notes: input.notes || '',
      lead_name: lead.name || '',
      lead_phone: lead.phone || '',
      property_title: property.title || '',
      property_location: property.location || '',
      created_at: now,
      updated_at: now,
    }

    const result = await collection.insertOne(document)
    return serializeAppointment({ ...document, _id: result.insertedId })
  },

  async getStripData(): Promise<AppointmentStripData> {
    const appointments = await listAllAppointments()
    const todayKey = getIstDateKey(new Date())

    // B19: Count cards must match list semantics — today + upcoming only.
    // Past appointments excluded from cards (also invisible in lists).
    const relevant = appointments.filter((item: any) => {
      const key = getIstDateKey(item.scheduled_at)
      return key >= todayKey
    })

    return {
      total: relevant.length,
      confirmed: relevant.filter((item: any) => item.status === 'confirmed').length,
      scheduled: relevant.filter((item: any) => item.status === 'scheduled').length,
      rescheduled: relevant.filter((item: any) => item.status === 'rescheduled').length,
      awaiting: relevant.filter((item: any) => item.status === 'awaiting_reply' || item.status === 'awaiting').length,
      completed: relevant.filter((item: any) => item.status === 'completed').length,
    }
  },
}
