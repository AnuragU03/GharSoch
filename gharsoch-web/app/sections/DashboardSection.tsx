'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import { LivePulse } from '@/components/LivePulse'
import { NewClientModal } from '@/components/modals/NewClientModal'
import { Pill, type PillVariant } from '@/components/Pill'
import { RunDetailDrawer } from '@/components/RunDetailDrawer'
import { useUserRole } from '@/lib/auth/useUserRole'
import { toast } from '@/lib/toast'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'
import type {
  DashboardAppointment,
  DashboardCampaign,
  DashboardData,
  DashboardLead,
} from '@/lib/services/dashboardService'

type MetricTone = 'blue' | 'green' | 'amber' | 'violet'

const agentTone: Record<string, { label: string; tone: string; icon: string }> = {
  matchmaker: { label: 'Matchmaker', tone: '#2f80ed', icon: 'M' },
  follow_up: { label: 'Follow-Up', tone: '#2f9e66', icon: 'F' },
  followup: { label: 'Follow-Up', tone: '#2f9e66', icon: 'F' },
  appointment_guardian: { label: 'Appointment Guardian', tone: '#c98916', icon: 'A' },
  voice_orchestrator: { label: 'Voice Orchestrator', tone: '#7c5cff', icon: 'V' },
  dead_lead_reengager: { label: 'Re-engager', tone: '#d66b2a', icon: 'R' },
  dead_lead_re_engager: { label: 'Re-engager', tone: '#d66b2a', icon: 'R' },
  price_drop_negotiator: { label: 'Price Drop', tone: '#d94b4b', icon: 'P' },
  campaign_conductor: { label: 'Conductor', tone: '#149c8a', icon: 'C' },
  client_lead_converter: { label: 'Converter', tone: '#2f80ed', icon: 'C' },
}

function deltaValue(current: number, previous: number) {
  return current - previous
}

function deltaLabel(current: number, previous: number) {
  const diff = deltaValue(current, previous)
  if (diff === 0) return '—'
  return `${diff > 0 ? '+' : ''}${diff} vs yesterday`
}

function statusVariant(status?: string | null): PillVariant {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'success' || normalized === 'completed' || normalized === 'confirmed') return 'success'
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'failed'
  if (normalized === 'running' || normalized === 'started' || normalized === 'dialing') return 'running'
  if (normalized === 'hot') return 'warm'
  if (normalized === 'warm') return 'amber'
  if (normalized === 'cold') return 'idle'
  return 'idle'
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function relativeTime(value?: string | null) {
  if (!value) return 'Not contacted'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function initials(name?: string | null) {
  const parts = String(name || 'Lead').trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || 'L') + (parts[1]?.[0] || '')
}

function sparkPoints(current: number, previous: number) {
  const base = Math.max(1, previous || current || 1)
  const values = [base * 0.72, base * 0.86, previous || base, (base + current) / 2, current * 0.92, current * 1.04, current || 0]
  const max = Math.max(...values, 1)
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 60
      const y = 15 - (value / max) * 13
      return `${x.toFixed(1)},${Math.max(1, y).toFixed(1)}`
    })
    .join(' ')
}

