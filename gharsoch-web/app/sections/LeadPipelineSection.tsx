'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Download, Filter, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LeadDetailsSheet } from '@/components/LeadDetailsSheet'

import { exportLeadsCsvAction, moveLeadToStageAction } from '@/app/actions/leads'
import { LeadCard } from '@/components/LeadCard'
import { KanbanColumn } from '@/components/KanbanColumn'
import { NewClientModal } from '@/components/modals/NewClientModal'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { LeadPipelineStage, LeadPipelineStats, SerializedLead } from '@/lib/services/leadService'
import { useUserRole } from '@/lib/auth/useUserRole'

const STAGES: Array<{ id: LeadPipelineStage; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'site_visit', label: 'Site visit' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'closed', label: 'Closed' },
]

type Columns = Record<LeadPipelineStage, SerializedLead[]>

function buildMetaLine(lead: SerializedLead) {
  return [lead.phone, lead.email, lead.place].filter(Boolean).join(' · ')
}

export function LeadPipelineSection({
  initialColumns,
  stats,
}: {
  initialColumns: Columns
  stats: LeadPipelineStats
}) {
  const [columns, setColumns] = useState<Columns>(initialColumns)
  const [activeLead, setActiveLead] = useState<SerializedLead | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const { role } = useUserRole()
  const canAdd = role === 'admin' || role === 'tech'
  const [isPending, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const stageByLeadId = useMemo(() => {
    const map = new Map<string, LeadPipelineStage>()
    for (const stage of STAGES) {
      for (const lead of columns[stage.id]) {
        map.set(lead._id, stage.id)
      }
    }
    return map
  }, [columns])

  const handleExport = async () => {
    const result = await exportLeadsCsvAction()
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const moveLeadLocally = (leadId: string, nextStage: LeadPipelineStage) => {
    setColumns((current) => {
      let movedLead: SerializedLead | null = null
      const next: Columns = {
        new: [],
        contacted: [],
        site_visit: [],
        negotiation: [],
        closed: [],
      }

      for (const stage of STAGES) {
        for (const lead of current[stage.id]) {
          if (lead._id === leadId) {
            movedLead = { ...lead, status: nextStage }
          } else {
            next[stage.id].push(lead)
          }
        }
      }

      if (movedLead) {
        next[nextStage].unshift(movedLead)
      }

      return next
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const leadId = String(event.active.id)
    const stage = stageByLeadId.get(leadId)
    if (!stage) return
    const lead = columns[stage].find((item) => item._id === leadId) || null
    setActiveLead(lead)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null)
    const leadId = String(event.active.id)
    const sourceStage = stageByLeadId.get(leadId)
    const destinationStage = event.over?.id as LeadPipelineStage | undefined

    if (!sourceStage || !destinationStage || sourceStage === destinationStage) {
      return
    }

    moveLeadLocally(leadId, destinationStage)

    startTransition(() => {
      void moveLeadToStageAction(leadId, destinationStage)
        .then(() => toast.success(`Lead moved to ${destinationStage.replace('_', ' ')}`))
        .catch((error) => {
          console.error('[LEADS] Failed to move lead:', error)
          setColumns(initialColumns)
          toast.error('Could not move lead')
        })
    })
  }

  return (
    <section className="page active">
      <div className="crumb">Work · Leads Pipeline</div>
      <div className="head">
        <div>
          <div className="title">Leads pipeline</div>
          <div className="sub">Drag a lead between stages, or click to open detail.</div>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button">
            <Filter size={13} strokeWidth={1.8} /> Filter
          </button>
          <button className="btn" type="button" onClick={() => void handleExport()}>
            <Download size={13} strokeWidth={1.8} /> Export CSV
          </button>
          {canAdd && (
            <button className="btn primary" type="button" onClick={() => setNewLeadOpen(true)}>
              <Plus size={13} strokeWidth={1.8} /> New Lead
            </button>
          )}
        </div>
      </div>

      <div className="strip">
        <div className="stat"><span className="stat-label">Total</span><span className="stat-value">{stats.total}</span></div>
        <div className="stat"><span className="stat-label">Hot</span><span className="stat-value">{stats.hot}</span></div>
        <div className="stat"><span className="stat-label">Warm</span><span className="stat-value">{stats.warm}</span></div>
        <div className="stat"><span className="stat-label">Cold</span><span className="stat-value">{stats.cold}</span></div>
        <div className="stat"><span className="stat-label">DNC</span><span className="stat-value">{stats.dnc}</span></div>
        <div className="stat"><span className="stat-label">Conversion %</span><span className="stat-value">{stats.conversionPct}%</span></div>
      </div>

      {stats.total === 0 ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-ink-3">
            No leads yet. Create a client to let the Converter turn it into a lead automatically.
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={cn('kanban', isPending && 'opacity-90')}>
            {STAGES.map((stage) => (
              <KanbanColumn key={stage.id} id={stage.id} title={stage.label} count={columns[stage.id].length}>
                {columns[stage.id].map((lead) => (
                  <LeadCard key={lead._id} lead={lead} onOpen={(l) => setOpenLeadId(l._id)} />
                ))}
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeLead ? <LeadCard lead={activeLead} dragging draggable={false} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <NewClientModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />

      <LeadDetailsSheet
        lead={Object.values(columns).flat().find((l) => l._id === openLeadId) || null}
        open={!!openLeadId}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
      />
    </section>
  )
}

export default LeadPipelineSection
