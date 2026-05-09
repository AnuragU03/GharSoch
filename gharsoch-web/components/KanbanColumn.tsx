'use client'

import { useDroppable } from '@dnd-kit/core'

import type { LeadPipelineStage } from '@/lib/services/leadService'
import { cn } from '@/lib/utils'

export function KanbanColumn({
  id,
  title,
  count,
  isOver = false,
  children,
}: {
  id: LeadPipelineStage
  title: string
  count: number
  isOver?: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className={cn('col', isOver && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]')}>
      <div className="col-head">
        <span>{title}</span>
        <span className="count">{count}</span>
      </div>
      {children}
    </div>
  )
}
