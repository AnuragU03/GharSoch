'use client'

import { useState } from 'react'
import { StatStrip } from '@/components/StatStrip'
import { KBBuilderCard } from '@/components/KBBuilderCard'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { BuilderListItem } from '@/lib/builderKBService'

function relativeTime(iso?: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type RecentQuery = {
  run_id: string
  agent_name: string
  timestamp: string
  description: string
  query: Record<string, any> | null
  hit_count: number
}

function BuilderDrawer({
  builder,
  open,
  onClose,
}: {
  builder: BuilderListItem | null
  open: boolean
  onClose: () => void
}) {
  const [queries, setQueries] = useState<RecentQuery[]>([])
  const [loading, setLoading] = useState(false)

  const fetchQueries = async (name: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kb/builder-queries?name=${encodeURIComponent(name)}`)
      if (res.ok) {
        const data = await res.json()
        setQueries(data.data || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  // Fetch when a new builder is opened
  if (open && builder && queries.length === 0 && !loading) {
    fetchQueries(builder.builder_name)
  }

  const profile = builder?.raw_profile || {}
  const colors = builder && builder.reputation_score >= 80 ? 'var(--green)' : builder && builder.reputation_score >= 60 ? 'var(--amber)' : 'var(--red)'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { setQueries([]); onClose() } }}>
      <SheetContent side="right" className="w-[560px] max-w-[92vw] overflow-y-auto border-hairline bg-surface p-0 shadow-elev-2">
        <div className="drawer-head">
          <div>
            <SheetTitle className="m-0 text-[16px] font-semibold text-ink">
              {builder?.builder_name || 'Builder profile'}
            </SheetTitle>
            <div className="runid">{builder?.region || ''} · {builder?.project_count || 0} projects</div>
          </div>
        </div>

        {builder && (
          <div className="drawer">
            <div className="drawer-section">
              <h4>Reputation</h4>
              <div className="step eval">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>Score</span>
                  <span style={{ fontWeight: 700, color: colors }}>{builder.reputation_score}/100</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${builder.reputation_score}%`, background: colors, borderRadius: 3 }} />
                </div>
              </div>
            </div>

            <div className="drawer-section">
              <h4>Full profile</h4>
              <div className="step eval" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Avg rating', builder.average_rating ? `${builder.average_rating}/5` : '—'],
                  ['Completed projects', String(builder.completed_projects || '—')],
                  ['Ongoing projects', String(builder.ongoing_projects || '—')],
                  ['Avg delivery', builder.avg_project_delivery_months ? `${builder.avg_project_delivery_months}mo` : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
                {builder.service_locations?.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locations</div>
                    <div style={{ fontSize: 13 }}>{builder.service_locations.join(', ')}</div>
                  </div>
                )}
                {builder.portfolio_descriptions && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{builder.portfolio_descriptions}</div>
                  </div>
                )}
                {builder.customer_reviews_summary && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reviews</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{builder.customer_reviews_summary}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-section">
              <h4>Recent queries</h4>
              {loading ? (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>
              ) : queries.length > 0 ? (
                queries.map((q, i) => (
                  <div key={i} className="step tool">
                    <div className="kind">{q.agent_name} · {relativeTime(q.timestamp)}</div>
                    <div style={{ fontSize: 12 }}>{q.description}</div>
                    {q.query && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace', marginTop: 3 }}>{JSON.stringify(q.query)}</div>}
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Hits: {q.hit_count}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No KB queries recorded for this builder yet.</div>
              )}
            </div>

            <div className="drawer-section">
              <h4>Documents</h4>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 0' }}>
                Document upload and management coming in Phase 12.
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function KnowledgeBaseSection({ builders }: { builders: BuilderListItem[] }) {
  const [selectedBuilder, setSelectedBuilder] = useState<BuilderListItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const totalQueries24h = builders.reduce((sum, b) => sum + b.queries_24h, 0)
  const stripCells = [
    { label: 'Builders', value: String(builders.length) },
    { label: 'Documents', value: builders.reduce((s, b) => s + b.document_count, 0).toString() },
    { label: 'RAG chunks', value: '—' },
    { label: 'KB queries 24h', value: String(totalQueries24h) },
    { label: 'Coverage', value: builders.length > 0 ? `${Math.round((builders.filter(b => b.queries_24h > 0).length / builders.length) * 100)}%` : '—' },
    { label: 'Last sync', value: builders[0]?.updated_at ? relativeTime(builders[0].updated_at) : '—' },
  ]

  return (
    <>
      <section className="page active">
        <div className="crumb">Intelligence · Knowledge Base</div>
        <div className="head">
          <div>
            <h1 className="title">Knowledge Base</h1>
            <p className="sub">Builder profiles, project data, and reputation scores used by the matching fleet.</p>
          </div>
        </div>

        <StatStrip cells={stripCells} />

        {builders.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {builders.map(builder => (
              <KBBuilderCard
                key={builder.builder_id || builder.builder_name}
                builder={builder}
                onClick={() => {
                  setSelectedBuilder(builder)
                  setDrawerOpen(true)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="panel">
            <div className="panel-body" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: 48 }}>
              No builders found in the Knowledge Base. Add builder profiles to the <code>builders</code> collection.
            </div>
          </div>
        )}
      </section>

      <BuilderDrawer
        builder={selectedBuilder}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedBuilder(null) }}
      />
    </>
  )
}
