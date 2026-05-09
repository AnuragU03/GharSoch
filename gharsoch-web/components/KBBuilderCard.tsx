'use client'

import type { BuilderListItem } from '@/lib/builderKBService'

function reputationColor(score: number) {
  if (score >= 80) return { bar: 'var(--green)', label: 'var(--green)' }
  if (score >= 60) return { bar: 'var(--amber)', label: 'var(--amber)' }
  return { bar: 'var(--red)', label: 'var(--red)' }
}

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

export function KBBuilderCard({
  builder,
  onClick,
}: {
  builder: BuilderListItem
  onClick: () => void
}) {
  const initial = (builder.builder_name || '?').charAt(0).toUpperCase()
  const colors = reputationColor(builder.reputation_score)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--hairline-strong)'
        el.style.boxShadow = 'var(--shadow-1)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--hairline)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #f5e6ca, #e8c89a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--warm)',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {builder.builder_name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {[builder.region, `${builder.project_count} projects`, `${builder.document_count} docs`]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* Reputation bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Reputation
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.label }}>
            {builder.reputation_score}/100
          </div>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${builder.reputation_score}%`,
              background: colors.bar,
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Last queried {relativeTime(builder.last_queried_at)}</span>
        <span>{builder.queries_24h} queries today</span>
      </div>
    </div>
  )
}
