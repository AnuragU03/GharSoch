'use client'

import { Pill } from '@/components/Pill'
import type { PillVariant } from '@/components/Pill'
import type { SerializedCall } from '@/lib/services/callService'

function directionIcon(direction?: string, disposition?: string) {
  if (disposition === 'missed' || String(disposition).toLowerCase() === 'missed') return '✗'
  if (direction === 'inbound') return '↘'
  return '↗'
}

function statusVariant(call: SerializedCall): PillVariant {
  const status = String(call.call_status || '').toLowerCase()
  const disposition = String(call.disposition || '').toLowerCase()
  if (disposition === 'missed' || status === 'missed') return 'failed'
  if (status === 'completed' || status === 'connected') return 'success'
  if (disposition === 'voicemail') return 'amber'
  if (status === 'queued' || status === 'in-progress') return 'running'
  return 'idle'
}

function statusLabel(call: SerializedCall) {
  const disposition = String(call.disposition || '').toLowerCase()
  if (disposition === 'missed') return 'missed'
  if (disposition === 'voicemail') return 'voicemail'
  return call.call_status || 'unknown'
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function CallRow({
  call,
  onClick,
}: {
  call: SerializedCall
  onClick: () => void
}) {
  const icon = directionIcon(call.direction, call.disposition)
  const variant = statusVariant(call)
  const label = statusLabel(call)

  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            background: call.direction === 'inbound' ? 'var(--green-soft)' : call.disposition === 'missed' ? 'var(--red-soft)' : 'var(--accent-soft)',
            color: call.direction === 'inbound' ? 'var(--green)' : call.disposition === 'missed' ? 'var(--red)' : 'var(--accent)',
          }}
        >
          {icon}
        </div>
      </td>
      <td>
        <div className="name">{call.lead_name || '—'}</div>
        <div className="meta">{call.lead_phone || ''}</div>
      </td>
      <td>
        <div style={{ fontSize: 13 }}>{call.agent_name || '—'}</div>
        <div className="meta">{call.campaign_id ? `Campaign: ${call.campaign_id}` : call.call_type || ''}</div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDuration(call.duration)}</div>
      </td>
      <td>
        <Pill variant={variant}>{label.replace('_', ' ')}</Pill>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="meta">{relativeTime(call.created_at)}</div>
      </td>
    </tr>
  )
}
