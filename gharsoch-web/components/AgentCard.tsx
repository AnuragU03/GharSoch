'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

import { forceRunAgent } from '@/app/actions/agents'
import { LivePulse } from '@/components/LivePulse'
import { Pill, type PillVariant } from '@/components/Pill'
import { useAgentEventStream } from '@/lib/hooks/useAgentEventStream'
import { useUserRole } from '@/lib/auth/useUserRole'
import { toast } from '@/lib/toast'
import type {
  AgentDashboardRun,
  AgentDashboardSummary,
  EnrichedMatchDetail,
  VoiceInFlightRun,
} from '@/lib/services/agentDashboardService'

type Counter = {
  label: string
  value: string
}

type MatchRow = {
  key: string
  pair: string
  meta?: string
  rationale?: string
  score?: number
  warn?: boolean
  vapiCallId?: string
  runId?: string
}

type VoiceCounterState = {
  tool_calls_24h: number
  search_props_24h: number
  qualify_lead_24h: number
  book_appt_24h: number
}

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return 'Awaiting first run'
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }

  return format(parsed, 'dd MMM · HH:mm')
}

function statusToPill(status?: string | null): PillVariant {
  if (!status) return 'idle'
  if (status === 'success' || status === 'completed') return 'success'
  if (status === 'failed' || status === 'error') return 'failed'
  if (status === 'in_progress' || status === 'started' || status === 'running' || status === 'active') return 'running'
  return 'idle'
}

function buildMatchRows(run?: AgentDashboardRun | null): MatchRow[] {
  if (!run?.output_data) {
    return []
  }

  const output = run.output_data

  if (Array.isArray(output.match_details) && output.match_details.length > 0) {
    return output.match_details.map((detail: EnrichedMatchDetail, index) => ({
      key: `${run.run_id}-match-${index}`,
      pair: detail.client_name && detail.property_title
        ? `${detail.client_name} → ${detail.property_title}`
        : `${detail.client_id || 'Lead'} → ${detail.property_id || 'Property'}`,
      meta: [detail.builder_name, detail.location, detail.status].filter(Boolean).join(' · '),
      rationale: detail.rationale,
      score: typeof detail.score === 'number' ? detail.score : undefined,
      warn: typeof detail.score === 'number' ? detail.score < 80 : false,
      vapiCallId: detail.vapi_call_id,
      runId: run.run_id,
    }))
  }

  if (Array.isArray((output as any).lead_details) && (output as any).lead_details.length > 0) {
    return (output as any).lead_details.map((detail: any, index: number) => ({
      key: `${run.run_id}-lead-${index}`,
      pair: detail.lead_name || detail.lead_id || 'Lead detail',
      meta: detail.status || 'Lead action',
      rationale: detail.recommendation || detail.reason || output.summary,
      vapiCallId: detail.vapi_call_id,
      runId: run.run_id,
    }))
  }

  if (output.property?.title) {
    return [
      {
        key: `${run.run_id}-property`,
        pair: output.property.title,
        meta: output.property.id,
        rationale: typeof output.summary === 'string' ? output.summary : 'Property event processed.',
        runId: run.run_id,
      },
    ]
  }

  if (typeof output.summary === 'string' && output.summary.length > 0) {
    return [
      {
        key: `${run.run_id}-summary`,
        pair: 'Latest run summary',
        rationale: output.summary,
        runId: run.run_id,
      },
    ]
  }

  if (run.agent_id === 'voice_orchestrator') {
    const webhookType = typeof run.input_data?.webhook_type === 'string' ? run.input_data.webhook_type : 'voice event'
    const toolNames = Array.isArray(run.input_data?.tool_names) ? run.input_data.tool_names.join(', ') : ''
    return [
      {
        key: `${run.run_id}-voice`,
        pair: `Webhook: ${webhookType}`,
        meta: toolNames,
        rationale: typeof output.message === 'string' ? output.message : 'Voice event processed.',
        runId: run.run_id,
      },
    ]
  }

  return []
}

function normalizeVoiceCounters(summary?: AgentDashboardSummary): VoiceCounterState {
  return {
    tool_calls_24h: summary?.tool_calls_24h ?? 0,
    search_props_24h: summary?.search_props_24h ?? 0,
    qualify_lead_24h: summary?.qualify_lead_24h ?? 0,
    book_appt_24h: summary?.book_appt_24h ?? 0,
  }
}

