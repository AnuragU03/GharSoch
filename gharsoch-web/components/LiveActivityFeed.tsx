'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { RunDetailDrawer } from '@/components/RunDetailDrawer'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'
import { AgentTransitionTimeline } from '@/components/AgentTransitionTimeline'

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
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const filter = externalFilter || (activeFilter === 'all' ? undefined : activeFilter)

  const handleEvent = useCallback((event: any) => {
    if (paused) return
    if (filter && event.agent_id !== filter) return
    const callId = event.data?.input_data?.call_id || event.run?.input_data?.call_id
    const enhancedEvent = callId ? { ...event, call_id: callId } : event
    setLiveEvents(prev => [enhancedEvent, ...prev].slice(0, 200))
  }, [paused, filter])

  useAgentEventStream({ onEvent: handleEvent })

  // Seed with initial runs converted to events
  useEffect(() => {
        const seeded = initialRuns.map(run => {
          const callId = run.input_data?.call_id || run.output_data?.callId || run.output_data?.call_id
          return {
            type: run.status === 'failed' ? 'execution_error' : 'execution_completed',
            run_id: run.run_id,
            agent_id: run.agent_id,
            agent_name: run.agent_name,
            timestamp: run.started_at || run.created_at,
            content: run.reasoning_summary?.summary || run.output_data?.summary || '',
            call_id: callId,
            run: run,
          }
        })
        setLiveEvents(seeded)
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

  // Group voice_orchestrator events
  const groupedEvents: any[] = []
  const voiceGroupMap = new Map<string, any[]>()

  filteredEvents.forEach(ev => {
    const isVoice = ev.agent_id === 'voice_orchestrator'
    const callId = ev.call_id
    if (isVoice && callId) {
      if (!voiceGroupMap.has(callId)) {
        voiceGroupMap.set(callId, [])
        groupedEvents.push({ 
          isGroup: true, 
          call_id: callId, 
          agent_name: ev.agent_name || AGENT_LABELS[ev.agent_id] || ev.agent_id,
          events: voiceGroupMap.get(callId),
          timestamp: ev.timestamp
        })
      }
      voiceGroupMap.get(callId)!.push(ev)
    } else {
      groupedEvents.push(ev)
    }
  })

  const visibleEvents = groupedEvents.slice(0, visibleCount)

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
                {visibleEvents.map((ev, i) => {
                  if (ev.isGroup) {
                    const isExpanded = expandedGroups.has(ev.call_id)
                    const latestEvent = ev.events[0]
                    // F3 grouping pattern
                    // "The row shows: lead name + call timestamp + N tool dispatches inside (expandable)"
                    const leadName = latestEvent.run?.output_data?.lead_name || 'Active Call'
                    const items = ev.events.map((e: any) => {
                      const toolName = e.run?.input_data?.tool_names?.[0] || e.content || eventTypeLabel(e.type)
                      return {
                        id: `${e.run_id}-${e.type}`,
                        label: toolName,
                        status: e.type.includes('error') ? 'failed' : 'success',
                        timestamp: e.timestamp,
                        description: e.run?.run_id?.substring(0, 8),
                      }
                    }).reverse() // Reverse so earliest is first in timeline

                    return (
                      <div key={`group-${ev.call_id}`} className="flex flex-col">
                        <div 
                          className="flex cursor-pointer items-center gap-4 p-4 hover:bg-surface-2 transition-colors"
                          onClick={() => {
                            setExpandedGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(ev.call_id)) next.delete(ev.call_id)
                              else next.add(ev.call_id)
                              return next
                            })
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 bg-ink-4`} />
                          <div className="text-xs text-ink-3 shrink-0 w-20">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="w-40 shrink-0">
                            <div className="text-sm font-medium">{ev.agent_name}</div>
                            <div className="text-xs text-ink-3 font-mono">Call: {ev.call_id.substring(0, 8)}…</div>
                          </div>
                          <div className="flex-1 min-w-0 flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium">{leadName}</div>
                              <div className="text-xs text-ink-3">{ev.events.length} dispatches recorded</div>
                            </div>
                            <div className="text-ink-3 text-xs pr-4">{isExpanded ? '▲' : '▼'}</div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="pl-[120px] pr-4 pb-4 bg-surface-50">
                            <div className="pt-2">
                              <AgentTransitionTimeline items={items} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
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
                  )
                })}
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
