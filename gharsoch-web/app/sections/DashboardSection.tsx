'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import { NewClientModal } from '@/components/modals/NewClientModal'
import { Pill, type PillVariant } from '@/components/Pill'
import { RunDetailDrawer } from '@/components/RunDetailDrawer'
import { StatStrip } from '@/components/StatStrip'
import { toast } from '@/lib/toast'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'
import type { DashboardData, DashboardLead } from '@/lib/services/dashboardService'

function delta(current: number, previous: number) {
  const diff = current - previous
  if (diff === 0) return 'No change vs yesterday'
  return `${diff > 0 ? '+' : ''}${diff} vs yesterday`
}

function statusVariant(status?: string | null): PillVariant {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'success' || normalized === 'completed' || normalized === 'confirmed') return 'success'
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'failed'
  if (normalized === 'running' || normalized === 'started' || normalized === 'dialing') return 'running'
  if (normalized === 'hot') return 'warm'
  if (normalized === 'warm') return 'amber'
  return 'idle'
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function runSummary(run: AgentDashboardRun) {
  return (
    run.reasoning_summary?.summary ||
    run.output_data?.summary ||
    run.reasoning_steps?.[run.reasoning_steps.length - 1]?.content ||
    'Run completed without a summary yet.'
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '30px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
      {children}
    </div>
  )
}

function UrgentLeadRow({ lead, onClick }: { lead: DashboardLead; onClick: () => void }) {
  const interest = lead.interest_level || lead.status || 'idle'

  return (
    <button type="button" className="dash-row" onClick={onClick}>
      <div>
        <div className="name">{lead.name || 'Unknown lead'}</div>
        <div className="meta">{lead.phone || 'No phone'} · {lead.location_pref || lead.place || 'No location'}</div>
      </div>
      <Pill variant={statusVariant(interest)}>{interest}</Pill>
      <div className="meta" style={{ textAlign: 'right' }}>
        {lead.last_contacted_at
          ? formatDistanceToNow(new Date(lead.last_contacted_at), { addSuffix: true })
          : lead.next_follow_up_date
            ? `Due ${formatDistanceToNow(new Date(lead.next_follow_up_date), { addSuffix: true })}`
            : 'No contact yet'}
      </div>
    </button>
  )
}

export function DashboardSection({ data }: { data: DashboardData }) {
  const router = useRouter()
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRun, setSelectedRun] = useState<AgentDashboardRun | null>(null)

  const statCells = [
    { label: 'Calls', value: String(data.today.calls_made), delta: delta(data.today.calls_made, data.yesterday.calls_made) },
    { label: 'Appointments', value: String(data.today.appointments_today), delta: delta(data.today.appointments_today, data.yesterday.appointments_today) },
    { label: 'New leads', value: String(data.today.new_leads), delta: delta(data.today.new_leads, data.yesterday.new_leads) },
    { label: 'Agent runs', value: String(data.today.agent_runs), delta: delta(data.today.agent_runs, data.yesterday.agent_runs) },
  ]

  return (
    <>
      <section className="page active">
        <div className="crumb">Work · Dashboard</div>
        <div className="head">
          <div>
            <h1 className="title">Operations Dashboard</h1>
            <p className="sub">Your AI workforce, at a glance.</p>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setNewLeadOpen(true)}>
              + New Lead
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => toast('Force run all agents coming in Phase 12')}
            >
              Force run all agents
            </button>
          </div>
        </div>

        <StatStrip cells={statCells} />

        <div className="dashboard-grid">
          <div className="dashboard-main">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Recent agent activity</div>
                  <div className="panel-sub">Last 6 runs across the agent fleet.</div>
                </div>
              </div>
              {data.recent_runs.length > 0 ? (
                data.recent_runs.map((run) => (
                  <button
                    key={run.run_id}
                    type="button"
                    className="row"
                    onClick={() => {
                      setSelectedRun(run)
                      setDrawerOpen(true)
                    }}
                  >
                    <div className="ts">{formatTime(run.started_at)}</div>
                    <div><span className="agent-tag">{run.agent_name || run.agent_id}</span></div>
                    <div className="summary">{runSummary(run)}</div>
                    <div><Pill variant={statusVariant(run.status)}>{run.status}</Pill></div>
                    <div className="arrow">›</div>
                  </button>
                ))
              ) : (
                <EmptyState>Nothing here yet. Once agents run, recent activity will populate.</EmptyState>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Urgent leads</div>
                  <div className="panel-sub">Hot or overdue leads that need operator attention.</div>
                </div>
              </div>
              {data.urgent_leads.length > 0 ? (
                data.urgent_leads.map((lead) => (
                  <UrgentLeadRow
                    key={lead._id}
                    lead={lead}
                    onClick={() => router.push(`/leads?focus=${lead._id}`)}
                  />
                ))
              ) : (
                <EmptyState>Nothing here yet. Hot or overdue leads will appear here.</EmptyState>
              )}
            </div>
          </div>

          <div className="dashboard-side">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Today&apos;s appointments</div>
                  <div className="panel-sub">Next site visits in the coming 24 hours.</div>
                </div>
              </div>
              {data.upcoming_appointments.length > 0 ? (
                data.upcoming_appointments.map((appointment) => (
                  <div className="apt-row" key={appointment._id}>
                    <div className="apt-time">
                      <div className="apt-time-h">{formatTime(appointment.scheduled_at).split(':')[0]}</div>
                      <div className="apt-time-d">{formatTime(appointment.scheduled_at).slice(-2)}</div>
                    </div>
                    <div>
                      <div className="name">{appointment.lead_name || 'Lead'}</div>
                      <div className="meta">{appointment.property_title || 'Property'} · {appointment.property_location || 'Location pending'}</div>
                    </div>
                    <Pill variant={statusVariant(appointment.status)}>{appointment.status}</Pill>
                  </div>
                ))
              ) : (
                <EmptyState>Nothing here yet. Upcoming visits will populate once booked.</EmptyState>
              )}
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Active campaigns</div>
                  <div className="panel-sub">Dialing campaigns currently in motion.</div>
                </div>
              </div>
              {data.active_campaigns.length > 0 ? (
                data.active_campaigns.map((campaign) => {
                  const total = campaign.target_lead_ids?.length || campaign.total_count || 0
                  const dialed = campaign.calls_made || campaign.dialed_count || 0
                  const progress = total > 0 ? Math.min(100, Math.round((dialed / total) * 100)) : 0

                  return (
                    <div className="campaign-mini" key={campaign._id}>
                      <div className="name">{campaign.name}</div>
                      <div className="meta">{dialed} / {total} dialed · {campaign.calls_connected || 0} connected</div>
                      <div className="mini-progress"><span style={{ width: `${progress}%` }} /></div>
                    </div>
                  )
                })
              ) : (
                <EmptyState>Nothing here yet. Dialing campaigns will appear here.</EmptyState>
              )}
            </div>
          </div>
        </div>
      </section>

      <NewClientModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <RunDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} run={selectedRun} />
    </>
  )
}

export default DashboardSection
