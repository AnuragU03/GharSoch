'use client'
// default export alias for legacy AppContent imports

import { useState } from 'react'
import { StatStrip } from '@/components/StatStrip'
import { AppointmentRow } from '@/components/AppointmentRow'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Pill } from '@/components/Pill'
import type { SerializedAppointment, AppointmentDetail, AppointmentStripData } from '@/lib/services/appointmentService'

type SelectableLead = { _id: string; name: string; phone: string }
type SelectableProperty = { _id: string; title: string; location?: string }

function groupByDate(appts: SerializedAppointment[]) {
  const map = new Map<string, SerializedAppointment[]>()
  for (const a of appts) {
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(a.scheduled_at))
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  return map
}

function dateLabel(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00+05:30')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(tomorrow)
  if (dateKey === tomorrowKey) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).format(d)
}

function dateKeyIst(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function calendarDays(appointments: SerializedAppointment[]) {
  const todayKey = dateKeyIst(new Date())
  const start = new Date(todayKey + 'T00:00:00+05:30')

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKeyIst(date)
    return {
      key,
      label: index === 0 ? 'Today' : new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date),
      appointments: appointments.filter((appointment) => dateKeyIst(appointment.scheduled_at) === key),
    }
  })
}

function CalendarEvent({
  appointment,
  onClick,
}: {
  appointment: SerializedAppointment
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="w-full rounded-[10px] border border-hairline bg-surface-2 p-3 text-left transition hover:border-accent hover:bg-surface"
      onClick={onClick}
    >
      <div className="text-[12px] font-semibold text-accent">
        {formatAppointmentTime(appointment.scheduled_at)} – {formatAppointmentTime(addMinutes(appointment.scheduled_at, 30))}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-ink">
        {appointment.lead_name || 'Lead'} · {appointment.property_title || 'Property'}
      </div>
      <div className="mt-1 text-[11px] text-ink-3">🏠 {appointment.property_location || 'Location pending'}</div>
    </button>
  )
}

