'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deletePropertyAction } from '@/app/actions/properties'
import { Pill } from '@/components/Pill'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUserRole } from '@/lib/auth/useUserRole'
import type { SerializedProperty } from '@/lib/services/propertyService'
import { cn } from '@/lib/utils'

const GRADIENT_CLASSES = ['', 'b', 'c', 'd']

function gradientVariant(id: string) {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return GRADIENT_CLASSES[hash % GRADIENT_CLASSES.length]
}

function formatPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) return '-'
  if (price >= 10_000_000) {
    return `Rs ${(price / 10_000_000).toFixed(price % 10_000_000 === 0 ? 0 : 2)} Cr`
  }
  return `Rs ${(price / 100_000).toFixed(price % 100_000 === 0 ? 0 : 1)} L`
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
    return <Pill variant="warm">price down {property.price_drop_pct}%</Pill>
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
  const router = useRouter()
  const { role } = useUserRole()
  const canManage = role === 'admin' || role === 'tech'
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const gradient = gradientVariant(property._id)
  const ribbon = String(property.status || 'available').replaceAll('_', ' ')

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deletePropertyAction(property._id)
      if (!result.ok) {
        toast.error(result.error || 'Failed to delete property')
        return
      }
      toast.success('Property deleted')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="pcard relative w-full text-left">
        {canManage ? (
          <div className="absolute right-3 top-3 z-10">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Open actions for ${property.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/55 bg-white/92 text-ink shadow-sm backdrop-blur transition hover:bg-white"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal size={16} strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onClick ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setMenuOpen(false)
                      onClick(property)
                    }}
                  >
                    <Pencil size={15} strokeWidth={1.8} />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onSelect={(event) => {
                    event.preventDefault()
                    setMenuOpen(false)
                    setConfirmOpen(true)
                  }}
                >
                  <Trash2 size={15} strokeWidth={1.8} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        <button type="button" className="w-full text-left" onClick={() => onClick?.(property)}>
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
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete property?"
        description={`This will remove ${property.title} from the active inventory views.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
