'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, Grid2X2, Plus } from 'lucide-react'

import { NewPropertyModal } from '@/components/modals/NewPropertyModal'
import { PropertyCard } from '@/components/PropertyCard'
import type { PropertyStatusFilter, SerializedProperty } from '@/lib/services/propertyService'
import { useUserRole } from '@/lib/auth/useUserRole'

const FILTERS: Array<{ label: string; value: '' | PropertyStatusFilter }> = [
  { label: 'All', value: '' },
  { label: 'Available', value: 'available' },
  { label: 'In Negotiation', value: 'negotiation' },
  { label: 'Sold', value: 'sold' },
]

export function PropertiesSection({
  initialProperties,
}: {
  initialProperties: SerializedProperty[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStatus = (searchParams.get('status') || '') as '' | PropertyStatusFilter
  const [newOpen, setNewOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<SerializedProperty | null>(null)
  const { role } = useUserRole()
  const canAdd = role === 'admin' || role === 'tech'

  const counts = useMemo(() => {
    const active = initialProperties.filter((property) => property.status !== 'sold').length
    const negotiation = initialProperties.filter((property) => ['negotiation', 'in negotiation', 'in_negotiation'].includes(String(property.status || '').toLowerCase())).length
    return { active, negotiation }
  }, [initialProperties])

  const updateFilter = (value: '' | PropertyStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    const query = params.toString()
    router.push(query ? `/properties?${query}` : '/properties')
  }

  return (
    <section className="page active">
      <div className="crumb">Work · Properties</div>
      <div className="head">
        <div>
          <div className="title">Property inventory</div>
          <div className="sub">
            {counts.active} active listings · {counts.negotiation} in negotiation. Lowering price triggers the Price-Drop agent automatically.
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button">
            <Filter size={13} strokeWidth={1.8} /> Filter
          </button>
          <button className="btn" type="button">
            <Grid2X2 size={13} strokeWidth={1.8} /> Grid
          </button>
          {canAdd && (
            <button className="btn primary" type="button" onClick={() => setNewOpen(true)}>
              <Plus size={13} strokeWidth={1.8} /> Add Property
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => updateFilter(filter.value)}
            className={`btn sm ${currentStatus === filter.value ? 'primary' : 'ghost'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {initialProperties.length === 0 ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-ink-3">
            No properties found for this filter yet.
          </div>
        </div>
      ) : (
        <div className="pgrid">
          {initialProperties.map((property) => (
            <PropertyCard key={property._id} property={property} onClick={setEditingProperty} />
          ))}
        </div>
      )}

      <NewPropertyModal open={newOpen} onClose={() => setNewOpen(false)} />
      <NewPropertyModal open={Boolean(editingProperty)} onClose={() => setEditingProperty(null)} initialValues={editingProperty} />
    </section>
  )
}

export default PropertiesSection
