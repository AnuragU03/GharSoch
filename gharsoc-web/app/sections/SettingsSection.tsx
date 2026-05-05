'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { HiOutlineNoSymbol, HiOutlinePlus, HiOutlineBuildingOffice2 } from 'react-icons/hi2'
import { FiTrash2 } from 'react-icons/fi'

const CITIES = ['Ahmedabad', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai'] as const

interface Builder {
  _id: string; name: string; city: string; notable_projects: string[]
  description: string; website: string; created_at: string
}

const CITY_COLORS: Record<string, string> = {
  Ahmedabad: '#f59e0b', Bangalore: '#10b981', Mumbai: '#3b82f6',
  Delhi: '#8b5cf6', Chennai: '#ef4444',
}

function BuildersPanel() {
  const [builders, setBuilders] = useState<Builder[]>([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', notable_projects: '', description: '', website: '' })

  const fetchBuilders = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (cityFilter !== 'all') p.set('city', cityFilter)
      const r = await fetch(`/api/builders?${p}`)
      const d = await r.json()
      if (d.success) setBuilders(d.builders)
    } catch {}
    setLoading(false)
    setSelectedIds(new Set())
  }

  useEffect(() => { fetchBuilders() }, [cityFilter])

  const handleAdd = async () => {
    if (!form.name || !form.city) return
    const r = await fetch('/api/builders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, notable_projects: form.notable_projects }),
    })
    if ((await r.json()).success) {
      setShowAdd(false)
      setForm({ name: '', city: '', notable_projects: '', description: '', website: '' })
      fetchBuilders()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this builder?')) return
    await fetch(`/api/builders?id=${id}`, { method: 'DELETE' })
    fetchBuilders()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected builder(s)?`)) return
    await fetch('/api/builders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchBuilders()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${builders.length} builders? This cannot be undone.`)) return
    await fetch('/api/builders?all=true', { method: 'DELETE' })
    fetchBuilders()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === builders.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(builders.map(b => b._id)))
  }

  const allSelected = builders.length > 0 && selectedIds.size === builders.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < builders.length

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="p-5 border-b border-border bg-muted/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><HiOutlineBuildingOffice2 className="text-primary" /> Builder Knowledge Base</h3>
            <p className="text-sm text-muted-foreground mt-1">Top builders per city, used by the voice agent to answer property queries. Stored persistently in DB.</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><HiOutlinePlus className="w-4 h-4" /> Add Builder</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Builder</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div><Label className="text-xs">Builder Name *</Label><Input placeholder="Prestige Group" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs">City *</Label>
                  <Select value={form.city} onValueChange={v => setForm(f => ({ ...f, city: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Notable Projects (comma-separated)</Label><Input placeholder="Project A, Project B, Project C" value={form.notable_projects} onChange={e => setForm(f => ({ ...f, notable_projects: e.target.value }))} /></div>
                <div className="col-span-2"><Label className="text-xs">Description</Label><Textarea placeholder="Brief description for the voice agent..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                <div className="col-span-2"><Label className="text-xs">Website</Label><Input placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={!form.name || !form.city}>Add Builder</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" className="h-7 gap-1 text-xs" onClick={handleDeleteSelected}>
                <FiTrash2 className="w-3 h-3" /> Delete Selected ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDeleteAll}>
              <FiTrash2 className="w-3 h-3" /> Delete All
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/20">
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all builders"
                />
              </th>
              {['Builder', 'City', 'Notable Projects', 'Description', 'Action'].map(h => (
                <th key={h} className={`px-4 py-2.5 font-medium text-xs uppercase text-muted-foreground ${h === 'Action' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : builders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground"><HiOutlineBuildingOffice2 className="w-8 h-8 mx-auto mb-2 opacity-30" />No builders found.</td></tr>
              ) : builders.map(b => (
                <tr key={b._id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedIds.has(b._id) ? 'bg-muted/30' : ''}`}>
                  <td className="px-4 py-3">
                    <Checkbox checked={selectedIds.has(b._id)} onCheckedChange={() => toggleSelect(b._id)} aria-label={`Select ${b.name}`} />
                  </td>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" style={{ borderColor: CITY_COLORS[b.city], color: CITY_COLORS[b.city] }}>{b.city}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                    {(b.notable_projects || []).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-sm truncate">{b.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(b._id)}>
                      <FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function SettingsSection() {
  const [dncList, setDncList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set())

  const fetchDnc = async () => {
    setLoading(true)
    try { const r = await fetch('/api/dnc'); const d = await r.json(); if (d.success) setDncList(d.dnc) } catch {}
    setLoading(false)
    setSelectedPhones(new Set())
  }

  useEffect(() => { fetchDnc() }, [])

  const handleAddDnc = async () => {
    if (!phone) return
    const r = await fetch('/api/dnc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, reason }) })
    if ((await r.json()).success) { setPhone(''); setReason(''); fetchDnc() }
  }

  const handleRemoveDnc = async (p: string) => {
    if (!confirm('Remove from DNC?')) return
    await fetch(`/api/dnc?phone=${encodeURIComponent(p)}`, { method: 'DELETE' }); fetchDnc()
  }

  const handleRemoveSelected = async () => {
    if (!selectedPhones.size) return
    if (!confirm(`Remove ${selectedPhones.size} number(s) from DNC?`)) return
    await fetch('/api/dnc', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones: Array.from(selectedPhones) }),
    })
    fetchDnc()
  }

  const handleRemoveAll = async () => {
    if (!confirm(`Remove ALL ${dncList.length} numbers from DNC registry? This cannot be undone.`)) return
    await fetch('/api/dnc?all=true', { method: 'DELETE' })
    fetchDnc()
  }

  const toggleSelect = (p: string) => {
    setSelectedPhones(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedPhones.size === dncList.length) {
      setSelectedPhones(new Set())
    } else {
      setSelectedPhones(new Set(dncList.map(d => d.phone)))
    }
  }

  const allSelected = dncList.length > 0 && selectedPhones.size === dncList.length
  const someSelected = selectedPhones.size > 0 && selectedPhones.size < dncList.length

  return (
    <div className="max-w-4xl space-y-8">
      <div><h2 className="text-xl font-bold">Settings</h2><p className="text-sm text-muted-foreground">Platform configuration and compliance</p></div>

      <BuildersPanel />

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/10">
          <h3 className="font-semibold flex items-center gap-2"><HiOutlineNoSymbol className="text-destructive" /> Do Not Call (DNC) Registry</h3>
          <p className="text-sm text-muted-foreground mt-1">Numbers listed here will never be dialed by the outbound campaigns or agents. TRAI compliance is strictly enforced.</p>
        </div>
        <div className="p-5">
          <div className="flex gap-3 items-end mb-6">
            <div><Label className="text-xs">Phone Number *</Label><Input placeholder="+91..." value={phone} onChange={e => setPhone(e.target.value)} className="w-48" /></div>
            <div className="flex-1"><Label className="text-xs">Reason (optional)</Label><Input placeholder="Customer requested" value={reason} onChange={e => setReason(e.target.value)} /></div>
            <Button onClick={handleAddDnc} disabled={!phone} variant="destructive">Block Number</Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all DNC entries"
                />
                <span className="text-xs font-medium uppercase text-muted-foreground">Number</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedPhones.size > 0 && (
                  <Button variant="destructive" size="sm" className="h-7 gap-1 text-xs" onClick={handleRemoveSelected}>
                    <FiTrash2 className="w-3 h-3" /> Remove Selected ({selectedPhones.size})
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleRemoveAll}>
                  <FiTrash2 className="w-3 h-3" /> Remove All
                </Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/10">
                <th className="w-10 px-4 py-2" />
                <th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Number</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Added On</th>
                <th className="text-right px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Action</th>
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center">Loading...</td></tr>
                ) : dncList.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">No numbers in DNC registry.</td></tr>
                ) : dncList.map(d => (
                  <tr key={d.phone} className={`border-b border-border/50 ${selectedPhones.has(d.phone) ? 'bg-muted/30' : ''}`}>
                    <td className="px-4 py-2.5">
                      <Checkbox checked={selectedPhones.has(d.phone)} onCheckedChange={() => toggleSelect(d.phone)} aria-label={`Select ${d.phone}`} />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{d.phone}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(d.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRemoveDnc(d.phone)}><FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card p-5 opacity-60">
        <h3 className="font-semibold">Integrations</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">API Keys and Webhooks (Configured via Environment Variables)</p>
        <div className="space-y-3 max-w-lg">
          <div><Label className="text-xs">Vapi API Key</Label><Input value="••••••••••••••••••••••••" disabled /></div>
          <div><Label className="text-xs">Twilio Account SID</Label><Input value="••••••••••••••••••••••••" disabled /></div>
          <div><Label className="text-xs">OpenAI Key</Label><Input value="••••••••••••••••••••••••" disabled /></div>
        </div>
      </div>
    </div>
  )
}
