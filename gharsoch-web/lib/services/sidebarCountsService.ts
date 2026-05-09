import { getCollection } from '@/lib/mongodb'
import { startOfDay } from 'date-fns'

export async function getSidebarCounts(): Promise<{
  leads: number
  clients: number
  appointments: number
  pendingUsers: number
}> {
  try {
    const leadsCollection = await getCollection('leads')
    const clientsCollection = await getCollection('clients')
    const appointmentsCollection = await getCollection('appointments')
    const usersCollection = await getCollection('users')

    const todayStart = new Date()
    // Convert to IST offset loosely or just use local startOfDay if running on server
    // For safety, let's just use startOfDay. Actually, the prompt says "today (IST)".
    // Vercel server runs in UTC. Let's do a simple IST adjustment:
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    istNow.setUTCHours(0, 0, 0, 0) // start of IST day in UTC representation
    const startOfIstDay = new Date(istNow.getTime() - istOffset)
    
    const istTomorrow = new Date(istNow.getTime() + 24 * 60 * 60 * 1000)
    const endOfIstDay = new Date(istTomorrow.getTime() - istOffset)

    const [leads, clients, appointments, pendingUsers] = await Promise.all([
      leadsCollection.countDocuments({ status: { $nin: ['closed', 'lost', 'won'] } }),
      clientsCollection.countDocuments({ conversion_status: { $in: ['pending', 'converting'] } }),
      appointmentsCollection.countDocuments({
        appointment_date: {
          $gte: startOfIstDay.toISOString(),
          $lt: endOfIstDay.toISOString(),
        },
      }),
      usersCollection.countDocuments({ status: 'pending_approval' }),
    ])

    return { leads, clients, appointments, pendingUsers }
  } catch (error) {
    console.error('[SidebarCountsService] Error fetching counts:', error)
    return { leads: 0, clients: 0, appointments: 0, pendingUsers: 0 }
  }
}
