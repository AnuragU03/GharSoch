'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiOutlineCalendarDays, HiOutlineArrowDownTray } from 'react-icons/hi2'
import { FiPhoneCall, FiTrash2 } from 'react-icons/fi'
import { downloadExcel } from '@/lib/download'

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filter === 'upcoming') p.set('upcoming', 'true')
    else if (filter === 'today') p.set('today', 'true')
    else if (filter !== 'all') p.set('status', filter)
    try { const r = await fetch(`/api/appointments?${p}`); const d = await r.json(); if (d.success) { setItems(d.appointments); setTotal(d.total) } } catch {}
    setLoading(false)
    setSelectedIds(new Set())
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this appointment?')) return
    await fetch(`/api/appointments?id=${id}`, { method: 'DELETE' }); fetchData()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected appointment(s)?`)) return
    await fetch('/api/appointments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchData()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${total} appointments? This cannot be undone.`)) return
    await fetch('/api/appointments?all=true', { method: 'DELETE' })
    fetchData()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(a => a._id)))
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const allSelected = items.length > 0 && selectedIds.size === items.length

  const handleDownloadExcel = () => {
    const rows = items.map(a => ({
      'Lead Name': a.lead_name || '',
      'Lead Phone': a.lead_phone || '',
      'Property': a.property_title || '',
      'Location': a.property_location || '',
      'Date': fmtDate(a.scheduled_at),
      'Time': fmtTime(a.scheduled_at),
      'Status': a.status,
      'Reminder Sent': a.reminder_sent ? 'Yes' : 'No',
      'Notes': a.notes || '',
    }))
    downloadExcel(rows, `appointments-${new Date().toISOString().slice(0, 10)}`, 'Appointments')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Appointments</h2><p className="text-sm text-muted-foreground">{total} appointments</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadExcel} disabled={items.length === 0}>
            <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> Export Excel
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteSelected}>
              <FiTrash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDeleteAll}>
            <FiTrash2 className="w-3.5 h-3.5" /> Delete All
          </Button>
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
      </div>

      {items.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none w-fit">
          <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all appointments" />
          Select all
        </label>
      )}

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
      : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlineCalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No appointments found.</p></div>
      : <div className="space-y-3">
        {items.map(a => {
          const s = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled
          return (
            <div key={a._id} className={`border rounded-xl bg-card p-4 hover:shadow-sm transition-shadow ${selectedIds.has(a._id) ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(a._id)}
                    onCheckedChange={() => toggleSelect(a._id)}
                    aria-label={`Select appointment for ${a.lead_name}`}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">{a.lead_name || 'Unknown Lead'}</h3>
                    <p className="text-xs text-muted-foreground">{a.property_title} — {a.property_location}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium">{fmtDate(a.scheduled_at)}</span>
                      <span className="text-muted-foreground">{fmtTime(a.scheduled_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className="text-[10px]" style={{ background: s.bg, color: s.text, border: 'none' }}>{a.status}</Badge>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(a._id)}>
                    <FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 ml-7">
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
