'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClientAction, updateClientAction } from '@/app/actions/clients'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Client } from '@/models/Client'
import { toast } from 'sonner'

interface ClientFormState {
  id: string
  name: string
  phone: string
  email: string
  source: string
  property_type: string
  budget_range: string
  location_pref: string
  notes: string
}

interface Props {
  open: boolean
  onClose: () => void
  initialData?: Partial<Client> | null
  entityId?: string
}

function buildInitialState(initialData?: Partial<Client> | null, entityId?: string): ClientFormState {
  return {
    id: entityId || initialData?._id?.toString?.() || '',
    name: String(initialData?.name || ''),
    phone: String(initialData?.phone || ''),
    email: String(initialData?.email || ''),
    source: String(initialData?.source || 'manual'),
    property_type: String(initialData?.property_type || '1BHK'),
    budget_range: String(initialData?.budget_range || ''),
    location_pref: String(initialData?.location_pref || ''),
    notes: String(initialData?.notes || ''),
  }
}

export function NewClientModal({ open, onClose, initialData, entityId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<ClientFormState>(buildInitialState(initialData, entityId))
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initialData, entityId))
      setErrorMsg('')
    }
  }, [entityId, initialData, open])

  const isEditMode = Boolean(entityId || initialData?._id)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const formData = new FormData(e.currentTarget)
    const result = isEditMode ? await updateClientAction(formData) : await createClientAction(formData)

    setLoading(false)

    const succeeded = isEditMode ? result.ok : result.success
    if (succeeded) {
      toast.success(isEditMode ? 'Client updated' : 'Client created · Converter agent dispatched')
      router.refresh()
      onClose()
      return
    }

    setErrorMsg(result.error || 'Something went wrong')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-xl bg-surface sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit client' : 'New client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <input type="hidden" name="id" value={form.id} />

          {errorMsg ? (
            <div className="text-sm font-medium text-red">{errorMsg}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Name <span className="text-red">*</span></label>
              <input
                id="name"
                name="name"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone <span className="text-red">*</span></label>
              <input
                id="phone"
                name="phone"
                required
                pattern="^\+91\s?\d{10}$"
                placeholder="+91"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
                title="Must be +91 followed by 10 digits"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>
            {isEditMode ? null : (
              <div className="space-y-2">
                <label htmlFor="source" className="text-sm font-medium">Source</label>
                <select
                  id="source"
                  name="source"
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="web_form">Web Form</option>
                  <option value="csv_upload">CSV Upload</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="property_type" className="text-sm font-medium">Property Type</label>
              <select
                id="property_type"
                name="property_type"
                value={form.property_type}
                onChange={(event) => setForm((current) => ({ ...current, property_type: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              >
                <option value="1BHK">1 BHK</option>
                <option value="2BHK">2 BHK</option>
                <option value="3BHK">3 BHK</option>
                <option value="4BHK">4 BHK</option>
                <option value="Villa">Villa</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="budget_range" className="text-sm font-medium">Budget</label>
              <input
                id="budget_range"
                name="budget_range"
                placeholder="e.g. 1.2-1.5 Cr"
                value={form.budget_range}
                onChange={(event) => setForm((current) => ({ ...current, budget_range: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="location_pref" className="text-sm font-medium">Location Preference</label>
            <input
              id="location_pref"
              name="location_pref"
              value={form.location_pref}
              onChange={(event) => setForm((current) => ({ ...current, location_pref: event.target.value }))}
              className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="flex min-h-[80px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow hover:bg-accent/90 transition-colors"
              disabled={loading}
            >
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update client' : 'Create client')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
