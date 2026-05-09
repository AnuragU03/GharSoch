'use client'

import { useRouter } from 'next/navigation'
import { StatStrip } from '@/components/StatStrip'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import type {
  AnalyticsRange,
  AnalyticsKPIs,
  AnalyticsFunnel,
  CallsPerAgentPoint,
  TopPerformingAgent,
} from '@/lib/services/analyticsService'

/* ── helpers ────────────────────────────────────────────── */

function pct(n: number) { return `${n}%` }
function inr(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

const FUNNEL_ITEMS: Array<{ key: keyof AnalyticsFunnel; label: string }> = [
  { key: 'clients', label: 'Clients / Enquiries' },
  { key: 'converted_to_lead', label: 'Converted to Lead' },
  { key: 'matched_to_property', label: 'Matched to Property' },
  { key: 'vapi_call_connected', label: 'Vapi Call Connected' },
  { key: 'site_visit_booked', label: 'Site Visit Booked' },
]

const LINE_COLORS = {
  matchmaker: '#0066cc',
  follow_up: '#c2410c',
  re_engager: '#1a7c4a',
  guardian: '#a06010',
  voice: '#6e3ad6',
}

/* ── sub-components ─────────────────────────────────────── */

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pctWidth = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{value.toLocaleString('en-IN')}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pctWidth}%`,
            borderRadius: 4,
            background: 'linear-gradient(90deg, var(--accent) 0%, #0ea5e9 100%)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

function TopAgentCard({ agent }: { agent: TopPerformingAgent }) {
  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <div className="panel-title">Top performing agent</div>
        <div className="panel-sub">By success rate this period</div>
      </div>
      <div
        className="panel-body"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, var(--accent), #0ea5e9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {pct(agent.conversion_rate_pct)}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{agent.agent_name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          ₹{agent.cost_per_call_inr}/call · {agent.roi_multiplier}× ROI multiplier
        </div>
      </div>
    </div>
  )
}

function EmptyChartOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: 'var(--ink-3)',
        fontSize: 13,
        textAlign: 'center',
        padding: '0 24px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 22, opacity: 0.3 }}>📊</div>
      <div>Insufficient data — once agents start running, this will populate.</div>
    </div>
  )
}

/* ── range toggle ───────────────────────────────────────── */

function RangeToggle({ current }: { current: AnalyticsRange }) {
  const router = useRouter()
  const ranges: AnalyticsRange[] = ['7d', '30d', '90d']
  const labels: Record<AnalyticsRange, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days' }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {ranges.map(r => (
        <button
          key={r}
          type="button"
          className={`btn sm${current === r ? ' primary' : ''}`}
          onClick={() => router.push(`/analytics?range=${r}`)}
        >
          {labels[r]}
        </button>
      ))}
    </div>
  )
}

/* ── main section ───────────────────────────────────────── */

export function AnalyticsSection({
  range,
  kpis,
  funnel,
  callsPerAgent,
  topAgent,
}: {
  range: AnalyticsRange
  kpis: AnalyticsKPIs
  funnel: AnalyticsFunnel
  callsPerAgent: CallsPerAgentPoint[]
  topAgent: TopPerformingAgent | null
}) {
  const hasData = funnel.clients > 0 || funnel.converted_to_lead > 0
  const hasChartData = callsPerAgent.some(
    p => p.matchmaker > 0 || p.follow_up > 0 || p.re_engager > 0 || p.guardian > 0 || p.voice > 0
  )
  const funnelMax = Math.max(funnel.clients, 1)

  const stripCells = [
    { label: 'Lead → Call', value: pct(kpis.lead_to_call_pct), delta: 'Contacts initiated' },
    { label: 'Call → Booking', value: pct(kpis.call_to_booking_pct), delta: 'Connected to booked' },
    { label: 'Booking → Close', value: pct(kpis.booking_to_close_pct), delta: 'Visit to conversion' },
    { label: 'Avg response', value: kpis.avg_response_min > 0 ? `${kpis.avg_response_min}m` : '—', delta: 'Lead → first call' },
    { label: 'Cost / lead', value: kpis.cost_per_lead_inr > 0 ? inr(kpis.cost_per_lead_inr) : '—', delta: 'Phase 12: real billing' },
    { label: 'Revenue (est)', value: kpis.revenue_inferred_inr > 0 ? inr(kpis.revenue_inferred_inr) : '—', delta: 'Inferred from bookings' },
  ]

  return (
    <section className="page active">
      <div className="crumb">Intelligence · Analytics</div>
      <div className="head">
        <div>
          <h1 className="title">Analytics</h1>
          <p className="sub">Conversion funnel, agent performance, and call volume over the selected period.</p>
        </div>
        <div className="actions">
          <RangeToggle current={range} />
        </div>
      </div>

      <StatStrip cells={stripCells} />

      {/* 2-col: funnel + top agent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>
        {/* Funnel panel */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Conversion funnel</div>
              <div className="panel-sub">Drop-off at each pipeline stage</div>
            </div>
          </div>
          <div className="panel-body">
            {hasData ? (
              FUNNEL_ITEMS.map(item => (
                <FunnelBar
                  key={item.key}
                  label={item.label}
                  value={funnel[item.key]}
                  max={funnelMax}
                />
              ))
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                No funnel data yet for this period. Agents need to run first.
              </div>
            )}
          </div>
        </div>

        {/* Top agent */}
        {topAgent ? (
          <TopAgentCard agent={topAgent} />
        ) : (
          <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: 24 }}>
              No agent runs found yet for this period.
            </div>
          </div>
        )}
      </div>

      {/* Full-width line chart */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Calls per agent</div>
            <div className="panel-sub">Daily execution volume by agent</div>
          </div>
        </div>
        <div className="panel-body" style={{ position: 'relative', minHeight: 280 }}>
          {!hasChartData && <EmptyChartOverlay />}
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={callsPerAgent} margin={{ left: -10, right: 20, top: 10, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--hairline)',
                  background: 'var(--surface)',
                  fontSize: 12,
                  color: 'var(--ink)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    matchmaker: 'Matchmaker',
                    follow_up: 'Follow-Up',
                    re_engager: 'Re-engager',
                    guardian: 'Guardian',
                    voice: 'Voice',
                  }
                  return labels[value] || value
                }}
              />
              <Line type="monotone" dataKey="matchmaker" stroke={LINE_COLORS.matchmaker} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="follow_up" stroke={LINE_COLORS.follow_up} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="re_engager" stroke={LINE_COLORS.re_engager} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="guardian" stroke={LINE_COLORS.guardian} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="voice" stroke={LINE_COLORS.voice} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

export default AnalyticsSection
