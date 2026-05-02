'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineHome, HiOutlineCurrencyRupee } from 'react-icons/hi2'
import { FiTrash2 } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

interface Property { _id: string; title: string; type: string; location: string; price: number; area_sqft: number; bedrooms: number; status: string; builder: string; images: string[]; description: string; created_at: string }

export default function PropertiesSection() {
  const [items, setItems] = useState<Property[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', type: '', location: '', price: '', area_sqft: '', bedrooms: '', builder: '', description: '', status: 'available' })
  const [priceDropLoading, setPriceDropLoading] = useState<string | null>(null)
  const [priceDropResult, setPriceDropResult] = useState<{ id: string; success: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    try { const r = await fetch(`/api/properties?${p}`); const d = await r.json(); if (d.success) { setItems(d.properties); setTotal(d.total) } } catch {}
    setLoading(false)
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    const r = await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price), area_sqft: Number(form.area_sqft), bedrooms: Number(form.bedrooms) }) })
    if ((await r.json()).success) { setShowAdd(false); setForm({ title: '', type: '', location: '', price: '', area_sqft: '', bedrooms: '', builder: '', description: '', status: 'available' }); fetchData() }
  }

  const handleDelete = async (id: string) => { if (!confirm('Delete?')) return; await fetch(`/api/properties?id=${id}`, { method: 'DELETE' }); fetchData() }

  const handlePriceDrop = async (property: Property) => {
    if (!confirm(`Trigger AI Price Drop campaign for "${property.title}"? This will notify all budget-sensitive leads.`)) return
    setPriceDropLoading(property._id)
    setPriceDropResult(null)
    try {
      const res = await fetch('/api/agent/price-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: property._id, new_price: property.price }),
      })
      const data = await res.json()
      setPriceDropResult({ id: property._id, success: data.success })
      setTimeout(() => setPriceDropResult(null), 5000)
    } catch {
      setPriceDropResult({ id: property._id, success: false })
    }
    setPriceDropLoading(null)
  }

  const formatPrice = (p: number) => p >= 10000000 ? `₹${(p / 10000000).toFixed(1)} Cr` : `₹${(p / 100000).toFixed(0)} L`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold">Properties</h2><p className="text-sm text-muted-foreground">{total} listings</p></div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5"><HiOutlinePlus className="w-4 h-4" /> Add Property</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2"><Label className="text-xs">Title *</Label><Input placeholder="Prestige Lakeside Habitat" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['1BHK','2BHK','3BHK','4BHK','Villa','Plot','Commercial'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Location *</Label><Input placeholder="Whitefield, Bangalore" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><Label className="text-xs">Price (₹)</Label><Input type="number" placeholder="6000000" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label className="text-xs">Area (sqft)</Label><Input type="number" placeholder="1200" value={form.area_sqft} onChange={e => setForm(f => ({ ...f, area_sqft: e.target.value }))} /></div>
              <div><Label className="text-xs">Bedrooms</Label><Input type="number" placeholder="2" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} /></div>
              <div><Label className="text-xs">Builder</Label><Input placeholder="Prestige Group" value={form.builder} onChange={e => setForm(f => ({ ...f, builder: e.target.value }))} /></div>
              <div className="col-span-2"><Label className="text-xs">Description</Label><Textarea placeholder="Property description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!form.title || !form.location}>Add Property</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm"><HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search properties..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>

      {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
      : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlineHome className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No properties. Add your first listing.</p></div>
      : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(p => (
          <div key={p._id} className="border border-border rounded-xl bg-card overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-32 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(25,70%,45%) 0%, hsl(25,50%,35%) 100%)' }}>
              <HiOutlineHome className="w-10 h-10 text-white/40" />
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground text-sm leading-tight">{p.title}</h3>
                <Badge variant={p.status === 'available' ? 'default' : 'secondary'} className="text-[10px] ml-2 flex-shrink-0">{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.location}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{formatPrice(p.price)}</span>
                <span>{p.area_sqft} sqft</span>
                <span>{p.bedrooms} BHK</span>
              </div>
              {p.builder && <p className="text-[11px] text-muted-foreground">by {p.builder}</p>}
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePriceDrop(p) }}
                  disabled={priceDropLoading === p._id}
                  title="Trigger AI Price Drop campaign"
                  className="flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {priceDropLoading === p._id
                    ? <AiOutlineLoading3Quarters className="w-3 h-3 animate-spin" />
                    : <HiOutlineCurrencyRupee className="w-3.5 h-3.5" />}
                  {priceDropResult?.id === p._id
                    ? priceDropResult.success ? '✓ Campaign Triggered!' : '✗ Failed'
                    : 'Price Drop Alert'}
                </button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(p._id)}><FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  )
}
