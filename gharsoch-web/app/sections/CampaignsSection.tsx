'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Pause, Play, Plus } from 'lucide-react'

import { launchCampaignAction, pauseCampaignAction, resumeCampaignAction } from '@/app/actions/campaigns'
import { NewCampaignModal } from '@/components/modals/NewCampaignModal'
import { Pill } from '@/components/Pill'
import { toast } from '@/lib/toast'
import type { SerializedCampaign } from '@/lib/services/campaignService'
import { useUserRole } from '@/lib/auth/useUserRole'

function progressPercent(campaign: SerializedCampaign) {
  const total = campaign.target_lead_ids?.length || 0
  if (total === 0) return 0
  return Math.min(100, Math.round((campaign.calls_made / total) * 100))
}

function statusPill(status: string) {
  const value = status.toLowerCase()
  if (value === 'active' || value === 'queued') return 'running' as const
  if (value === 'paused') return 'amber' as const
  if (value === 'completed') return 'success' as const
  return 'idle' as const
}

function outcomeText(campaign: SerializedCampaign) {
  if ((campaign.status || '').toLowerCase() === 'completed') {
    return `${campaign.appointments_booked || 0} booked, ${campaign.callback_count || 0} callback`
  }
  return '—'
}

export function CampaignsSection({
  activeCampaigns,
  draftCampaigns,
  completedCampaigns,
}: {
  activeCampaigns: SerializedCampaign[]
  draftCampaigns: SerializedCampaign[]
  completedCampaigns: SerializedCampaign[]
}) {
  const [newOpen, setNewOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { role } = useUserRole()
  const canAdd = role === 'admin' || role === 'tech'

  const activeCount = useMemo(
    () => activeCampaigns.filter((campaign) => ['active', 'queued'].includes(String(campaign.status || '').toLowerCase())).length,
    [activeCampaigns]
  )

  const mutateCampaign = (action: 'launch' | 'pause' | 'resume', id: string) => {
    startTransition(() => {
      const fn = action === 'launch' ? launchCampaignAction : action === 'pause' ? pauseCampaignAction : resumeCampaignAction
      void fn(id)
        .then(() => toast.success(action === 'launch' ? 'Campaign queued' : action === 'pause' ? 'Campaign paused' : 'Campaign resumed'))
        .catch((error) => {
          console.error('[CAMPAIGNS] Mutation failed:', error)
          toast.error('Campaign update failed')
        })
    })
  }

  const openCampaign = (id: string) => {
    router.push(`/campaigns/${id}`)
  }

  const openCampaignOnKeyDown = (event: React.KeyboardEvent<HTMLElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openCampaign(id)
    }
  }

  return (
    <section className="page active">
      <div className="crumb">Work · Campaigns</div>
      <div className="head">
        <div>
          <div className="title">Campaigns</div>
          <div className="sub">Batched outbound runs through the Campaign Conductor agent. TRAI-aware throttling.</div>
        </div>
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={isPending || activeCampaigns.length === 0}
            onClick={() => {
              for (const campaign of activeCampaigns) {
                if (String(campaign.status || '').toLowerCase() !== 'paused') {
                  mutateCampaign('pause', campaign._id)
                }
              }
            }}
          >
            <Pause size={13} strokeWidth={1.8} /> Pause all
          </button>
          {canAdd && (
            <button className="btn primary" type="button" onClick={() => setNewOpen(true)}>
              <Plus size={13} strokeWidth={1.8} /> New Campaign
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Active</div>
          <Pill variant={activeCount > 0 ? 'running' : 'idle'}>{activeCount} running</Pill>
        </div>
        <div style={{ padding: 0 }}>
          {activeCampaigns.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-3">No active or queued campaigns yet.</div>
          ) : (
            activeCampaigns.map((campaign, index) => (
              <div
                key={campaign._id}
                role="link"
                tabIndex={0}
                onClick={() => openCampaign(campaign._id)}
                onKeyDown={(event) => openCampaignOnKeyDown(event, campaign._id)}
                style={{
                  padding: '16px 18px',
                  borderBottom: index < activeCampaigns.length - 1 ? '1px solid var(--hairline)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{campaign.name}</div>
                    <div style={{ color: 'var(--ink-3)', fontSize: '12.5px', marginTop: 3 }}>
                      Targets {campaign.target_lead_ids?.length || 0} leads · {campaign.voice_assistant || 'Sunrise Property-outbound'} · script: {campaign.script_template}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill variant={statusPill(campaign.status)}>{campaign.status}</Pill>
                    {String(campaign.status || '').toLowerCase() === 'paused' ? (
                      <button
                        className="btn sm"
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          mutateCampaign('resume', campaign._id)
                        }}
                      >
                        <Play size={12} strokeWidth={1.8} /> Resume
                      </button>
                    ) : null}
                    {String(campaign.status || '').toLowerCase() !== 'paused' ? (
                      <button
                        className="btn sm"
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          mutateCampaign('pause', campaign._id)
                        }}
                      >
                        <Pause size={12} strokeWidth={1.8} /> Pause
                      </button>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 14, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercent(campaign)}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    <b style={{ color: 'var(--ink)' }}>{campaign.calls_made} / {campaign.target_lead_ids?.length || 0}</b> dialed · {campaign.calls_connected || 0} connected · {campaign.appointments_booked || 0} booked · {campaign.dnc_count || 0} DNC
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Drafts & completed</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Targets</th>
              <th>Status</th>
              <th>Outcome</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {[...draftCampaigns, ...completedCampaigns].length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-ink-3">No drafts or completed campaigns yet.</td>
              </tr>
            ) : (
              [...draftCampaigns, ...completedCampaigns].map((campaign) => (
                <tr
                  key={campaign._id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openCampaign(campaign._id)}
                  onKeyDown={(event) => openCampaignOnKeyDown(event, campaign._id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <Link
                      href={`/campaigns/${campaign._id}`}
                      className="name"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {campaign.name}
                    </Link>
                    <div className="meta">script: {campaign.script_template}</div>
                  </td>
                  <td>{campaign.target_lead_ids?.length || 0} leads</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Pill variant={statusPill(campaign.status)}>{campaign.status}</Pill>
                      {campaign.status === 'draft' ? (
                        <button
                          className="btn sm"
                          type="button"
                          disabled={isPending}
                          onClick={(event) => {
                            event.stopPropagation()
                            mutateCampaign('launch', campaign._id)
                          }}
                        >
                          <Play size={12} strokeWidth={1.8} /> Launch
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td>{outcomeText(campaign)}</td>
                  <td>{formatDistanceToNow(new Date(campaign.updated_at), { addSuffix: true })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewCampaignModal open={newOpen} onClose={() => setNewOpen(false)} />
    </section>
  )
}

export default CampaignsSection
