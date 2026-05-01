'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineUser } from 'react-icons/hi2'
import { FiTrash2, FiPhoneCall } from 'react-icons/fi'

interface Lead {
  _id: string; name: string; phone: string; email: string; source: string
  status: string; budget_range: string; location_pref: string; property_type: string
  interest_level: string; qualification_status: string; lead_score: number
  total_calls: number; dnd_status: boolean; notes: string; timeline: string
  created_at: string
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
  const [showAdd, setShowAdd] = useState(false)
  const [callingId, setCallingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', source: '', budget_range: '', location_pref: '', property_type: '', notes: '', timeline: '' })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (statusFilter !== 'all') p.set('status', statusFilter)
    try {
      const r = await fetch(`/api/leads?${p}`)
      const d = await r.json()
      if (d.success) { setLeads(d.leads); setTotal(d.total) }
    } catch {}
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleAdd = async () => {
    const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if ((await r.json()).success) { setShowAdd(false); setForm({ name: '', phone: '', email: '', source: '', budget_range: '', location_pref: '', property_type: '', notes: '', timeline: '' }); fetchLeads() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/leads?id=${id}`, { method: 'DELETE' }); fetchLeads()
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Leads</h2>
          <p className="text-sm text-muted-foreground">{total} total leads</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><HiOutlinePlus className="w-4 h-4" /> Add Lead</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
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
              <div><Label className="text-xs">Budget</Label><Input placeholder="40-60 Lakhs" value={form.budget_range} onChange={e => setForm(f => ({ ...f, budget_range: e.target.value }))} /></div>
              <div><Label className="text-xs">Location</Label><Input placeholder="Whitefield" value={form.location_pref} onChange={e => setForm(f => ({ ...f, location_pref: e.target.value }))} /></div>
              <div><Label className="text-xs">Type</Label>
                <Select value={form.property_type} onValueChange={v => setForm(f => ({ ...f, property_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['1BHK','2BHK','3BHK','4BHK','Villa','Plot'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Timeline</Label><Input placeholder="3 months" value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!form.name || !form.phone}>Add Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>{['all','new','contacted','qualified','follow_up','lost','closed'].map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30">
            {['Name','Phone','Status','Interest','Score','Budget','Location','Calls','Actions'].map(h => (
              <th key={h} className={`px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            : leads.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground"><HiOutlineUser className="w-8 h-8 mx-auto mb-2 opacity-30" />No leads found.</td></tr>
            : leads.map(l => (
              <tr key={l._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.email}</div></td>
                <td className="px-4 py-3 text-muted-foreground">{l.phone}</td>
                <td className="px-4 py-3"><Badge variant="outline" style={{ borderColor: STATUS_COLORS[l.status], color: STATUS_COLORS[l.status] }}>{l.status}</Badge></td>
                <td className="px-4 py-3"><span className="text-xs font-medium flex items-center gap-1" style={{ color: INTEREST_COLORS[l.interest_level] || '#6b7280' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: INTEREST_COLORS[l.interest_level] || '#6b7280' }} />{l.interest_level}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${l.lead_score}%`, background: l.lead_score >= 70 ? '#10b981' : l.lead_score >= 40 ? '#f59e0b' : '#6b7280' }} /></div><span className="text-xs text-muted-foreground">{l.lead_score}</span></div></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.budget_range || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.location_pref || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.total_calls}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCall(l)} disabled={callingId === l._id}><FiPhoneCall className="w-3.5 h-3.5" style={{ color: 'hsl(25,70%,45%)' }} /></Button>
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
