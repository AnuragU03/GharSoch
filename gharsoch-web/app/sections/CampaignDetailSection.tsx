import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft } from 'lucide-react'

import { AgentTransitionTimeline, type AgentTransitionItem } from '@/components/AgentTransitionTimeline'
import { Pill } from '@/components/Pill'
import { StatStrip } from '@/components/StatStrip'

type DetailCampaign = {
  _id: string
  name: string
  description?: string
  status: string
  voice_assistant?: string
  script_template?: string
  target_filter?: string
  created_at?: string | null
  updated_at?: string | null
  start_date?: string | null
  end_date?: string | null
}

type DetailLead = {
  _id: string
  name: string
  phone: string
  status: string
  last_call_at?: string | null
}

type DetailCall = {
  _id: string
  lead_id?: string | null
  created_at?: string | null
}

type DetailRun = {
  _id: string
  run_id?: string
  agent_id?: string
  agent_name?: string
  status?: string
  started_at?: string | null
  created_at?: string | null
  input_data?: Record<string, any>
  output_data?: Record<string, any>
  reasoning_summary?: {
    summary?: string
  }
}

function statusPill(status: string) {
  const value = String(status || '').toLowerCase()
  if (value === 'active' || value === 'queued' || value === 'dialing') return 'running' as const
  if (value === 'paused' || value === 'deferred') return 'amber' as const
  if (value === 'completed') return 'success' as const
  return 'idle' as const
}

function formatRelativeTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return formatDistanceToNow(parsed, { addSuffix: true })
}

function timelineItems(runs: DetailRun[]): AgentTransitionItem[] {
  return runs.map((run) => ({
    id: run._id,
    label: run.agent_name || 'Voice Orchestrator',
    status: run.status || 'completed',
    timestamp: run.started_at || run.created_at || new Date().toISOString(),
    description:
      run.reasoning_summary?.summary ||
      run.output_data?.message ||
      run.output_data?.result ||
      run.input_data?.webhook_type ||
      run.run_id ||
      'Recent voice orchestration activity',
  }))
}

export function CampaignDetailSection({
  campaign,
  leads,
  calls,
  recentRuns,
  stats,
}: {
  campaign: DetailCampaign
  leads: DetailLead[]
  calls: DetailCall[]
  recentRuns: DetailRun[]
  stats: {
    total_contacts: number
    dialed: number
    connected: number
    booked: number
  }
}) {
  const latestCallByLead = new Map<string, DetailCall>()
  for (const call of calls) {
    if (call.lead_id && !latestCallByLead.has(call.lead_id)) {
      latestCallByLead.set(call.lead_id, call)
    }
  }

  const stripCells = [
    { label: 'Total contacts', value: String(stats.total_contacts), delta: 'Resolved campaign audience' },
    { label: 'Dialed', value: String(stats.dialed), delta: 'Latest 50 campaign calls' },
    { label: 'Connected', value: String(stats.connected), delta: 'Calls with real talk time' },
    { label: 'Booked', value: String(stats.booked), delta: 'Appointments tied to campaign leads' },
  ]

  return (
    <section className="page active">
      <div className="crumb">Work · Campaigns</div>

      <Link
        href="/campaigns"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 transition hover:text-ink"
      >
        <ChevronLeft size={15} strokeWidth={2} />
        Back to campaigns
      </Link>

      <div className="head">
        <div>
          <div className="title">{campaign.name}</div>
          <div className="sub">
            {campaign.description || 'Campaign detail view'} · {campaign.voice_assistant || 'Sunrise Property-outbound'} · script: {campaign.script_template || '—'}
          </div>
          <div className="sub" style={{ marginTop: 6 }}>
            Updated {formatRelativeTime(campaign.updated_at)}{campaign.target_filter ? ` · filter: ${campaign.target_filter}` : ''}
          </div>
        </div>
        <div className="actions">
          <Pill variant={statusPill(campaign.status)}>{campaign.status}</Pill>
        </div>
      </div>

      <StatStrip cells={stripCells} />

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Lead list</div>
            <div className="panel-sub">Contacts resolved into this campaign at creation time.</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{leads.length} leads</div>
        </div>
        <div className="panel-body p-0">
          {leads.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Last call</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const latestCall = latestCallByLead.get(lead._id)
                  return (
                    <tr key={lead._id}>
                      <td>
                        <Link href={`/leads?leadId=${lead._id}`} className="name">
                          {lead.name}
                        </Link>
                      </td>
                      <td>{lead.phone}</td>
                      <td>{lead.status}</td>
                      <td>{formatRelativeTime(lead.last_call_at || latestCall?.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No leads resolved for this campaign yet.
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Recent activity</div>
            <div className="panel-sub">Latest voice orchestrator runs tied to campaign calls.</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{recentRuns.length} runs</div>
        </div>
        <div className="panel-body">
          <AgentTransitionTimeline items={timelineItems(recentRuns)} />
        </div>
      </div>
    </section>
  )
}

export default CampaignDetailSection
