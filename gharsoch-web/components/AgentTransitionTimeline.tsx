'use client'

import { formatDistanceToNowStrict } from 'date-fns'

export type AgentTransitionItem = {
  id: string
  label: string
  status: string
  timestamp: string
  description?: string
  details?: unknown
}

function toneForStatus(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('fail') || normalized.includes('error')) return '#d94b4b'
  if (normalized.includes('partial') || normalized.includes('warn')) return '#c98916'
  return '#2f9e66'
}

function offsetLabel(timestamp: string, baseTimestamp?: string) {
  const time = new Date(timestamp).getTime()
  const base = baseTimestamp ? new Date(baseTimestamp).getTime() : NaN

  if (Number.isFinite(time) && Number.isFinite(base)) {
    const seconds = Math.max(0, Math.round((time - base) / 1000))
    return `+${seconds}s`
  }

  return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true })
}

export function AgentTransitionTimeline({
  items,
  baseTimestamp,
  onSelect,
}: {
  items: AgentTransitionItem[]
  baseTimestamp?: string
  onSelect?: (item: AgentTransitionItem) => void
}) {
  if (items.length === 0) {
    return <div className="text-[13px] text-ink-3">No tool dispatches recorded for this call.</div>
  }

  return (
    <div className="relative">
      {items.map((item, index) => {
        const tone = toneForStatus(item.status)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item)}
            className="group relative grid w-full grid-cols-[24px_1fr_auto] gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-surface-2"
          >
            <span className="relative flex justify-center">
              {index < items.length - 1 ? (
                <span className="absolute top-4 h-[calc(100%+8px)] w-px bg-hairline" />
              ) : null}
              <span
                className="relative z-10 mt-0.5 h-4 w-4 rounded-full border-2 border-surface shadow-sm"
                style={{ backgroundColor: tone }}
              />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-ink">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{item.description}</span>
              ) : null}
            </span>
            <span className="pt-0.5 text-[11px] text-ink-3">{offsetLabel(item.timestamp, baseTimestamp)}</span>
          </button>
        )
      })}
    </div>
  )
}
