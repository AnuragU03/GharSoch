import clientPromise from '@/lib/mongodb'
import { appointmentService } from '@/lib/services/appointmentService'
import { AppointmentsSection } from '@/app/sections/AppointmentsSection'

export const dynamic = 'force-dynamic'

async function getSelectables() {
  try {
    const client = await clientPromise
    const db = client.db('test')
    const [leads, properties] = await Promise.all([
      db.collection('leads').find({ is_deleted: { $ne: true } }, { projection: { _id: 1, name: 1, phone: 1 } }).limit(200).toArray(),
      db.collection('properties').find({ is_deleted: { $ne: true } }, { projection: { _id: 1, title: 1, location: 1 } }).limit(200).toArray(),
    ])
    return {
      leads: leads.map((l: any) => ({ _id: String(l._id), name: l.name || '', phone: l.phone || '' })),
      properties: properties.map((p: any) => ({ _id: String(p._id), title: p.title || '', location: p.location || '' })),
    }
  } catch {
    return { leads: [], properties: [] }
  }
}

export default async function AppointmentsPage() {
  const [todayAppts, upcomingAppts, strip, selectables] = await Promise.all([
    appointmentService.listToday(),
    appointmentService.listUpcoming(7),
    appointmentService.getStripData(),
    getSelectables(),
  ])

  return (
    <AppointmentsSection
      todayAppts={todayAppts}
      upcomingAppts={upcomingAppts}
      leads={selectables.leads}
      properties={selectables.properties}
      strip={strip}
    />
  )
}