function MetricSparkline({ current, previous, tone }: { current: number; previous: number; tone: MetricTone }) {
  return (
    <svg className={`dash-spark dash-spark-${tone}`} width="60" height="16" viewBox="0 0 60 16" aria-hidden="true">
      <polyline points={sparkPoints(current, previous)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DashboardHero({ data }: { data: DashboardData }) {
  const metrics = [
    { label: 'Calls', value: data.today.calls_made, previous: data.yesterday.calls_made, tone: 'blue' as const },
    { label: 'Appointments', value: data.today.appointments_today, previous: data.yesterday.appointments_today, tone: 'green' as const },
    { label: 'New leads', value: data.today.new_leads, previous: data.yesterday.new_leads, tone: 'amber' as const },
    { label: 'Agent runs', value: data.today.agent_runs, previous: data.yesterday.agent_runs, tone: 'violet' as const },
  ]

  return (
    <div className="dash-hero-grid">
      {metrics.map((metric) => {
        const diff = deltaValue(metric.value, metric.previous)
        return (
          <div className="dash-metric-card panel" key={metric.label}>
            <div className="dash-metric-top">
              <div className="dash-metric-value">{metric.value}</div>
              <MetricSparkline current={metric.value} previous={metric.previous} tone={metric.tone} />
            </div>
            <div className="dash-metric-label">{metric.label}</div>
            <div className={`dash-trend ${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}`}>
              {deltaLabel(metric.value, metric.previous)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function runSummary(run: AgentDashboardRun) {
  return (
    run.reasoning_summary?.summary ||
    run.output_data?.summary ||
    run.reasoning_steps?.[run.reasoning_steps.length - 1]?.content ||
    'completed a run'
  )
}

function runVerb(run: AgentDashboardRun) {
  const summary = String(runSummary(run)).trim()
  const firstSentence = summary.split(/[.!?]/)[0]?.trim()
  if (!firstSentence) return 'completed a run'
  return firstSentence.length > 92 ? `${firstSentence.slice(0, 89)}...` : firstSentence
}

function agentMeta(run: AgentDashboardRun) {
  const key = String(run.agent_id || '').toLowerCase()
  return agentTone[key] || {
    label: run.agent_name || run.agent_id || 'Agent',
    tone: '#6b7280',
    icon: String(run.agent_name || run.agent_id || 'A').trim().charAt(0).toUpperCase(),
  }
}

function EmptyIllustration({ kind }: { kind: 'activity' | 'leads' | 'calendar' | 'campaigns' }) {
  const paths = {
    activity: 'M18 42h44M18 30h34M18 54h26M12 30a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    leads: 'M30 30a10 10 0 1 0 20 0 10 10 0 0 0-20 0Zm-10 34c4-12 36-12 40 0M18 18l-6-6m50 6 6-6',
    calendar: 'M18 18h44v42H18zM18 30h44M28 12v12m24-12v12m-24 22 8 8 18-20',
    campaigns: 'M16 42h12l22-16v32L28 42H16Zm34-10 12-8m-12 28 12 8M16 34v16',
  }

  return (
    <svg className="dash-empty-svg" viewBox="0 0 80 80" aria-hidden="true">
      <path d={paths[kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyState({ kind, children, ghosts = 3 }: { kind: 'activity' | 'leads' | 'calendar' | 'campaigns'; children: React.ReactNode; ghosts?: number }) {
  return (
    <div className="dash-empty">
      <EmptyIllustration kind={kind} />
      <div className="dash-ghosts" aria-hidden="true">
        {Array.from({ length: ghosts }).map((_, index) => <span key={index} />)}
      </div>
      <p>{children}</p>
    </div>
  )
}

function RecentActivityPanel({
  runs,
  onOpenRun,
}: {
  runs: AgentDashboardRun[]
  onOpenRun: (run: AgentDashboardRun) => void
}) {
  return (
    <div className="panel dash-panel">
      <div className="dash-panel-head">
        <div className="dash-panel-title">Recent agent activity</div>
        <Link className="dash-panel-link" href="/agent-activity">View all activity →</Link>
      </div>
      <div className="dash-panel-body">
        {runs.length > 0 ? (
          runs.slice(0, 6).map((run) => {
            const meta = agentMeta(run)
            return (
              <button className="dash-activity-row" key={run.run_id} type="button" onClick={() => onOpenRun(run)}>
                <span className="dash-type-icon" style={{ '--agent-tone': meta.tone } as React.CSSProperties}>{meta.icon}</span>
                <span className="dash-activity-copy">
                  <span className="dash-activity-line">
                    <strong>{meta.label}</strong>
                    <span>{runVerb(run)}</span>
                  </span>
                  <span className="dash-activity-status">
                    <Pill variant={statusVariant(run.status)}>{run.status}</Pill>
                  </span>
                </span>
                <span className="dash-row-time">{relativeTime(run.started_at || run.created_at)}</span>
                <span className="dash-chevron">›</span>
              </button>
            )
          })
        ) : (
          <EmptyState kind="activity">Once your AI workforce starts running, you&apos;ll see activity here.</EmptyState>
        )}
      </div>
    </div>
  )
}

function UrgentLeadRow({ lead, onClick }: { lead: DashboardLead; onClick: () => void }) {
  const interest = String(lead.interest_level || lead.status || 'idle').toLowerCase()
  const lastContext = lead.last_contacted_at
    ? `Last interaction ${relativeTime(lead.last_contacted_at)}`
    : lead.phone || 'No phone captured yet'

  return (
    <button type="button" className="dash-lead-row" onClick={onClick}>
      <span className="dash-lead-avatar">{initials(lead.name)}</span>
      <span className="dash-lead-copy">
        <span className="dash-lead-name">
          <strong>{lead.name || 'Unknown lead'}</strong>
          <Pill variant={statusVariant(interest)}>{interest}</Pill>
        </span>
        <span className="dash-lead-meta">{lastContext}</span>
      </span>
      <span className="dash-row-time">
        {lead.last_contacted_at ? `Last contacted ${relativeTime(lead.last_contacted_at)}` : 'Needs first touch'}
      </span>
    </button>
  )
}

function UrgentLeadsPanel({ leads }: { leads: DashboardLead[] }) {
  const router = useRouter()

  return (
    <div className="panel dash-panel">
      <div className="dash-panel-head">
        <div className="dash-panel-title">Urgent leads</div>
        <Link className="dash-panel-link" href="/leads">View all leads →</Link>
      </div>
      <div className="dash-panel-body">
        {leads.length > 0 ? (
          leads.slice(0, 5).map((lead) => (
            <UrgentLeadRow key={lead._id} lead={lead} onClick={() => router.push(`/leads?focus=${lead._id}`)} />
          ))
        ) : (
          <EmptyState kind="leads">No urgent leads — your pipeline is healthy.</EmptyState>
        )}
      </div>
    </div>
  )
}

function minutesUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return `In ${minutes} minutes`
  const hours = Math.round(minutes / 60)
  return `In ${hours} hour${hours === 1 ? '' : 's'}`
}

function AppointmentHero({ appointment }: { appointment: DashboardAppointment }) {
  return (
    <div className="dash-appointment-hero">
      <div className="dash-next-pill">{minutesUntil(appointment.scheduled_at)}</div>
      <div className="dash-appointment-main">
        <div className="dash-time-chip">
          <strong>{formatTime(appointment.scheduled_at)}</strong>
          <span>IST</span>
        </div>
        <div>
          <div className="dash-appointment-name">{appointment.lead_name || 'Lead'}</div>
          <div className="dash-appointment-property">{appointment.property_title || 'Property'} · {appointment.property_location || 'Location pending'}</div>
        </div>
      </div>
      <Link className="btn sm dash-compact-action" href="/calls">Open in calls</Link>
    </div>
  )
}

function AppointmentRow({ appointment }: { appointment: DashboardAppointment }) {
  return (
    <Link className="dash-compact-row" href="/appointments">
      <span className="dash-mini-time">{formatTime(appointment.scheduled_at)}</span>
      <span>
        <strong>{appointment.lead_name || 'Lead'}</strong>
        <span>{appointment.property_title || 'Property'}</span>
      </span>
      <span className="dash-chevron is-visible">›</span>
    </Link>
  )
}

function TodayAppointmentsPanel({ appointments }: { appointments: DashboardAppointment[] }) {
  const [first, ...rest] = appointments.slice(0, 3)

  return (
    <div className="panel dash-panel">
      <div className="dash-panel-head">
        <div className="dash-panel-title">Today&apos;s appointments</div>
        <Link className="dash-panel-link" href="/appointments">View all →</Link>
      </div>
      <div className="dash-panel-body">
        {first ? (
          <>
            <AppointmentHero appointment={first} />
            {rest.slice(0, 2).map((appointment) => <AppointmentRow key={appointment._id} appointment={appointment} />)}
          </>
        ) : (
          <EmptyState kind="calendar" ghosts={0}>No appointments today. Tomorrow&apos;s bookings appear here when scheduled.</EmptyState>
        )}
      </div>
    </div>
  )
}

function CampaignProgress({ campaign }: { campaign: DashboardCampaign }) {
  const total = campaign.target_lead_ids?.length || campaign.total_count || 0
  const dialed = campaign.calls_made || campaign.dialed_count || 0
  const queued = Math.max(0, total - dialed)
  const connected = campaign.calls_connected || campaign.connected_count || 0
  const booked = campaign.appointments_booked || campaign.booked_count || 0
  const dialedPct = total > 0 ? Math.min(100, (dialed / total) * 100) : 0
  const queuedPct = total > 0 ? Math.min(100, ((dialed + queued) / total) * 100) : 0

  return (
    <div className="dash-campaign-row">
      <div className="dash-campaign-title">
        <strong>{campaign.name}</strong>
        {campaign.status === 'dialing' && <LivePulse />}
      </div>
      <div className="dash-progress">
        <span className="queued" style={{ width: `${queuedPct}%` }} />
        <span className="dialed" style={{ width: `${dialedPct}%` }} />
      </div>
      <div className="dash-campaign-counters">
        <span><strong>{dialed}</strong> dialed</span>
        <span><strong>{connected}</strong> connected</span>
        <span><strong>{booked}</strong> booked</span>
      </div>
    </div>
  )
}

function ActiveCampaignsPanel({ campaigns }: { campaigns: DashboardCampaign[] }) {
  return (
    <div className="panel dash-panel">
      <div className="dash-panel-head">
        <div className="dash-panel-title">Active campaigns</div>
      </div>
      <div className="dash-panel-body">
        {campaigns.length > 0 ? (
          campaigns.slice(0, 3).map((campaign) => <CampaignProgress key={campaign._id} campaign={campaign} />)
        ) : (
          <EmptyState kind="campaigns" ghosts={0}>No active campaigns. Launch one from /campaigns to start dialing.</EmptyState>
        )}
      </div>
    </div>
  )
}

export function DashboardSection({ data }: { data: DashboardData }) {
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRun, setSelectedRun] = useState<AgentDashboardRun | null>(null)
  const { role } = useUserRole()
  const canAdd = role === 'admin' || role === 'tech'
  const renderedAt = useMemo(() => new Date(), [])

  return (
    <>
      <section className="page active dash-page">
        <div className="crumb">Work · Dashboard</div>
        <div className="head dash-head">
          <div>
            <h1 className="title dash-title">Operations Dashboard</h1>
            <p className="sub dash-sub">
              Your AI workforce, at a glance
              <span>Last updated {formatDistanceToNow(renderedAt, { addSuffix: true })}</span>
            </p>
          </div>
          <div className="actions dash-actions">
            {canAdd && (
              <button type="button" className="btn sm dash-action-btn" onClick={() => setNewLeadOpen(true)}>
                + New Lead
              </button>
            )}
            {canAdd && (
              <button
                type="button"
                className="btn primary sm dash-action-btn"
                onClick={() => toast('Force run all agents coming in Phase 12')}
              >
                Force run all agents
              </button>
            )}
          </div>
        </div>

        <DashboardHero data={data} />

        <div className="dashboard-grid dash-grid">
          <div className="dashboard-main dash-stack">
            <RecentActivityPanel
              runs={data.recent_runs}
              onOpenRun={(run) => {
                setSelectedRun(run)
                setDrawerOpen(true)
              }}
            />
            <UrgentLeadsPanel leads={data.urgent_leads} />
          </div>

          <div className="dashboard-side dash-stack">
            <TodayAppointmentsPanel appointments={data.upcoming_appointments} />
            <ActiveCampaignsPanel campaigns={data.active_campaigns} />
          </div>
        </div>
      </section>

      <NewClientModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <RunDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} run={selectedRun} />

      <style jsx global>{`
        .dash-page { display: flex; flex-direction: column; gap: 24px; }
        .dash-head { align-items: flex-start; margin-bottom: 0; }
        .dash-title { font-size: 24px; font-weight: 600; letter-spacing: -0.03em; }
        .dash-sub { display: flex; gap: 10px; align-items: center; margin-top: 6px; font-size: 13px; }
        .dash-sub span { color: var(--ink-4); }
        .dash-actions { align-items: center; }
        .dash-action-btn { height: 32px; padding-inline: 12px; }
        .dash-hero-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .dash-metric-card { padding: 16px; box-shadow: var(--shadow-sm); }
        .dash-metric-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .dash-metric-value { font-size: 24px; font-weight: 600; letter-spacing: -0.04em; color: var(--ink); }
        .dash-metric-label { margin-top: 5px; color: var(--ink-3); font-size: 11px; letter-spacing: 0.02em; }
        .dash-trend { margin-top: 9px; color: var(--ink-4); font-size: 11px; }
        .dash-trend.is-up { color: #2f9e66; }
        .dash-trend.is-down { color: #d94b4b; }
        .dash-spark { margin-top: 4px; opacity: 0.9; }
        .dash-spark-blue { color: #2f80ed; }
        .dash-spark-green { color: #2f9e66; }
        .dash-spark-amber { color: #c98916; }
        .dash-spark-violet { color: #7c5cff; }
        .dash-grid { gap: 24px; }
        .dash-stack { display: flex; flex-direction: column; gap: 24px; }
        .dash-panel { overflow: hidden; box-shadow: var(--shadow-sm); }
        .dash-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 8px; }
        .dash-panel-title { font-size: 13px; font-weight: 600; color: var(--ink); }
        .dash-panel-link { color: var(--ink-3); font-size: 12px; text-decoration: none; }
        .dash-panel-link:hover { color: var(--accent); }
        .dash-panel-body { padding: 0 16px 16px; }
        .dash-activity-row,
        .dash-lead-row {
          width: 100%;
          min-height: 54px;
          border: 0;
          border-bottom: 1px solid var(--hairline);
          background: transparent;
          color: inherit;
          display: grid;
          align-items: center;
          gap: 12px;
          text-align: left;
          padding: 12px 8px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .dash-activity-row { grid-template-columns: 28px minmax(0, 1fr) 76px 12px; }
        .dash-lead-row { grid-template-columns: 32px minmax(0, 1fr) 126px; }
        .dash-activity-row:hover,
        .dash-lead-row:hover,
        .dash-compact-row:hover { background: var(--surface-2); }
        .dash-activity-row:last-child,
        .dash-lead-row:last-child { border-bottom: 0; }
        .dash-type-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: var(--agent-tone);
          background: color-mix(in srgb, var(--agent-tone) 13%, white);
          font-size: 12px;
          font-weight: 700;
        }
        .dash-activity-copy,
        .dash-lead-copy { min-width: 0; display: grid; gap: 4px; }
        .dash-activity-line { display: flex; gap: 6px; min-width: 0; align-items: baseline; }
        .dash-activity-line strong,
        .dash-lead-name strong,
        .dash-campaign-title strong,
        .dash-compact-row strong { font-size: 13px; font-weight: 600; color: var(--ink); }
        .dash-activity-line span:last-child,
        .dash-lead-meta,
        .dash-compact-row span span { color: var(--ink-3); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-activity-status { display: flex; }
        .dash-row-time { color: var(--ink-3); font-size: 11px; text-align: right; white-space: nowrap; }
        .dash-chevron { color: var(--ink-4); opacity: 0; transition: opacity 0.15s ease, transform 0.15s ease; font-size: 18px; line-height: 1; }
        .dash-activity-row:hover .dash-chevron,
        .dash-compact-row:hover .dash-chevron,
        .dash-chevron.is-visible { opacity: 1; }
        .dash-activity-row:hover .dash-chevron,
        .dash-compact-row:hover .dash-chevron { transform: translateX(2px); }
        .dash-lead-avatar {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #ff8a4c, #d4541f);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .dash-lead-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .dash-appointment-hero {
          border: 1px solid var(--hairline);
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(135deg, var(--surface), var(--surface-2));
          display: grid;
          gap: 12px;
          margin-bottom: 8px;
        }
        .dash-next-pill {
          width: fit-content;
          padding: 5px 8px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
        }
        .dash-appointment-main { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; align-items: center; }
        .dash-time-chip,
        .dash-mini-time {
          border: 1px solid var(--hairline);
          border-radius: 10px;
          background: var(--surface);
          display: grid;
          place-items: center;
          color: var(--ink);
        }
        .dash-time-chip { min-height: 54px; }
        .dash-time-chip strong { font-size: 14px; }
        .dash-time-chip span { color: var(--ink-3); font-size: 10px; }
        .dash-appointment-name { font-size: 15px; font-weight: 600; color: var(--ink); }
        .dash-appointment-property { margin-top: 3px; color: var(--ink-3); font-size: 12px; }
        .dash-compact-action { width: fit-content; }
        .dash-compact-row {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) 12px;
          gap: 10px;
          align-items: center;
          padding: 10px 8px;
          border-radius: 10px;
          color: inherit;
          text-decoration: none;
        }
        .dash-mini-time { height: 34px; font-size: 11px; font-weight: 600; }
        .dash-compact-row span:nth-child(2) { display: grid; gap: 2px; min-width: 0; }
        .dash-campaign-row {
          display: grid;
          gap: 10px;
          padding: 12px 8px;
          border-bottom: 1px solid var(--hairline);
        }
        .dash-campaign-row:last-child { border-bottom: 0; }
        .dash-campaign-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .dash-progress {
          position: relative;
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
        }
        .dash-progress span { position: absolute; inset: 0 auto 0 0; border-radius: inherit; }
        .dash-progress .queued { background: color-mix(in srgb, var(--accent) 16%, var(--surface-2)); }
        .dash-progress .dialed { background: var(--accent); }
        .dash-campaign-counters { display: flex; flex-wrap: wrap; gap: 10px; color: var(--ink-3); font-size: 11px; }
        .dash-campaign-counters strong { color: var(--ink); font-size: 12px; }
        .dash-empty {
          padding: 24px 14px 28px;
          text-align: center;
          color: var(--ink-3);
          display: grid;
          justify-items: center;
          gap: 12px;
        }
        .dash-empty-svg { width: 80px; height: 80px; color: var(--ink-4); opacity: 0.75; }
        .dash-empty p { margin: 0; max-width: 320px; font-size: 13px; line-height: 1.5; }
        .dash-ghosts { width: min(280px, 100%); display: grid; gap: 7px; }
        .dash-ghosts span { height: 9px; border-radius: 999px; background: var(--surface-2); }
        .dash-ghosts span:nth-child(2) { width: 78%; justify-self: center; }
        .dash-ghosts span:nth-child(3) { width: 58%; justify-self: center; }
        @media (max-width: 900px) {
          .dash-hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dash-head { gap: 14px; }
        }
        @media (max-width: 680px) {
          .dash-hero-grid { grid-template-columns: 1fr; }
          .dash-activity-row,
          .dash-lead-row { grid-template-columns: auto minmax(0, 1fr); }
          .dash-row-time,
          .dash-activity-row .dash-chevron { display: none; }
        }
      `}</style>
    </>
  )
}

export default DashboardSection