function formatElapsed(startedAt: string, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - Date.parse(startedAt))
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(seconds / 60)

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s elapsed`
  }

  return `${seconds}s elapsed`
}

function buildVoiceRows(inFlightRuns: VoiceInFlightRun[], nowMs: number): MatchRow[] {
  return inFlightRuns.map((run) => ({
    key: run.run_id,
    pair: run.call_id ? `Call ${run.call_id}` : `Run ${run.run_id.slice(0, 8)}`,
    meta: [run.webhook_type, run.tool_names.join(', ')].filter(Boolean).join(' · '),
    rationale: formatElapsed(run.started_at, nowMs),
    runId: run.run_id,
  }))
}

export function AgentCard({
  id,
  name,
  purpose,
  triggerLabel,
  icon,
  iconVariant = 'default',
  counters,
  summary,
  run,
  onOpenRun,
  liveLabel,
}: {
  id: string
  name: string
  purpose: string
  triggerLabel: string
  icon: string
  iconVariant?: 'default' | 'green' | 'amber' | 'violet' | 'warm'
  counters: Counter[]
  summary?: AgentDashboardSummary
  run?: AgentDashboardRun | null
  onOpenRun: (runId: string) => void
  liveLabel?: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const { can } = useUserRole()
  const [isForceRunPending, startForceRunTransition] = useTransition()
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [pulseActive, setPulseActive] = useState(false)
  const [voiceCounters, setVoiceCounters] = useState<VoiceCounterState>(() => normalizeVoiceCounters(summary))
  const [voiceRuns, setVoiceRuns] = useState<VoiceInFlightRun[]>(() => summary?.in_flight_runs ?? [])
  const [lastRunAt, setLastRunAt] = useState<string | null>(summary?.last_run_at || run?.started_at || null)
  const [lastRunStatus, setLastRunStatus] = useState<string | null>(summary?.last_run_status || run?.status || null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const isVoiceOrchestrator = id === 'voice_orchestrator'

  const removeVoiceRun = (runId: string, delayMs: number = 1800) => {
    window.setTimeout(() => {
      setVoiceRuns((current) => current.filter((item) => item.run_id !== runId))
    }, delayMs)
  }

  useEffect(() => {
    setLastRunAt(summary?.last_run_at || run?.started_at || null)
    setLastRunStatus(summary?.last_run_status || run?.status || null)
    if (isVoiceOrchestrator) {
      setVoiceCounters(normalizeVoiceCounters(summary))
      setVoiceRuns(summary?.in_flight_runs ?? [])
    }
  }, [summary, run, isVoiceOrchestrator])

  useEffect(() => {
    if (!isVoiceOrchestrator || voiceRuns.length === 0) {
      return
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isVoiceOrchestrator, voiceRuns.length])

  const matchRows = useMemo(() => buildMatchRows(run), [run])
  const voiceRows = useMemo(() => buildVoiceRows(voiceRuns, nowMs), [voiceRuns, nowMs])
  const displayedRows = isVoiceOrchestrator && voiceRows.length > 0 ? voiceRows : matchRows

  useAgentEventStream({
    agentId: id,
    onEvent: (event) => {
      if (event.type === 'execution_started') {
        setLiveStatus('running')
        setLastRunAt(event.timestamp || new Date().toISOString())
        setLastRunStatus('started')

        if (isVoiceOrchestrator) {
          const inputData = event.data?.input_data || {}
          setVoiceRuns((current) => {
            const existing = current.find((item) => item.run_id === event.run_id)
            const nextRun: VoiceInFlightRun = {
              run_id: event.run_id,
              started_at: event.timestamp || new Date().toISOString(),
              elapsed_ms: 0,
              call_id: inputData.call_id,
              webhook_type: inputData.webhook_type,
              tool_names: Array.isArray(inputData.tool_names) ? inputData.tool_names : [],
            }

            if (existing) {
              return current.map((item) => (item.run_id === event.run_id ? nextRun : item))
            }

            return [nextRun, ...current]
          })
        }
      } else if (event.type === 'action') {
        if (isVoiceOrchestrator && event.data?.action_type === 'tool_dispatch') {
          setPulseActive(true)
          window.setTimeout(() => setPulseActive(false), 1200)

          const toolName = event.data?.parameters?.tool_name
          setVoiceCounters((current) => ({
            tool_calls_24h: current.tool_calls_24h + 1,
            search_props_24h: current.search_props_24h + (toolName === 'search_properties' ? 1 : 0),
            qualify_lead_24h: current.qualify_lead_24h + (toolName === 'qualify_lead' ? 1 : 0),
            book_appt_24h: current.book_appt_24h + (toolName === 'book_appointment' ? 1 : 0),
          }))

          setVoiceRuns((current) =>
            current.map((item) =>
              item.run_id === event.run_id
                ? {
                    ...item,
                    tool_names: item.tool_names.length > 0
                      ? item.tool_names
                      : toolName
                        ? [toolName]
                        : item.tool_names,
                  }
                : item
            )
          )
        }
      } else if (event.type === 'execution_completed') {
        setLiveStatus('success')
        setLastRunAt(event.timestamp || new Date().toISOString())
        setLastRunStatus('success')

        if (isVoiceOrchestrator) {
          removeVoiceRun(event.run_id)
        } else {
          setTimeout(() => {
            setLiveStatus(null)
            router.refresh()
          }, 3000)
        }
      } else if (event.type === 'execution_error') {
        setLiveStatus('failed')
        setLastRunAt(event.timestamp || new Date().toISOString())
        setLastRunStatus('failed')

        if (isVoiceOrchestrator) {
          removeVoiceRun(event.run_id)
        } else {
          setTimeout(() => {
            setLiveStatus(null)
            router.refresh()
          }, 3000)
        }
      }
    },
  })

  const voiceLiveCount = isVoiceOrchestrator ? voiceRuns.length : 0
  const pillVariant = isVoiceOrchestrator && voiceLiveCount > 0
    ? 'running'
    : isVoiceOrchestrator && !liveStatus
      ? 'running'
      : statusToPill(liveStatus || lastRunStatus)
  const pillLabel = isVoiceOrchestrator && voiceLiveCount > 0
    ? `Live · ${voiceLiveCount} calls in flight`
    : isVoiceOrchestrator && !liveStatus
      ? 'Active'
      : (liveStatus || lastRunStatus || 'idle').replaceAll('_', ' ')
  const renderedCounters = isVoiceOrchestrator
    ? [
        { label: 'Tool calls 24h', value: String(voiceCounters.tool_calls_24h) },
        { label: 'Search props', value: String(voiceCounters.search_props_24h) },
        { label: 'Qualify lead', value: String(voiceCounters.qualify_lead_24h) },
        { label: 'Book appt', value: String(voiceCounters.book_appt_24h) },
      ]
    : counters

  const handleForceRun = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    startForceRunTransition(() => {
      void forceRunAgent(id)
        .then(() => {
          toast.success(`${name} force run queued`)
          router.refresh()
        })
        .catch((error) => {
          console.error('[AI OPS] Force run failed:', error)
          toast.error('Could not force run agent')
        })
    })
  }

  return (
    <article
      className={`agent${isExpanded ? ' expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="agent-head">
        <div>
          <div className="agent-name">{name}</div>
          <div className="agent-purpose">{purpose}</div>
        </div>
        <div className={`agent-icon${iconVariant !== 'default' ? ` ${iconVariant}` : ''}`}>{icon}</div>
      </div>

      <div className="agent-counters">
        {renderedCounters.map((counter) => (
          <div className="counter" key={counter.label}>
            <div className="counter-label">{counter.label}</div>
            <div className="counter-value">{counter.value}</div>
          </div>
        ))}
      </div>

      <div className="agent-row">
        <div>
          <span>
            Trigger: <b>{triggerLabel}</b>
          </span>
          <span>
            Last triggered: <b>{formatTimestamp(lastRunAt)}</b>
          </span>
        </div>
        <div>
          {can.forceRun ? (
            <button
              type="button"
              className="btn sm ghost"
              disabled={isForceRunPending}
              onClick={handleForceRun}
            >
              {isForceRunPending ? 'Running...' : 'Force Run'}
            </button>
          ) : null}
          <Pill variant={pillVariant}>{pillLabel}</Pill>
          {(liveLabel || liveStatus || pulseActive || voiceLiveCount > 0) ? (
            <span className="live">
              <LivePulse /> {voiceLiveCount > 0 ? 'Routing live' : pulseActive ? 'Webhook activity' : liveStatus === 'running' ? 'Running now' : liveLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="agent-expanded">
        <div className="expanded-title">
          {isVoiceOrchestrator && voiceRows.length > 0 ? 'Calls in flight' : displayedRows.length > 0 ? 'Latest run detail' : 'Latest run'}
        </div>
        {displayedRows.length > 0 ? (
          displayedRows.map((row) => (
            <button
              key={row.key}
              type="button"
              className="match-row w-full text-left"
              onClick={(event) => {
                event.stopPropagation()
                if (row.runId) {
                  onOpenRun(row.runId)
                } else if (run?.run_id) {
                  onOpenRun(run.run_id)
                }
              }}
            >
              <div>
                <div className="match-pair">{row.pair}</div>
                {row.meta ? <div className="match-meta">{row.meta}</div> : null}
                {row.rationale ? <div className="match-rationale">{row.rationale}</div> : null}
                {row.vapiCallId ? <span className="vapi-link">Vapi call · {row.vapiCallId}</span> : null}
              </div>
              <div>
                {typeof row.score === 'number' ? (
                  <span className={`score${row.warn ? ' warn' : ''}`}>Score {row.score}</span>
                ) : null}
              </div>
            </button>
          ))
        ) : (
          <div className="match-row">
            <div>
              <div className="match-pair">{isVoiceOrchestrator ? 'No calls currently in flight' : 'No recent matched items'}</div>
              <div className="match-rationale">
                {run?.output_data?.summary || (isVoiceOrchestrator ? 'Waiting for the next voice webhook event.' : 'This agent has not produced expandable output yet.')}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
