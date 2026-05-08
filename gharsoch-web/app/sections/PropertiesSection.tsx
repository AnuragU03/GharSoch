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
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineHome, HiOutlineArrowDownTray, HiOutlineCurrencyRupee, HiChevronDown } from 'react-icons/hi2'
import { FiTrash2 } from 'react-icons/fi'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { downloadExcel } from '@/lib/download'

interface Property { _id: string; title: string; type: string; location: string; price: number; area_sqft: number; bedrooms: number; status: string; builder: string; images: string[]; description: string; created_at: string }

export default function PropertiesSection() {
  const [items, setItems] = useState<Property[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'details'>('grid')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBedrooms, setFilterBedrooms] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterBuilder, setFilterBuilder] = useState('all')
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([])
  const [uniqueBuilders, setUniqueBuilders] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ title: '', type: '', location: '', price: '', area_sqft: '', bedrooms: '', builder: '', description: '', status: 'available' })
  const [priceDropLoading, setPriceDropLoading] = useState<string | null>(null)
  const [priceDropResult, setPriceDropResult] = useState<{ id: string; success: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (filterType !== 'all') p.set('type', filterType)
    if (filterStatus !== 'all') p.set('status', filterStatus)
    if (filterBedrooms !== 'all') p.set('bedrooms', filterBedrooms)
    if (filterLocation !== 'all') p.set('city', filterLocation)
    if (filterBuilder !== 'all') p.set('builder', filterBuilder)
    try { const r = await fetch(`/api/properties?${p}`); const d = await r.json(); if (d.success) { setItems(d.properties); setTotal(d.total) } } catch {}
    setLoading(false)
    setSelectedIds(new Set())
  }, [search, filterType, filterStatus, filterBedrooms, filterLocation, filterBuilder])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    // Fetch unique locations and builders once
    fetch('/api/properties?limit=1000')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const locs = Array.from(new Set(d.properties.map((p: any) => p.city || p.location.split(',').pop()?.trim()))).filter(Boolean) as string[]
          const builders = Array.from(new Set(d.properties.map((p: any) => p.builder))).filter(Boolean) as string[]
          setUniqueLocations(locs.sort())
          setUniqueBuilders(builders.sort())
        }
      })
      .catch(() => {})
  }, [])

  const handleAdd = async () => {
    const r = await fetch('/api/properties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, price: Number(form.price), area_sqft: Number(form.area_sqft), bedrooms: Number(form.bedrooms) }) })
    if ((await r.json()).success) { setShowAdd(false); setForm({ title: '', type: '', location: '', price: '', area_sqft: '', bedrooms: '', builder: '', description: '', status: 'available' }); fetchData() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return
    await fetch(`/api/properties?id=${id}`, { method: 'DELETE' }); fetchData()
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} selected propert${selectedIds.size === 1 ? 'y' : 'ies'}?`)) return
    await fetch('/api/properties', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    })
    fetchData()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${total} properties? This cannot be undone.`)) return
    await fetch('/api/properties?all=true', { method: 'DELETE' })
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
      setSelectedIds(new Set(items.map(p => p._id)))
    }
  }

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

  const formatPrice = (p: number) => p >= 10000000 ? `Rs ${(p / 10000000).toFixed(1)} Cr` : `Rs ${(p / 100000).toFixed(0)} L`
  const allSelected = items.length > 0 && selectedIds.size === items.length

  const handleDownloadExcel = () => {
    const rows = items.map(p => ({
      'Title': p.title,
      'Type': p.type,
      'Location': p.location,
      'Price': formatPrice(p.price),
      'Price (Rs)': p.price,
      'Area (sqft)': p.area_sqft,
      'Bedrooms': p.bedrooms,
      'Status': p.status,
      'Builder': p.builder || '',
      'Description': p.description || '',
      'Listed On': new Date(p.created_at).toLocaleDateString('en-IN'),
    }))
    downloadExcel(rows, `properties-${new Date().toISOString().slice(0, 10)}`, 'Properties')
  }

  const FilterHeader = ({ title, value, onChange, options }: { title: string, value: string, onChange: (v: string) => void, options: string[] }) => (
    <div className="flex items-center gap-1">
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
        <div><h2 className="text-xl font-bold">Properties</h2><p className="text-sm text-muted-foreground">{total} listings</p></div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteSelected}>
              <FiTrash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={handleDeleteAll}>
            <FiTrash2 className="w-3.5 h-3.5" /> Delete All
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadExcel} disabled={items.length === 0}>
            <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> Export Excel
          </Button>
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
                <div><Label className="text-xs">Price (Rs)</Label><Input type="number" placeholder="6000000" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
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
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 w-full max-w-md flex-1">
            <div className="relative flex-1">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search properties..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {items.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                Select all
              </label>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v: 'grid' | 'details') => setViewMode(v)}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="View format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid" className="text-xs">Grid View</SelectItem>
                <SelectItem value="details" className="text-xs">Details View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
      : items.length === 0 ? <div className="text-center py-12 text-muted-foreground"><HiOutlineHome className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No properties. Add your first listing.</p></div>
      : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(p => (
            <div key={p._id} className={`border rounded-xl bg-card overflow-hidden hover:shadow-md transition-shadow ${selectedIds.has(p._id) ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
              <div
                className="h-32 flex items-center justify-center relative cursor-pointer"
                style={{ background: 'linear-gradient(135deg, hsl(25,70%,45%) 0%, hsl(25,50%,35%) 100%)' }}
                onClick={() => toggleSelect(p._id)}
              >
                <HiOutlineHome className="w-10 h-10 text-white/40" />
                <div className="absolute top-2 left-2">
                  <Checkbox
                    checked={selectedIds.has(p._id)}
                    onCheckedChange={() => toggleSelect(p._id)}
                    aria-label={`Select ${p.title}`}
                    className="bg-white/90 border-white"
                  />
                </div>
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
                      ? priceDropResult.success ? 'Campaign Triggered' : 'Failed'
                      : 'Price Drop Alert'}
                  </button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(p._id)}><FiTrash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium"><FilterHeader title="Location" value={filterLocation} onChange={setFilterLocation} options={uniqueLocations} /></th>
                  <th className="px-4 py-3 font-medium"><FilterHeader title="Type" value={filterType} onChange={setFilterType} options={['1BHK','2BHK','3BHK','4BHK','Villa','Plot','Commercial']} /></th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Area (sqft)</th>
                  <th className="px-4 py-3 font-medium"><FilterHeader title="Builder" value={filterBuilder} onChange={setFilterBuilder} options={uniqueBuilders} /></th>
                  <th className="px-4 py-3 font-medium"><FilterHeader title="Status" value={filterStatus} onChange={setFilterStatus} options={['available', 'sold']} /></th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(p => (
                  <tr key={p._id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(p._id) ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedIds.has(p._id)} onCheckedChange={() => toggleSelect(p._id)} aria-label={`Select ${p.title}`} />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.location}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.type}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.area_sqft}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.builder || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'available' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handlePriceDrop(p)}
                        disabled={priceDropLoading === p._id}
                        title="Trigger AI Price Drop campaign"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors disabled:opacity-50 mr-1"
                      >
                        {priceDropLoading === p._id
                          ? <AiOutlineLoading3Quarters className="w-3 h-3 animate-spin" />
                          : <HiOutlineCurrencyRupee className="w-3.5 h-3.5" />}
                        {priceDropResult?.id === p._id
                          ? priceDropResult.success ? 'Campaign Triggered' : 'Failed'
                          : 'Price Drop'}
                      </button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(p._id)}>
                        <FiTrash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
