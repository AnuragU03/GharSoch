'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HiOutlinePhone, HiOutlineMagnifyingGlass, HiOutlineArrowDownTray, HiOutlineArrowPath } from 'react-icons/hi2'
import { FiTrash2 } from 'react-icons/fi'
import { downloadExcel, downloadRecording, downloadTranscript } from '@/lib/download'

interface CallRecord {
  _id: string
  lead_name: string
  lead_phone: string
  agent_name: string
  direction: string
  duration: number
  disposition: string
  call_outcome: string
  call_summary: string
  customer_interest_level: string
  recording_url: string
  transcript: string
  call_status: string
  key_requirements: string
  customer_objections: string
  next_steps: string
  follow_up_required: boolean
  follow_up_notes: string
  vapi_call_id: string
  created_at: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'in-progress': { bg: '#fef3c7', text: '#92400e', label: 'In Progress' },
  'queued': { bg: '#e0e7ff', text: '#3730a3', label: 'Queued' },
  'ringing': { bg: '#e0e7ff', text: '#3730a3', label: 'Ringing' },
  'completed': { bg: '#d1fae5', text: '#065f46', label: 'Completed' },
  'failed': { bg: '#fee2e2', text: '#991b1b', label: 'Failed' },
}

export default function CallLogsSection() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dirFilter, setDirFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const autoSyncRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (dirFilter !== 'all') p.set('direction', dirFilter)
    try { const r = await fetch(`/api/calls?${p}`); const d = await r.json(); if (d.success) { setCalls(d.calls); setTotal(d.total) } } catch {}
    setLoading(false)
    if (showRefresh) setRefreshing(false)
    setSelectedIds(new Set())
  }, [search, dirFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-sync: poll for in-progress calls every 15 seconds
  useEffect(() => {
    const hasInProgress = calls.some(c => ['in-progress', 'queued', 'ringing'].includes(c.call_status))
    if (hasInProgress) {
      autoSyncRef.current = setInterval(async () => {
        try {
          await fetch('/api/calls/sync', { method: 'POST' })
          fetchData()
        } catch {}
      }, 15000)
    }
    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current)
    }
  }, [calls, fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await fetch('/api/calls/sync', { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        setSyncResult(`Synced ${d.synced} of ${d.total} calls`)
        fetchData()
      } else {
        setSyncResult(`Sync failed: ${d.error}`)
      }
    } catch {
      setSyncResult('Sync failed: network error')
    }
    setSyncing(false)
    setTimeout(() => setSyncResult(null), 4000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this call log?')) return
    await fetch(`/api/calls?id=${id}`, { method: 'DELETE' }); fetchData()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected call log(s)?`)) return
    await fetch('/api/calls', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchData()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${total} call logs? This cannot be undone.`)) return
    await fetch('/api/calls?all=true', { method: 'DELETE' })
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
    if (selectedIds.size === calls.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(calls.map(c => c._id)))
    }
  }

  const fmtDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const allSelected = calls.length > 0 && selectedIds.size === calls.length
  const pendingCount = calls.filter(c => ['in-progress', 'queued', 'ringing'].includes(c.call_status)).length

  const handleDownloadTranscript = async (c: CallRecord) => {
    if (!c.transcript) return
    const namePart = (c.lead_name || c.lead_phone || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')
    
    // Format date as YYYY-MM-DD_HH-mm
    const d = new Date(c.created_at)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`
    
    const filename = `transcript_${namePart}_${dateStr}`
    await downloadTranscript(c.transcript, filename)
  }

  const handleDownloadExcel = () => {
    const rows = calls.map(c => ({
      'Lead Name': c.lead_name || '',
      'Phone': c.lead_phone || '',
      'Agent': c.agent_name || '',
      'Direction': c.direction,
      'Status': c.call_status || 'completed',
      'Duration': fmtDuration(c.duration),
      'Disposition': c.disposition || '',
      'Outcome': c.call_outcome || '',
      'Interest Level': c.customer_interest_level || '',
      'Summary': c.call_summary || '',
      'Transcript': c.transcript || '',
      'Recording URL': c.recording_url || '',
      'Date': new Date(c.created_at).toLocaleString('en-IN'),
    }))
    downloadExcel(rows, `call-logs-${new Date().toISOString().slice(0, 10)}`, 'Call Logs')
  }

  const handleDownloadRecording = async (c: CallRecord) => {
    if (!c.recording_url) return
    const safeName = `recording-${c.lead_name || c.lead_phone || c._id}-${new Date(c.created_at).toISOString().slice(0, 10)}`
      .replace(/[^a-z0-9\-_]/gi, '_')
    await downloadRecording(c.recording_url, safeName)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Call Logs</h2>
          <p className="text-sm text-muted-foreground">
            {total} calls recorded
            {pendingCount > 0 && <span className="ml-2 text-amber-600 font-medium">- {pendingCount} in progress</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync} disabled={syncing}>
            <HiOutlineArrowPath className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Calls'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchData(true)} disabled={loading || refreshing}>
            <HiOutlineArrowPath className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadExcel} disabled={calls.length === 0}>
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
        </div>
      </div>

      {syncResult && (
        <div className="px-3 py-2 rounded-md text-sm bg-muted border border-border">
          {syncResult}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search calls..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="outbound">Outbound</SelectItem><SelectItem value="inbound">Inbound</SelectItem></SelectContent>
        </Select>
        {calls.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all calls" />
            Select all
          </label>
        )}
      </div>

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
      : calls.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlinePhone className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No call logs found.</p></div>
      : <div className="space-y-2">
        {calls.map(c => {
          const status = STATUS_STYLES[c.call_status] || STATUS_STYLES['completed']
          const isInProgress = ['in-progress', 'queued', 'ringing'].includes(c.call_status)

          return (
          <div key={c._id} className={`border rounded-lg bg-card overflow-hidden ${selectedIds.has(c._id) ? 'border-primary ring-1 ring-primary/30' : isInProgress ? 'border-amber-300 bg-amber-50/30' : 'border-border'}`}>
            <div className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/20 transition-colors">
              <Checkbox
                checked={selectedIds.has(c._id)}
                onCheckedChange={() => toggleSelect(c._id)}
                aria-label={`Select call from ${c.lead_name || c.lead_phone}`}
                className="flex-shrink-0"
              />
              <button className="flex items-center gap-4 flex-1 min-w-0 text-left" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isInProgress ? '#fef3c7' : c.direction === 'inbound' ? '#dbeafe' : '#fef3c7' }}>
                  {isInProgress
                    ? <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                    : <HiOutlinePhone className="w-4 h-4" style={{ color: c.direction === 'inbound' ? '#1d4ed8' : '#92400e' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{c.lead_name || c.lead_phone || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{c.lead_phone} - {fmtDate(c.created_at)}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{fmtDuration(c.duration)}</span>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: status.text, color: status.text, background: status.bg }}>
                    {status.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{c.direction}</Badge>
                  {c.disposition && <Badge variant="secondary" className="text-[10px]">{c.disposition}</Badge>}
                  {c.customer_interest_level && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.customer_interest_level === 'hot' ? '#ef4444' : c.customer_interest_level === 'warm' ? '#f59e0b' : '#3b82f6' }} />}
                </div>
              </button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => handleDelete(c._id)}>
                <FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
            {expanded === c._id && (
              <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
                {/* Call Summary */}
                {c.call_summary && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Summary:</span>
                    <p className="text-sm mt-0.5">{c.call_summary}</p>
                  </div>
                )}

                {/* Call Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {c.call_outcome && (
                    <div><span className="text-muted-foreground">Outcome:</span> <span className="font-medium">{c.call_outcome}</span></div>
                  )}
                  {c.customer_interest_level && (
                    <div><span className="text-muted-foreground">Interest:</span> <span className="font-medium capitalize">{c.customer_interest_level}</span></div>
                  )}
                  {c.key_requirements && (
                    <div className="col-span-2"><span className="text-muted-foreground">Requirements:</span> <span className="font-medium">{c.key_requirements}</span></div>
                  )}
                  {c.customer_objections && (
                    <div className="col-span-2"><span className="text-muted-foreground">Objections:</span> <span className="font-medium">{c.customer_objections}</span></div>
                  )}
                  {c.next_steps && (
                    <div className="col-span-2"><span className="text-muted-foreground">Next Steps:</span> <span className="font-medium">{c.next_steps}</span></div>
                  )}
                  {c.follow_up_required && c.follow_up_notes && (
                    <div className="col-span-2"><span className="text-muted-foreground">Follow-up:</span> <span className="font-medium">{c.follow_up_notes}</span></div>
                  )}
                </div>

                {/* Conversation Transcript */}
                {c.transcript && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Conversation Transcript:</span>
                      <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs px-2 text-muted-foreground hover:text-primary" onClick={() => handleDownloadTranscript(c)}>
                        <HiOutlineArrowDownTray className="w-3 h-3" /> Download .txt
                      </Button>
                    </div>
                    <div className="mt-1 max-h-60 overflow-y-auto rounded-md bg-muted/40 border border-border/50 p-3 space-y-1.5">
                      {c.transcript.split('\n').filter(Boolean).map((line, i) => {
                        const isAgent = line.startsWith('Agent:') || line.startsWith('AI:') || line.startsWith('assistant:') || line.startsWith('bot:')
                        const isCustomer = line.startsWith('Customer:') || line.startsWith('user:') || line.startsWith('human:')
                        const displayLine = line.replace(/^(Agent|Customer|AI|assistant|bot|user|human):\s*/i, '')

                        return (
                          <div key={i} className={`flex ${isAgent ? 'justify-start' : isCustomer ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                              isAgent ? 'bg-primary/10 text-foreground rounded-bl-none' :
                              isCustomer ? 'bg-muted text-foreground rounded-br-none' :
                              'bg-muted/60 text-muted-foreground italic'
                            }`}>
                              <span className={`font-semibold text-[10px] block mb-0.5 ${isAgent ? 'text-primary' : 'text-muted-foreground'}`}>
                                {isAgent ? 'Agent' : isCustomer ? 'Customer' : ''}
                              </span>
                              {displayLine}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recording */}
                {c.recording_url && (
                  <div className="flex items-center gap-3">
                    <a href={c.recording_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Play Recording</a>
                    <Button variant="outline" size="sm" className="h-6 gap-1 text-xs px-2" onClick={() => handleDownloadRecording(c)}>
                      <HiOutlineArrowDownTray className="w-3 h-3" /> Download .mp3
                    </Button>
                  </div>
                )}

                {/* In-progress notice */}
                {isInProgress && !c.transcript && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Call is in progress. Transcript and summary will appear after the call ends. Click &quot;Sync Calls&quot; to update.
                  </div>
                )}
              </div>
            )}
          </div>
        )})}
      </div>}
    </div>
  )
}
