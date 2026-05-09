'use client'

import { useState } from 'react'
import { Pill } from '@/components/Pill'
import type { PillVariant } from '@/components/Pill'
import type { SerializedAppointment, AppointmentStripData } from '@/lib/services/appointmentService'

function statusVariant(status: string): PillVariant {
  if (status === 'confirmed') return 'success'
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'failed'
  if (status === 'rescheduled') return 'amber'
  if (status === 'awaiting_reply' || status === 'awaiting') return 'idle'
  return 'idle'
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso))
}

function formatDateLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const fmt = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

  if (fmt(d) === fmt(today)) return 'Today'
  if (fmt(d) === fmt(tomorrow)) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d)
}

function getDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export function AppointmentRow({
  appt,
  onClick,
}: {
  appt: SerializedAppointment
  onClick: () => void
}) {
  const time = formatTime(appt.scheduled_at)
  const status = appt.status || 'scheduled'

  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td>
        <div
          style={{
            width: 60,
            height: 56,
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--hairline)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{time.split(':')[0]}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{time.split(' ')[1] || time.split(':')[1]?.substring(0, 2)}</div>
        </div>
      </td>
      <td>
        <div className="name">{appt.lead_name || '—'}</div>
        <div className="meta">{appt.lead_phone || ''}</div>
      </td>
      <td>
        <div style={{ fontSize: 13 }}>{appt.property_title || '—'}</div>
        <div className="meta">{appt.property_location || ''}</div>
      </td>
      <td>
        <div className="meta">{appt.notes?.substring(0, 60) || '—'}</div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Pill variant={statusVariant(status)}>{status.replace('_', ' ')}</Pill>
      </td>
    </tr>
  )
}
