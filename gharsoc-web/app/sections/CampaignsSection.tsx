'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HiOutlineMegaphone, HiOutlinePlus, HiOutlineArrowDownTray } from 'react-icons/hi2'
import { FiPlay, FiSquare, FiTrash2 } from 'react-icons/fi'
import { downloadCSV } from '@/lib/download'

interface Campaign { _id: string; name: string; description: string; script_template: string; target_lead_ids: string[]; status: string; calls_made: number; calls_connected: number; created_at: string }

export default function CampaignsSection() {
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ name: '', description: '', script_template: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/campaigns'); const d = await r.json(); if (d.success) setItems(d.campaigns) } catch {}
    setLoading(false)
    setSelectedIds(new Set())
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if ((await r.json()).success) { setShowAdd(false); setForm({ name: '', description: '', script_template: '' }); fetchData() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' }); fetchData()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected campaign(s)?`)) return
    await fetch('/api/campaigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchData()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${items.length} campaigns? This cannot be undone.`)) return
    await fetch('/api/campaigns?all=true', { method: 'DELETE' })
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
      setSelectedIds(new Set(items.map(c => c._id)))
    }
  }

  const handleTrigger = async (id: string) => {
    if (!confirm('Start calling all assigned leads?')) return
    try {
      const r = await fetch('/api/campaigns/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: id }) })
      const d = await r.json()
      alert(d.success ? `Started: ${d.message}` : `Failed: ${d.error}`)
      fetchData()
    } catch { alert('Failed') }
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length

  const handleDownloadCSV = () => {
    const rows = items.map(c => ({
      'Name': c.name,
      'Description': c.description || '',
      'Status': c.status,
      'Total Leads': c.target_lead_ids?.length || 0,
      'Calls Made': c.calls_made,
      'Calls Connected': c.calls_connected,
      'Created': new Date(c.created_at).toLocaleDateString('en-IN'),
    }))
    downloadCSV(rows, `campaigns-${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Campaigns</h2><p className="text-sm text-muted-foreground">Automated outbound calling</p></div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteSelected}>
              <FiTrash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDeleteAll}>
            <FiTrash2 className="w-3.5 h-3.5" /> Delete All
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV} disabled={items.length === 0}>
            <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><HiOutlinePlus className="w-4 h-4" /> New Campaign</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label className="text-xs">Campaign Name *</Label><Input placeholder="Festive Offer 2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs">Description</Label><Input placeholder="Targeting warm leads for 2BHKs" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><Label className="text-xs">Script Instructions for Sunrise Property</Label><Textarea placeholder="Pitch the new Prestige Lakeside project..." value={form.script_template} onChange={e => setForm(f => ({ ...f, script_template: e.target.value }))} rows={4} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={!form.name}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none w-fit">
          <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all campaigns" />
          Select all
        </label>
      )}

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p>
      : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlineMegaphone className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No campaigns found.</p></div>
      : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(c => (
          <div key={c._id} className={`border rounded-xl bg-card p-5 transition-shadow hover:shadow-sm ${selectedIds.has(c._id) ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Checkbox
                  checked={selectedIds.has(c._id)}
                  onCheckedChange={() => toggleSelect(c._id)}
                  aria-label={`Select ${c.name}`}
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">{c.name} <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge></h3>
                  <p className="text-xs text-muted-foreground mt-1">{c.description || 'No description'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 py-3 border-y border-border/50">
              <div className="text-center"><p className="text-xl font-bold">{c.target_lead_ids?.length || 0}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads</p></div>
              <div className="text-center"><p className="text-xl font-bold">{c.calls_made}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Calls Made</p></div>
              <div className="text-center"><p className="text-xl font-bold text-emerald-500">{c.calls_connected}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connected</p></div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <Button size="sm" className="h-8 gap-1" onClick={() => handleTrigger(c._id)} disabled={c.status === 'active'}><FiPlay className="w-3.5 h-3.5" /> Start</Button>
                {c.status === 'active' && <Button variant="outline" size="sm" className="h-8 gap-1 text-amber-600"><FiSquare className="w-3.5 h-3.5" /> Stop</Button>}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(c._id)}><FiTrash2 className="w-4 h-4 text-muted-foreground" /></Button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}
