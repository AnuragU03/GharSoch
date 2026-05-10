'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

import { savePropertyAction } from '@/app/actions/properties'
import type { SerializedProperty } from '@/lib/services/propertyService'
import { toast } from '@/lib/toast'
import { getAgentVisual } from '@/lib/ui/agentVisuals'

const TYPE_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK', 'Villa']
const STATUS_OPTIONS = [
  { label: 'Available', value: 'available' },
  { label: 'In negotiation', value: 'negotiation' },
  { label: 'Sold', value: 'sold' },
]

type PropertyFormState = {
  id: string
  title: string
  builder: string
  type: string
  city: string
  location: string
  price: string
  area_sqft: string
  bedrooms: string
  status: string
  description: string
  amenities: string
}

function buildInitialState(property?: SerializedProperty | null): PropertyFormState {
  return {
    id: property?._id || '',
    title: property?.title || '',
    builder: property?.builder || '',
    type: property?.type || '3BHK',
    city: property?.city || '',
    location: property?.location || '',
    price: property?.price ? String(property.price) : '',
    area_sqft: property?.area_sqft ? String(property.area_sqft) : '',
    bedrooms: property?.bedrooms ? String(property.bedrooms) : '',
    status: property?.status || 'available',
    description: property?.description || '',
    amenities: Array.isArray(property?.amenities) ? property.amenities.join(', ') : '',
  }
}

export function NewPropertyModal({
  open,
  onClose,
  initialValues,
}: {
  open: boolean
  onClose: () => void
  initialValues?: SerializedProperty | null
}) {
  const [form, setForm] = useState<PropertyFormState>(buildInitialState(initialValues))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const MatchmakerIcon = getAgentVisual('matchmaker').icon

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initialValues))
      setError('')
    }
  }, [initialValues, open])

  const isEdit = Boolean(initialValues?._id)

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-[560px]">
        <div className="modal-card">
          <div className="modal-head">
            <h3>{isEdit ? 'Edit property' : 'Add property'}</h3>
            <button type="button" className="drawer-close" onClick={onClose}>
              ×
            </button>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setSubmitting(true)
              setError('')
              const formData = new FormData(event.currentTarget)
              const result = await savePropertyAction(formData)
              setSubmitting(false)

              if (!result.success) {
                setError(result.error || 'Failed to save property.')
                return
              }

              toast.success(isEdit ? 'Property updated' : 'Property added · Matchmaker dispatched')
              onClose()
            }}
          >
            <div className="modal-body">
              <input type="hidden" name="id" value={form.id} />
              {error ? <div className="mb-3 text-sm font-medium text-red">{error}</div> : null}

              <div className="field">
                <label>Title</label>
                <input name="title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Prestige Lakeside Habitat" required />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Builder</label>
                  <input name="builder" value={form.builder} onChange={(event) => setForm((current) => ({ ...current, builder: event.target.value }))} placeholder="Prestige Group" required />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select name="type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>City</label>
                  <input name="city" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Bangalore" required />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input name="location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Whitefield" required />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Price (₹)</label>
                  <input name="price" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="14000000" type="number" min="0" required />
                </div>
                <div className="field">
                  <label>Area (sqft)</label>
                  <input name="area_sqft" value={form.area_sqft} onChange={(event) => setForm((current) => ({ ...current, area_sqft: event.target.value }))} placeholder="1840" type="number" min="0" />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Bedrooms</label>
                  <input name="bedrooms" value={form.bedrooms} onChange={(event) => setForm((current) => ({ ...current, bedrooms: event.target.value }))} placeholder="3" type="number" min="0" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Amenities</label>
                <input name="amenities" value={form.amenities} onChange={(event) => setForm((current) => ({ ...current, amenities: event.target.value }))} placeholder="Clubhouse, pool, gym" />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea name="description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Key amenities, possession date, USPs..." />
              </div>

              <div className="rounded-lg bg-warm-soft px-3 py-2 text-sm text-warm">
                <span className="inline-flex items-center gap-1.5">
                  <MatchmakerIcon size={14} strokeWidth={1.75} />
                  Matchmaker will scan unmatched leads on save. Lowering the price later dispatches the Price-Drop agent automatically.
                </span>
              </div>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add property'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
