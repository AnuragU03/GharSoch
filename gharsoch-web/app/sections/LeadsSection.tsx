'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineUser, HiOutlineArrowDownTray, HiChevronDown } from 'react-icons/hi2'
import { FiTrash2, FiPhoneCall, FiEdit } from 'react-icons/fi'
import { downloadExcel, downloadCSV } from '@/lib/download'
import { useUserRole } from '@/lib/auth/useUserRole'

const CITIES = ['Ahmedabad', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai'] as const

interface Lead {
  _id: string; name: string; phone: string; email: string; source: string
  status: string; budget_range: string; location_pref: string; property_type: string
  interest_level: string; qualification_status: string; lead_score: number
  total_calls: number; dnd_status: boolean; notes: string; timeline: string
  place: string; created_at: string; next_follow_up_date?: string | null; followup_reason?: string
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6', contacted: '#f59e0b', qualified: '#10b981',
  follow_up: '#8b5cf6', lost: '#ef4444', closed: '#6b7280',
}
const INTEREST_COLORS: Record<string, string> = {
  hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6', unknown: '#6b7280',
}

export default function LeadsSection() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [interestFilter, setInterestFilter] = useState('all')
  const [placeFilter, setPlaceFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [callingId, setCallingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '', budget_range: '', location_pref: '', property_type: '', notes: '', timeline: '', place: '', next_follow_up_date: '', followup_reason: '' })
  const { role } = useUserRole()
  const canAdd = role === 'admin' || role === 'tech'

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (statusFilter !== 'all') p.set('status', statusFilter)
    if (interestFilter !== 'all') p.set('interest', interestFilter)
    if (placeFilter !== 'all') p.set('place', placeFilter)
    try {
      const r = await fetch(`/api/leads?${p}`)
      const d = await r.json()
      if (d.success) { setLeads(d.leads); setTotal(d.total) }
    } catch {}
    setLoading(false)
    setSelectedIds(new Set())
  }, [search, statusFilter, interestFilter, placeFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleSave = async () => {
    const url = '/api/leads'
    const method = editingId ? 'PUT' : 'POST'
    const body = editingId ? { ...form, _id: editingId } : form
    
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if ((await r.json()).success) { 
      setShowAdd(false); 
      setForm({ name: '', phone: '', email: '', source: '', budget_range: '', location_pref: '', property_type: '', notes: '', timeline: '', place: '', next_follow_up_date: '', followup_reason: '' }); 
      setEditingId(null);
      fetchLeads() 
    }
  }

  const handleEditClick = (lead: Lead) => {
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      budget_range: lead.budget_range || '',
      location_pref: lead.location_pref || '',
      property_type: lead.property_type || '',
      notes: lead.notes || '',
      timeline: lead.timeline || '',
      place: lead.place || '',
      next_follow_up_date: lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toISOString().slice(0, 16) : '',
      followup_reason: lead.followup_reason || ''
    })
    setEditingId(lead._id)
    setShowAdd(true)
  }

  const handleOpenAdd = () => {
    setForm({ name: '', phone: '', email: '', source: '', budget_range: '', location_pref: '', property_type: '', notes: '', timeline: '', place: '', next_follow_up_date: '', followup_reason: '' })
    setEditingId(null)
    setShowAdd(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/leads?id=${id}`, { method: 'DELETE' }); fetchLeads()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected lead(s)?`)) return
    await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchLeads()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${total} leads? This cannot be undone.`)) return
    await fetch('/api/leads?all=true', { method: 'DELETE' })
    fetchLeads()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map(l => l._id)))
    }
  }

  const handleCall = async (lead: Lead) => {
    if (lead.dnd_status) { alert('This lead is on the Do Not Call list.'); return }
    setCallingId(lead._id)
    try {
      const r = await fetch('/api/campaigns/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead._id }) })
      const d = await r.json()
      alert(d.success ? `Call triggered! ID: ${d.callId}` : `Failed: ${d.error}`)
    } catch { alert('Failed to trigger call') }
    setCallingId(null)
  }

  const allSelected = leads.length > 0 && selectedIds.size === leads.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < leads.length

  const leadsToRows = (data: Lead[]) => data.map(l => ({
    'Name': l.name,
    'Phone': l.phone,
    'Email': l.email,
    'Source': l.source,
    'Status': l.status,
    'Interest Level': l.interest_level,
    'Lead Score': l.lead_score,
    'Budget': l.budget_range,
    'Location Pref': l.location_pref,
    'Property Type': l.property_type,
    'Qualification': l.qualification_status,
    'Total Calls': l.total_calls,
    'DND': l.dnd_status ? 'Yes' : 'No',
    'Notes': l.notes,
    'Timeline': l.timeline,
    'Created': new Date(l.created_at).toLocaleDateString('en-IN'),
  }))

  const handleDownloadExcel = () => {
    downloadExcel(leadsToRows(leads), `leads-${new Date().toISOString().slice(0, 10)}`, 'Leads')
  }

  const handleDownloadCSV = () => {
    downloadCSV(leadsToRows(leads), `leads-${new Date().toISOString().slice(0, 10)}`)
  }

  const FilterHeader = ({ title, value, onChange, options }: { title: string, value: string, onChange: (v: string) => void, options: string[] }) => (
    <div className="flex items-center gap-1 cursor-pointer">
      {title}
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none focus:outline-none">
          <HiChevronDown className={`w-3.5 h-3.5 ${value !== 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
          <DropdownMenuItem onClick={() => onChange('all')} className={`text-xs ${value === 'all' ? 'font-bold bg-muted/50' : ''}`}>All</DropdownMenuItem>
          {options.map(o => (
            <DropdownMenuItem key={o} onClick={() => onChange(o)} className={`text-xs ${value === o ? 'font-bold bg-muted/50' : ''}`}>
              {o}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Leads</h2>
          <p className="text-sm text-muted-foreground">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteSelected}>
              <FiTrash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDeleteAll}>
            <FiTrash2 className="w-3.5 h-3.5" /> Delete All
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV} disabled={leads.length === 0}>
            <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadExcel} disabled={leads.length === 0}>
            <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> Excel
          </Button>
          {canAdd && (
            <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setEditingId(null); }}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5" onClick={handleOpenAdd}><HiOutlinePlus className="w-4 h-4" /> Add Lead</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editingId ? 'Edit Lead' : 'Add New Lead'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div><Label className="text-xs">Name *</Label><Input placeholder="Rahul Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs">Phone *</Label><Input placeholder="+919876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label className="text-xs">Email</Label><Input placeholder="rahul@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label className="text-xs">Source</Label>
                  <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['website','referral','social','walk-in','cold-call','magicbricks','99acres'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Place *</Label>
                  <Select value={form.place} onValueChange={v => setForm(f => ({ ...f, place: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Budget</Label><Input placeholder="40-60 Lakhs" value={form.budget_range} onChange={e => setForm(f => ({ ...f, budget_range: e.target.value }))} /></div>
                <div><Label className="text-xs">Location</Label><Input placeholder="Whitefield" value={form.location_pref} onChange={e => setForm(f => ({ ...f, location_pref: e.target.value }))} /></div>
                <div><Label className="text-xs">Type</Label>
                  <Select value={form.property_type} onValueChange={v => setForm(f => ({ ...f, property_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{['1BHK','2BHK','3BHK','4BHK','Villa','Plot'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Timeline</Label><Input placeholder="3 months" value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))} /></div>
                <div><Label className="text-xs">Follow-up Time</Label><Input type="datetime-local" value={form.next_follow_up_date} onChange={e => setForm(f => ({ ...f, next_follow_up_date: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Follow-up Reason</Label><Input placeholder="Why are we following up?" value={form.followup_reason} onChange={e => setForm(f => ({ ...f, followup_reason: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setEditingId(null); }}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={!form.name || !form.phone || !form.place}>
                  {editingId ? 'Save Changes' : 'Add Lead'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30">
            <th className="px-4 py-2.5 w-10">
              <Checkbox
                checked={allSelected}
                ref={(el) => { if (el) (el as any).indeterminate = someSelected }}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all"
              />
            </th>
            {['Name','Phone','Status','Interest','Budget','Follow-up','Place','Calls','Actions'].map(h => (
              <th key={h} className={`px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                {h === 'Status' ? <FilterHeader title="Status" value={statusFilter} onChange={setStatusFilter} options={['new','contacted','qualified','follow_up','lost','closed']} />
                 : h === 'Interest' ? <FilterHeader title="Interest" value={interestFilter} onChange={setInterestFilter} options={['hot','warm','cold','unknown']} />
                 : h === 'Place' ? <FilterHeader title="Place" value={placeFilter} onChange={setPlaceFilter} options={[...CITIES]} />
                 : h}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            : leads.length === 0 ? <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground"><HiOutlineUser className="w-8 h-8 mx-auto mb-2 opacity-30" />No leads found.</td></tr>
            : leads.map(l => (
              <tr key={l._id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedIds.has(l._id) ? 'bg-muted/30' : ''}`}>
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.has(l._id)} onCheckedChange={() => toggleSelect(l._id)} aria-label={`Select ${l.name}`} />
                </td>
                <td className="px-4 py-3"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.email}</div></td>
                <td className="px-4 py-3 text-muted-foreground">{l.phone}</td>
                <td className="px-4 py-3"><Badge variant="outline" style={{ borderColor: STATUS_COLORS[l.status], color: STATUS_COLORS[l.status] }}>{l.status}</Badge></td>
                <td className="px-4 py-3"><span className="text-xs font-medium flex items-center gap-1" style={{ color: INTEREST_COLORS[l.interest_level] || '#6b7280' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: INTEREST_COLORS[l.interest_level] || '#6b7280' }} />{l.interest_level}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.budget_range || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {l.next_follow_up_date ? (
                    <div className="text-emerald-500 font-medium whitespace-nowrap">
                      {new Date(l.next_follow_up_date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                  {l.followup_reason && <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={l.followup_reason}>{l.followup_reason}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.place || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.total_calls}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCall(l)} disabled={callingId === l._id}><FiPhoneCall className="w-3.5 h-3.5" style={{ color: 'hsl(25,70%,45%)' }} /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditClick(l)}><FiEdit className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(l._id)}><FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
