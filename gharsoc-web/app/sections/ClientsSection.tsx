'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiOutlineUserPlus, HiOutlineSparkles, HiOutlineArrowRight, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock, HiOutlinePhone, HiOutlineMapPin, HiOutlineCurrencyRupee, HiOutlineUserGroup } from 'react-icons/hi2'
import { FiRefreshCw } from 'react-icons/fi'

interface Client {
  _id: string
  name: string
  phone: string
  email: string
  budget_range: string
  location_pref: string
  property_type: string
  timeline: string
  notes: string
  status: 'new' | 'matched' | 'converted_to_lead'
  ai_match_status: 'pending' | 'processing' | 'matched' | 'no_match'
  matched_property_title: string | null
  match_score: number | null
  match_reason: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new:                { label: 'New',         cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  matched:            { label: 'Matched',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  converted_to_lead:  { label: 'Lead',        cls: 'bg-primary/10 text-primary border-primary/20' },
}

const AI_STATUS_BADGE: Record<string, { label: string; icon: React.ReactNode }> = {
  pending:    { label: 'Awaiting AI',  icon: <HiOutlineClock className="w-3.5 h-3.5" /> },
  processing: { label: 'AI Running',   icon: <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  matched:    { label: 'Match Found',  icon: <HiOutlineCheckCircle className="w-3.5 h-3.5" /> },
  no_match:   { label: 'No Match Yet', icon: <HiOutlineXCircle className="w-3.5 h-3.5" /> },
}

const EMPTY_FORM = { name: '', phone: '', email: '', budget_range: '', location_pref: '', property_type: '', timeline: '', notes: '' }

export default function ClientsSection() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      if (data.success) setClients(data.clients)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess('Client added! The AI Matchmaker has been triggered in the background and will find matching properties within the next cycle.')
        setForm(EMPTY_FORM)
        setShowForm(false)
        fetchClients()
      } else {
        setError(data.error || 'Failed to add client')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  const stats = {
    total: clients.length,
    matched: clients.filter(c => c.ai_match_status === 'matched').length,
    pending: clients.filter(c => c.ai_match_status === 'pending').length,
    converted: clients.filter(c => c.status === 'converted_to_lead').length,
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Client Prospects</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Add new prospects. The AI Matchmaker automatically finds the best property fit.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <HiOutlineUserPlus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* AI Pipeline Banner */}
      <div className="rounded-xl border border-primary/20 bg-card p-4 flex items-center gap-4 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <HiOutlineSparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI-Powered Matchmaking Active</p>
            <p className="text-xs text-muted-foreground">When you add a client, GPT-4o automatically scans all available properties and promotes the best matches to the Lead Pipeline.</p>
          </div>
        </div>
        <div className="relative flex items-center gap-6 shrink-0">
          {[
            { label: 'Total', val: stats.total, color: 'text-foreground' },
            { label: 'Matched', val: stats.matched, color: 'text-emerald-600' },
            { label: 'Pending', val: stats.pending, color: 'text-amber-600' },
            { label: 'Converted', val: stats.converted, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Flow Diagram */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              { icon: <HiOutlineUserPlus className="w-5 h-5" />, label: 'You add a Client', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { icon: <HiOutlineArrowRight className="w-4 h-4 text-muted-foreground" />, label: '', color: '' },
              { icon: <HiOutlineSparkles className="w-5 h-5" />, label: 'GPT-4o Matchmaker runs', color: 'bg-primary/10 border-primary/20 text-primary' },
              { icon: <HiOutlineArrowRight className="w-4 h-4 text-muted-foreground" />, label: '', color: '' },
              { icon: <HiOutlineCheckCircle className="w-5 h-5" />, label: 'Match ≥75% score', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { icon: <HiOutlineArrowRight className="w-4 h-4 text-muted-foreground" />, label: '', color: '' },
              { icon: <HiOutlineUserGroup className="w-5 h-5" />, label: 'Promoted to Lead Pipeline', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            ].map((step, i) =>
              step.label ? (
                <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${step.color}`}>
                  {step.icon}
                  {step.label}
                </div>
              ) : (
                <div key={i}>{step.icon}</div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Success / Error */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
          <HiOutlineCheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg flex items-start gap-2">
          <HiOutlineXCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Add Client Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HiOutlineUserPlus className="text-primary w-5 h-5" /> New Client Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Full Name *', placeholder: 'e.g. Rahul Sharma' },
                { key: 'phone', label: 'Phone Number *', placeholder: 'e.g. +919999999999' },
                { key: 'email', label: 'Email Address', placeholder: 'e.g. rahul@example.com' },
                { key: 'budget_range', label: 'Budget Range', placeholder: 'e.g. 1.5 Cr - 2 Cr' },
                { key: 'location_pref', label: 'Location Preference', placeholder: 'e.g. Whitefield, Koramangala' },
                { key: 'property_type', label: 'Property Type', placeholder: 'e.g. 2BHK Apartment, Villa' },
                { key: 'timeline', label: 'Purchase Timeline', placeholder: 'e.g. 3-6 months' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional requirements or notes..."
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <HiOutlineSparkles className="w-4 h-4" />}
                  {submitting ? 'Saving & triggering AI...' : 'Add Client & Run AI Matchmaker'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); setSuccess('') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Client List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading clients...</div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HiOutlineUserGroup className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base font-semibold text-foreground">No clients added yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first client and the AI will automatically find them the perfect property match.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors mx-auto"
            >
              <HiOutlineUserPlus className="w-4 h-4" /> Add First Client
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clients.map(client => {
            const badge = STATUS_BADGE[client.status] || STATUS_BADGE.new
            const aiBadge = AI_STATUS_BADGE[client.ai_match_status] || AI_STATUS_BADGE.pending
            return (
              <Card key={client._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <HiOutlinePhone className="w-3 h-3" /> {client.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    {client.budget_range && (
                      <span className="flex items-center gap-1"><HiOutlineCurrencyRupee className="w-3 h-3 shrink-0" /> {client.budget_range}</span>
                    )}
                    {client.location_pref && (
                      <span className="flex items-center gap-1"><HiOutlineMapPin className="w-3 h-3 shrink-0" /> {client.location_pref}</span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border
                    ${client.ai_match_status === 'matched' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      client.ai_match_status === 'processing' ? 'bg-primary/5 border-primary/20 text-primary' :
                      'bg-muted border-border text-muted-foreground'}`}
                  >
                    {aiBadge.icon}
                    <span>{aiBadge.label}</span>
                    {client.matched_property_title && (
                      <span className="ml-auto font-semibold truncate max-w-[140px]">→ {client.matched_property_title}</span>
                    )}
                    {client.match_score && (
                      <span className="ml-2 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">{client.match_score}%</span>
                    )}
                  </div>

                  {client.match_reason && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic line-clamp-2">&quot;{client.match_reason}&quot;</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
