'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiOutlinePhone, HiOutlineMagnifyingGlass } from 'react-icons/hi2'

interface CallRecord { _id: string; lead_name: string; lead_phone: string; agent_name: string; direction: string; duration: number; disposition: string; call_outcome: string; call_summary: string; customer_interest_level: string; recording_url: string; created_at: string }

export default function CallLogsSection() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dirFilter, setDirFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (dirFilter !== 'all') p.set('direction', dirFilter)
    try { const r = await fetch(`/api/calls?${p}`); const d = await r.json(); if (d.success) { setCalls(d.calls); setTotal(d.total) } } catch {}
    setLoading(false)
  }, [search, dirFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const fmtDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Call Logs</h2><p className="text-sm text-muted-foreground">{total} calls recorded</p></div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search calls..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="inbound">Inbound</SelectItem></SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
      : calls.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlinePhone className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No call logs found.</p></div>
      : <div className="space-y-2">
        {calls.map(c => (
          <div key={c._id} className="border border-border rounded-lg bg-card overflow-hidden">
            <button className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-muted/20 transition-colors" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.direction === 'inbound' ? '#dbeafe' : '#fef3c7' }}>
                <HiOutlinePhone className="w-4 h-4" style={{ color: c.direction === 'inbound' ? '#1d4ed8' : '#92400e' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.lead_name || c.lead_phone || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{c.lead_phone} • {fmtDate(c.created_at)}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{fmtDuration(c.duration)}</span>
                <Badge variant="outline" className="text-[10px]">{c.direction}</Badge>
                {c.disposition && <Badge variant="secondary" className="text-[10px]">{c.disposition}</Badge>}
                {c.customer_interest_level && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.customer_interest_level === 'hot' ? '#ef4444' : c.customer_interest_level === 'warm' ? '#f59e0b' : '#3b82f6' }} />}
              </div>
            </button>
            {expanded === c._id && (
              <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-2">
                {c.call_summary && <div><span className="text-xs font-medium text-muted-foreground">Summary:</span><p className="text-sm mt-0.5">{c.call_summary}</p></div>}
                {c.call_outcome && <div className="flex gap-4 text-xs"><span className="text-muted-foreground">Outcome: <span className="text-foreground font-medium">{c.call_outcome}</span></span></div>}
                {c.recording_url && <a href={c.recording_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Play Recording ↗</a>}
              </div>
            )}
          </div>
        ))}
      </div>}
    </div>
  )
}
