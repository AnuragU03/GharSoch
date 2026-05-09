'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { RunDetailDrawer } from '@/components/RunDetailDrawer'
import { useAgentEventStream } from '@/lib/hooks/useAgentEventStream'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'

const AGENT_LABELS: Record<string, string> = {
  matchmaker: 'Matchmaker',
  follow_up_agent: 'Follow-Up',
  appointment_guardian: 'Guardian',
  dead_lead_reengager: 'Re-engager',
  price_drop_negotiator: 'Price-Drop',
  voice_orchestrator: 'Voice',
  client_lead_converter: 'Converter',
}

const ALL_AGENTS = Object.keys(AGENT_LABELS)

function eventTypeLabel(type: string) {
  return type.replace('execution_', '').replace('_', ' ')
}

function eventDotColor(type: string) {
  if (type.includes('error') || type.includes('failed')) return 'bg-red-500'
  if (type.includes('completed')) return 'bg-green-500'
  if (type.includes('started')) return 'bg-accent'
  return 'bg-ink-4'
}

export function LiveActivityFeed({
  initialRuns = [],
  agentFilter: externalFilter,
  showFilterChips = true,
  showPauseButton = true,
  fullWidth = false,
}: {
  initialRuns?: AgentDashboardRun[]
  agentFilter?: string
  showFilterChips?: boolean
  showPauseButton?: boolean
  fullWidth?: boolean
}) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [paused, setPaused] = useState(false)
  const [liveEvents, setLiveEvents] = useState<any[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)

  const filter = externalFilter || (activeFilter === 'all' ? undefined : activeFilter)

  const handleEvent = useCallback((event: any) => {
    if (paused) return
    if (event.type === 'connected' || event.type === 'heartbeat') return
    if (filter && event.agent_id !== filter) return
    setLiveEvents(prev => [event, ...prev].slice(0, 200))
  }, [paused, filter])

  useAgentEventStream({ onEvent: handleEvent })

  // Seed with initial runs converted to events
  useEffect(() => {
    if (initialRuns.length > 0) {
      const seeded = initialRuns.map(run => ({
        type: run.status === 'failed' ? 'execution_error' : 'execution_completed',
        run_id: run.run_id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        timestamp: run.started_at,
        content: run.reasoning_summary?.summary || run.output_data?.summary || '',
      }))
      setLiveEvents(seeded)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => c + 20)
        }
      },
      { threshold: 0.1 }
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [])

  const filteredEvents = liveEvents.filter(ev => {
    if (!filter || filter === 'all') return true
    return ev.agent_id === filter
  })

  const visibleEvents = filteredEvents.slice(0, visibleCount)

  // Find the run object for drawer
  const selectedRun = selectedRunId
    ? (initialRuns.find(r => r.run_id === selectedRunId) || null)
    : null

  return (
    <>
      <div>
        {(showFilterChips || showPauseButton) && (
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            {showFilterChips && (
              <>
                <button
                  type="button"
                  className={`btn sm${activeFilter === 'all' ? ' primary' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >
                  All
                </button>
                {ALL_AGENTS.map(agentId => (
                  <button
                    key={agentId}
                    type="button"
                    className={`btn sm${activeFilter === agentId ? ' primary' : ''}`}
                    onClick={() => setActiveFilter(agentId)}
                  >
                    {AGENT_LABELS[agentId]}
                  </button>
                ))}
              </>
            )}
            {showPauseButton && (
              <button
                type="button"
                className="btn sm ghost ml-auto"
                onClick={() => setPaused(p => !p)}
              >
                {paused ? '▶ Resume' : '⏸ Pause stream'}
              </button>
            )}
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Live activity stream</div>
              <div className="panel-sub">
                {paused ? 'Stream paused' : 'Real-time execution events from the fleet.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!paused && (
                <span className="live">
                  <span className="pulse" /> Live
                </span>
              )}
              <span className="text-xs text-ink-3">{filteredEvents.length} events</span>
            </div>
          </div>
          <div className="panel-body p-0">
            {visibleEvents.length > 0 ? (
              <div className="divide-y divide-hairline">
                {visibleEvents.map((ev, i) => (
                  <div
                    key={`${ev.run_id}-${ev.type}-${i}`}
                    className="flex cursor-pointer items-center gap-4 p-4 hover:bg-surface-2 transition-colors"
                    onClick={() => {
                      if (ev.run_id) {
                        setSelectedRunId(ev.run_id)
                        setDrawerOpen(true)
                      }
                    }}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${eventDotColor(ev.type)}`} />
                    <div className="text-xs text-ink-3 shrink-0 w-20">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="w-40 shrink-0">
                      <div className="text-sm font-medium">{ev.agent_name || AGENT_LABELS[ev.agent_id] || ev.agent_id}</div>
                      <div className="text-xs text-ink-3 font-mono">{ev.run_id?.substring(0, 8)}…</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm capitalize">{eventTypeLabel(ev.type)}</div>
                      {ev.content && (
                        <div className="text-xs text-ink-2 truncate max-w-[500px]">{ev.content}</div>
                      )}
                      {ev.error && (
                        <div className="text-xs text-red-500 truncate">{ev.error}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={loadMoreRef} className="py-2 text-center text-xs text-ink-3">
                  {filteredEvents.length > visibleCount ? 'Loading more…' : ''}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-ink-3 text-sm">
                {paused ? 'Stream paused. Resume to see new events.' : 'Waiting for agent activity…'}
              </div>
            )}
          </div>
        </div>
      </div>

      <RunDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        run={selectedRun}
      />
    </>
  )
}
