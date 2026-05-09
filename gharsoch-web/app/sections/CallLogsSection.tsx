'use client'

import { useState } from 'react'
import { StatStrip } from '@/components/StatStrip'
import { CallRow } from '@/components/CallRow'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { SerializedCall, CallDetail, CallStripData } from '@/lib/services/callService'

type FilterType = 'all' | 'outbound' | 'inbound' | 'missed' | 'voicemail'

function matchesFilter(call: SerializedCall, filter: FilterType) {
  if (filter === 'all') return true
  if (filter === 'outbound') return call.direction === 'outbound'
  if (filter === 'inbound') return call.direction === 'inbound'
  if (filter === 'missed') return String(call.disposition || '').toLowerCase() === 'missed' || String(call.call_status || '').toLowerCase() === 'missed'
  if (filter === 'voicemail') return String(call.disposition || '').toLowerCase() === 'voicemail'
  return true
}

function CallDetailDrawer({ detail, open, onClose }: { detail: CallDetail | null; open: boolean; onClose: () => void }) {
  const transcript: Array<{ speaker: string; text: string }> = (() => {
    const raw = detail?.linked_run?.input_data?.transcript || detail?.linked_run?.output_data?.transcript
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map((l: any) => ({ speaker: String(l.speaker || l.role || 'Agent'), text: String(l.text || l.content || '') })).filter(l => l.text)
    if (typeof raw === 'string') return raw.split('\n').filter(Boolean).map(line => {
      const [s, ...rest] = line.split(':')
      return rest.length ? { speaker: s.trim(), text: rest.join(':').trim() } : { speaker: 'Agent', text: line }
    })
    return []
  })()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[560px] max-w-[92vw] overflow-y-auto border-hairline bg-surface p-0 shadow-elev-2">
        <div className="drawer-head">
          <div>
            <SheetTitle className="m-0 text-[16px] font-semibold text-ink">
              {detail?.lead_name || 'Call detail'}
            </SheetTitle>
            <div className="runid">
              {detail ? `${detail.direction || ''} · ${detail.call_status || ''} · ${detail.duration || 0}s` : 'Loading…'}
            </div>
          </div>
        </div>
        {detail && (
          <div className="drawer">
            <div className="drawer-section">
              <h4>Call metadata</h4>
              <div className="step eval" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead</div><div style={{ fontSize: 13 }}>{detail.lead_name} · {detail.lead_phone}</div></div>
                <div><div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direction</div><div style={{ fontSize: 13 }}>{detail.direction || '—'}</div></div>
                <div><div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div><div style={{ fontSize: 13 }}>{detail.duration || 0}s</div></div>
                <div><div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div><div style={{ fontSize: 13 }}>{detail.call_status || '—'}</div></div>
                {detail.linked_property && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Property</div>
                    <div style={{ fontSize: 13 }}>{detail.linked_property.title} · {detail.linked_property.location}</div>
                  </div>
                )}
              </div>
            </div>
            {(detail as any).recording_url && (
              <div className="drawer-section">
                <h4>Recording</h4>
                <audio controls src={(detail as any).recording_url} style={{ width: '100%', borderRadius: 8 }} />
              </div>
            )}
            {transcript.length > 0 && (
              <div className="drawer-section">
                <h4>Transcript</h4>
                {transcript.map((line, i) => {
                  const isCustomer = /customer|cust|lead|buyer|client|user/i.test(line.speaker)
                  return (
                    <div className={`transcript-line${isCustomer ? ' cust' : ''}`} key={i}>
                      <b>{line.speaker}:</b> {line.text}
                    </div>
                  )
                })}
              </div>
            )}
            {detail.linked_run && (
              <div className="drawer-section">
                <h4>Linked agent run</h4>
                <div className="step tool">
                  <div className="kind">{detail.linked_run.agent_name} · {detail.linked_run.status}</div>
                  {detail.linked_run.reasoning_summary?.summary && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>{detail.linked_run.reasoning_summary.summary}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'monospace' }}>run_id: {detail.linked_run.run_id}</div>
                </div>
              </div>
            )}
            {(detail as any).call_summary && (
              <div className="drawer-section">
                <h4>Summary</h4>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{(detail as any).call_summary}</div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function CallLogsSection({ calls, strip }: { calls: SerializedCall[]; strip: CallStripData }) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDetail, setDrawerDetail] = useState<CallDetail | null>(null)

  const filtered = calls.filter(c => matchesFilter(c, filter))

  const handleRowClick = async (id: string) => {
    setDrawerDetail(null)
    setDrawerOpen(true)
    try {
      const res = await fetch(`/api/calls/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDrawerDetail(data.data || null)
      }
    } catch { /* ignore */ }
  }

  const stripCells = [
    { label: 'Calls today', value: String(strip.callsToday) },
    { label: 'Connected', value: String(strip.connected) },
    { label: 'Avg duration', value: strip.avgDuration },
    { label: 'Booked', value: String(strip.booked) },
    { label: 'DNC marked', value: String(strip.dncMarked) },
    { label: 'Vapi minutes', value: String(strip.vapiMinutes) },
  ]

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'outbound', label: 'Outbound' },
    { key: 'inbound', label: 'Inbound' },
    { key: 'missed', label: 'Missed' },
    { key: 'voicemail', label: 'Voicemail' },
  ]

  return (
    <>
      <section className="page active">
        <div className="crumb">Work · Call Logs</div>
        <div className="head">
          <div>
            <h1 className="title">Call Logs</h1>
            <p className="sub">Full history of inbound, outbound, and missed calls handled by the fleet.</p>
          </div>
        </div>

        <StatStrip cells={stripCells} />

        <div className="panel">
          <div className="panel-head">
            <div style={{ display: 'flex', gap: 8 }}>
              {filters.map(f => (
                <button key={f.key} type="button" className={`btn sm${filter === f.key ? ' primary' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{filtered.length} calls</div>
          </div>
          <div className="panel-body p-0">
            {filtered.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Lead</th>
                    <th>Agent / Campaign</th>
                    <th style={{ textAlign: 'right' }}>Duration</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>{filtered.map(c => <CallRow key={c._id} call={c} onClick={() => handleRowClick(c._id)} />)}</tbody>
              </table>
            ) : (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                No calls found for this filter.
              </div>
            )}
          </div>
        </div>
      </section>

      <CallDetailDrawer detail={drawerDetail} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}

export default CallLogsSection
