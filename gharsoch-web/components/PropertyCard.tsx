import { Pill } from '@/components/Pill'
import type { SerializedProperty } from '@/lib/services/propertyService'
import { cn } from '@/lib/utils'

const GRADIENT_CLASSES = ['', 'b', 'c', 'd']

function gradientVariant(id: string) {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return GRADIENT_CLASSES[hash % GRADIENT_CLASSES.length]
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return '—'
  if (price >= 10_000_000) {
    return `₹${(price / 10_000_000).toFixed(price % 10_000_000 === 0 ? 0 : 2)} Cr`
  }
  return `₹${(price / 100_000).toFixed(price % 100_000 === 0 ? 0 : 1)} L`
}

function footerBadge(property: SerializedProperty) {
  const status = String(property.status || '').toLowerCase()
  if (status === 'sold') {
    return <Pill variant="success">closed</Pill>
  }
  if (status === 'negotiation' || status === 'in negotiation' || status === 'in_negotiation') {
    return <Pill variant="amber">in negotiation</Pill>
  }
  if (typeof property.price_drop_pct === 'number' && property.price_drop_pct > 0) {
    return <Pill variant="warm">price ↓ {property.price_drop_pct}%</Pill>
  }
  return <Pill variant="idle">stable</Pill>
}

export function PropertyCard({
  property,
  onClick,
}: {
  property: SerializedProperty
  onClick?: (property: SerializedProperty) => void
}) {
  const gradient = gradientVariant(property._id)
  const ribbon = String(property.status || 'available').replaceAll('_', ' ')

  return (
    <button type="button" className="pcard w-full text-left" onClick={() => onClick?.(property)}>
      <div className={cn('pcard-img', gradient)}>
        <span className="ribbon">{ribbon}</span>
      </div>
      <div className="pcard-body">
        <div className="pcard-title">{property.title}</div>
        <div className="pcard-meta">
          {[property.location, property.type, `${property.area_sqft} sqft`, property.builder].filter(Boolean).join(' · ')}
        </div>
        <div className="pcard-foot">
          <span className="price">{formatPrice(Number(property.price || 0))}</span>
          {footerBadge(property)}
        </div>
      </div>
    </button>
  )
}