function AppointmentDetailDrawer({ detail, open, onClose }: { detail: AppointmentDetail | null; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[540px] max-w-[92vw] overflow-y-auto border-hairline bg-surface p-0 shadow-elev-2">
        <div className="drawer-head">
          <div>
            <SheetTitle className="m-0 text-[16px] font-semibold text-ink">
              {detail?.lead_name || 'Appointment detail'}
            </SheetTitle>
            <div className="runid">
              {detail?.scheduled_at ? new Date(detail.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Loading…'}
            </div>
          </div>
          {detail && <Pill variant={detail.status === 'confirmed' ? 'success' : 'idle'}>{detail.status}</Pill>}
        </div>
        {detail && (
          <div className="drawer">
            <div className="drawer-section">
              <h4>Lead</h4>
              {detail.lead ? (
                <div className="step eval">
                  <div><b>{detail.lead.name}</b> · {detail.lead.phone}</div>
                  {detail.lead.email && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{detail.lead.email}</div>}
                  {detail.lead.interest_level && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Interest: {detail.lead.interest_level}</div>}
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No linked lead found.</div>}
            </div>
            <div className="drawer-section">
              <h4>Property</h4>
              {detail.property ? (
                <div className="step eval">
                  <div><b>{detail.property.title}</b></div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{[detail.property.location, detail.property.builder].filter(Boolean).join(' · ')}</div>
                  {detail.property.price && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>₹{detail.property.price.toLocaleString('en-IN')}</div>}
                </div>
              ) : <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{detail.property_title || 'No linked property.'}</div>}
            </div>
            {detail.notes && (
              <div className="drawer-section">
                <h4>Notes</h4>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{detail.notes}</div>
              </div>
            )}
            <div className="drawer-section">
              <h4>Related agent runs ({detail.related_runs.length})</h4>
              {detail.related_runs.length > 0 ? detail.related_runs.map(run => (
                <div key={run.run_id} className="step tool">
                  <div className="kind">{run.agent_name} · {run.status}</div>
                  <div style={{ fontSize: 12 }}>{run.summary || 'No summary.'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                    {new Date(run.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
              )) : <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No related agent runs found.</div>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function NewBookingModal({ open, onClose, leads, properties }: { open: boolean; onClose: () => void; leads: SelectableLead[]; properties: SelectableProperty[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: form.get('lead_id'),
          property_id: form.get('property_id'),
          scheduled_at: form.get('scheduled_at'),
          notes: form.get('notes') || '',
          status: 'scheduled',
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onClose()
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Failed to create booking.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="modal-card">
        <div className="modal-head">
          <h3>Manual Booking</h3>
          <button type="button" className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Lead *</label>
              <select name="lead_id" required>
                <option value="">Select a lead…</option>
                {leads.map(l => <option key={l._id} value={l._id}>{l.name} · {l.phone}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Property *</label>
              <select name="property_id" required>
                <option value="">Select a property…</option>
                {properties.map(p => <option key={p._id} value={p._id}>{p.title}{p.location ? ` · ${p.location}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date & Time (IST) *</label>
              <input type="datetime-local" name="scheduled_at" required />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea name="notes" rows={3} />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Saving…' : 'Book appointment'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AppointmentsSection({
  todayAppts,
  upcomingAppts,
  leads,
  properties,
  strip,
}: {
  todayAppts: SerializedAppointment[]
  upcomingAppts: SerializedAppointment[]
  leads: SelectableLead[]
  properties: SelectableProperty[]
  strip: AppointmentStripData
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDetail, setDrawerDetail] = useState<AppointmentDetail | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  const handleRowClick = async (id: string) => {
    setDrawerDetail(null)
    setDrawerOpen(true)
    try {
      const res = await fetch(`/api/appointments/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDrawerDetail(data.data || null)
      }
    } catch { /* ignore */ }
  }

  const stripCells = [
    { label: 'Total', value: String(strip.total) },
    { label: 'Confirmed', value: String(strip.confirmed) },
    { label: 'Scheduled', value: String(strip.scheduled) },
    { label: 'Rescheduled', value: String(strip.rescheduled) },
    { label: 'Awaiting', value: String(strip.awaiting) },
    { label: 'Completed', value: String(strip.completed) },
  ]

  const upcomingGrouped = groupByDate(upcomingAppts)
  const calendarAppointments = [...todayAppts, ...upcomingAppts]
  const days = calendarDays(calendarAppointments)

  return (
    <>
      <section className="page active">
        <div className="crumb">Work · Appointments</div>
        <div className="head">
          <div>
            <h1 className="title">Appointments</h1>
            <p className="sub">All scheduled, confirmed, and upcoming property visits in one place.</p>
          </div>
          <div className="actions">
            <button
              type="button"
              className={`btn ghost sm${view === 'calendar' ? ' active' : ''}`}
              title="Calendar view"
              onClick={() => setView((current) => current === 'calendar' ? 'list' : 'calendar')}
            >
              📅 {view === 'calendar' ? 'List view' : 'Calendar view'}
            </button>
            <button type="button" className="btn primary" onClick={() => setModalOpen(true)}>
              🗓️ Manual booking
            </button>
          </div>
        </div>

        <StatStrip cells={stripCells} />

        {view === 'calendar' ? (
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">📅 Calendar view · next 7 days</div>
                <div className="panel-sub">Click any appointment to open details.</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {days.map((day) => (
                  <div key={day.key} className="rounded-[14px] border border-hairline bg-surface p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[13px] font-semibold text-ink">{day.label}</div>
                      <span className="count">{day.appointments.length}</span>
                    </div>
                    <div className="grid gap-2">
                      {day.appointments.length > 0 ? (
                        day.appointments.map((appointment) => (
                          <CalendarEvent
                            key={appointment._id}
                            appointment={appointment}
                            onClick={() => handleRowClick(appointment._id)}
                          />
                        ))
                      ) : (
                        <div className="rounded-[10px] border border-dashed border-hairline p-4 text-center text-[12px] text-ink-3">
                          No visits
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {view === 'list' ? (
          <>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">
                Today{' '}
                <span style={{ marginLeft: 8, background: 'var(--surface-2)', borderRadius: 999, padding: '2px 10px', fontSize: 12, color: 'var(--ink-3)' }}>
                  {todayAppts.length}
                </span>
              </div>
              <div className="panel-sub">{strip.confirmed} confirmed · {strip.awaiting} awaiting reply</div>
            </div>
          </div>
          <div className="panel-body p-0">
            {todayAppts.length > 0 ? (
              <table className="table">
                <thead><tr><th style={{ width: 80 }}>Time</th><th>Lead</th><th>Property</th><th>Notes</th><th style={{ textAlign: 'right' }}>Status</th></tr></thead>
                <tbody>{todayAppts.map(a => <AppointmentRow key={a._id} appt={a} onClick={() => handleRowClick(a._id)} />)}</tbody>
              </table>
            ) : (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No appointments scheduled for today.</div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Tomorrow &amp; beyond</div>
              <div className="panel-sub">{upcomingAppts.length} upcoming in the next 7 days</div>
            </div>
          </div>
          <div className="panel-body p-0">
            {upcomingAppts.length > 0 ? (
              Array.from(upcomingGrouped.entries()).map(([dateKey, appts]) => (
                <div key={dateKey}>
                  <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', borderBottom: '1px solid var(--hairline)', background: 'var(--surface-2)' }}>
                    {dateLabel(dateKey)} · {appts.length}
                  </div>
                  <table className="table">
                    <tbody>{appts.map(a => <AppointmentRow key={a._id} appt={a} onClick={() => handleRowClick(a._id)} />)}</tbody>
                  </table>
                </div>
              ))
            ) : (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No upcoming appointments in the next 7 days.</div>
            )}
          </div>
        </div>
          </>
        ) : null}
      </section>

      <AppointmentDetailDrawer detail={drawerDetail} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NewBookingModal open={modalOpen} onClose={() => setModalOpen(false)} leads={leads} properties={properties} />
    </>
  )
}

export default AppointmentsSection
