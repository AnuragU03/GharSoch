'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import type { SerializedLead } from '@/lib/services/leadService'
import { cn } from '@/lib/utils'

function interestTag(interestLevel?: string) {
  const interest = String(interestLevel || '').toLowerCase()
  if (interest === 'hot') return 'tag hot'
  if (interest === 'warm') return 'tag warm-t'
  if (interest === 'cold') return 'tag cold'
  return 'tag'
}

function buildMeta(lead: SerializedLead) {
  return [lead.location_pref || lead.place, lead.property_type, lead.budget_range].filter(Boolean).join(' · ')
}

function buildSecondaryTag(lead: SerializedLead) {
  if (lead.next_follow_up_date) {
    return new Date(lead.next_follow_up_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }

  if (lead.total_calls > 0) {
    return `${lead.total_calls} call${lead.total_calls === 1 ? '' : 's'}`
  }

  return null
}

export function LeadCard({
  lead,
  dragging = false,
  onOpen,
  draggable = true,
}: {
  lead: SerializedLead
  dragging?: boolean
  onOpen?: (lead: SerializedLead) => void
  draggable?: boolean
}) {
  const draggableState = useDraggable({
    id: lead._id,
    data: {
      leadId: lead._id,
      currentStage: lead.status,
      lead,
    },
    disabled: !draggable,
  })

  const { attributes, listeners, setNodeRef, transform, isDragging } = draggableState

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const secondaryTag = buildSecondaryTag(lead)

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn('lcard w-full text-left', (isDragging || dragging) && 'opacity-70 shadow-elev-1')}
      style={style}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onOpen?.(lead)
      }}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
    >
      <div className="lcard-name">{lead.name || 'Unnamed lead'}</div>
      <div className="lcard-meta">{buildMeta(lead) || lead.phone || 'No preferences captured yet'}</div>
      <div className="lcard-tags">
        <span className={interestTag(lead.interest_level)}>{lead.interest_level || 'unknown'}</span>
        {lead.dnd_status ? <span className="tag">DNC</span> : null}
        {secondaryTag ? <span className="tag">{secondaryTag}</span> : null}
      </div>
    </button>
  )
}
