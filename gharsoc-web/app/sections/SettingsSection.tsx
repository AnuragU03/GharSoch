'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HiOutlineNoSymbol } from 'react-icons/hi2'
import { FiTrash2 } from 'react-icons/fi'

export default function SettingsSection() {
  const [dncList, setDncList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')

  const fetchDnc = async () => {
    setLoading(true)
    try { const r = await fetch('/api/dnc'); const d = await r.json(); if (d.success) setDncList(d.dnc) } catch {}
    setLoading(false)
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

  return (
    <div className="max-w-4xl space-y-8">
      <div><h2 className="text-xl font-bold">Settings</h2><p className="text-sm text-muted-foreground">Platform configuration and compliance</p></div>

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
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30"><th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Number</th><th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Name</th><th className="text-left px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Added On</th><th className="text-right px-4 py-2 font-medium text-xs uppercase text-muted-foreground">Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-4 py-4 text-center">Loading...</td></tr> : dncList.length === 0 ? <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">No numbers in DNC registry.</td></tr> : dncList.map(d => (
                  <tr key={d.phone} className="border-b border-border/50">
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
