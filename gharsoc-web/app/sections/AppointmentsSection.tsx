'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiOutlineCalendarDays } from 'react-icons/hi2'
import { FiPhoneCall } from 'react-icons/fi'

interface Appointment { _id: string; lead_name: string; lead_phone: string; property_title: string; property_location: string; scheduled_at: string; status: string; reminder_sent: boolean; notes: string }

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#dbeafe', text: '#1d4ed8' }, confirmed: { bg: '#d1fae5', text: '#047857' },
  completed: { bg: '#e5e7eb', text: '#374151' }, cancelled: { bg: '#fee2e2', text: '#b91c1c' },
  rescheduled: { bg: '#fef3c7', text: '#92400e' },
}

export default function AppointmentsSection() {
  const [items, setItems] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filter === 'upcoming') p.set('upcoming', 'true')
    else if (filter === 'today') p.set('today', 'true')
    else if (filter !== 'all') p.set('status', filter)
    try { const r = await fetch(`/api/appointments?${p}`); const d = await r.json(); if (d.success) { setItems(d.appointments); setTotal(d.total) } } catch {}
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  const sendReminder = async (appt: Appointment) => {
    try {
      const r = await fetch('/api/campaigns/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: appt._id }) })
      const d = await r.json()
      alert(d.success ? 'Reminder call triggered!' : `Failed: ${d.error}`)
    } catch { alert('Failed') }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/appointments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: id, status }) })
    fetchData()
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Appointments</h2><p className="text-sm text-muted-foreground">{total} appointments</p></div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
      : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlineCalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No appointments found.</p></div>
      : <div className="space-y-3">
        {items.map(a => {
          const s = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled
          return (
            <div key={a._id} className="border border-border rounded-xl bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">{a.lead_name || 'Unknown Lead'}</h3>
                  <p className="text-xs text-muted-foreground">{a.property_title} — {a.property_location}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-medium">{fmtDate(a.scheduled_at)}</span>
                    <span className="text-muted-foreground">{fmtTime(a.scheduled_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px]" style={{ background: s.bg, color: s.text, border: 'none' }}>{a.status}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                {!a.reminder_sent && a.status !== 'cancelled' && a.status !== 'completed' && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => sendReminder(a)}>
                    <FiPhoneCall className="w-3 h-3" /> Send Reminder
                  </Button>
                )}
                {a.status === 'scheduled' && <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => updateStatus(a._id, 'confirmed')}>Confirm</Button>}
                {(a.status === 'scheduled' || a.status === 'confirmed') && (
                  <>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => updateStatus(a._id, 'completed')}>Complete</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => updateStatus(a._id, 'cancelled')}>Cancel</Button>
                  </>
                )}
                {a.reminder_sent && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Reminder Sent</Badge>}
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
