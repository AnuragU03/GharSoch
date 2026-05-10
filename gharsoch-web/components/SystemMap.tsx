'use client'

import type { ComponentType } from 'react'
import { useState } from 'react'
import {
  Activity,
  Bot,
  BrainCircuit,
  Database,
  Radio,
  Workflow,
} from 'lucide-react'

import { getAgentVisual } from '@/lib/ui/agentVisuals'
import { cn } from '@/lib/utils'

export type SystemMapAgent = {
  id: string
  name: string
  triggerLabel: string
}

function FlowNode({
  title,
  description,
  icon: Icon,
  tone = 'border-hairline bg-surface-2/80 text-ink',
  onClick,
  active = false,
}: {
  title: string
  description: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  tone?: string
  onClick?: () => void
  active?: boolean
}) {
  const interactive = Boolean(onClick)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[108px] w-full flex-col justify-between rounded-2xl border px-4 py-4 text-left transition-all duration-150',
        interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'cursor-default',
        tone,
        active ? 'border-accent shadow-sm ring-1 ring-accent/25' : 'hover:border-accent/45',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Node</div>
          <div className="text-sm font-semibold text-ink">{title}</div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-ink shadow-sm">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-ink-2">{description}</p>
    </button>
  )
}

function Connector({
  vertical = false,
  live = false,
}: {
  vertical?: boolean
  live?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 rounded-full bg-ink/10',
        vertical ? 'mx-auto h-6 w-px' : 'h-px w-6',
        live ? 'bg-accent/45' : 'bg-ink/12',
      )}
    />
  )
}

export function SystemMap({
  agents,
  onNodeClick,
}: {
  agents: SystemMapAgent[]
  onNodeClick: (agentId: string) => void
}) {
  const [activeNode, setActiveNode] = useState<string | null>(null)

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">System map</div>
          <div className="panel-sub">Live data flow · click any agent node to view latest execution.</div>
        </div>
      </div>

      <div className="space-y-8 p-5 md:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.1fr)] lg:items-center">
          <div className="grid gap-3 md:grid-cols-2">
            <FlowNode
              title="Trigger"
              description="Cron jobs, event hooks, and Vapi tool calls enter the runtime here."
              icon={Activity}
              tone="border-hairline bg-surface text-ink shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            />
            <FlowNode
              title="Orchestrator"
              description="Semantic Kernel routes work, applies memory, and selects the right agent."
              icon={BrainCircuit}
              tone="border-accent/25 bg-accent/5 text-ink shadow-[0_10px_30px_rgba(189,102,44,0.10)]"
            />
          </div>

          <div className="hidden justify-center lg:flex">
            <Connector live />
          </div>

          <div className="rounded-3xl border border-hairline bg-surface-2/50 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">Agent fleet</div>
                <div className="text-sm text-ink-2">Clickable worker nodes with live execution drill-down.</div>
              </div>
              <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink-3">
                {agents.length} agents
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const visual = getAgentVisual(agent.id)
                const Icon = visual.icon || Bot

                return (
                  <FlowNode
                    key={agent.id}
                    title={agent.name}
                    description={agent.triggerLabel}
                    icon={Icon}
                    tone="border-hairline bg-surface text-ink shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
                    active={activeNode === agent.id}
                    onClick={() => {
                      setActiveNode(agent.id)
                      onNodeClick(agent.id)
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <FlowNode
            title="Plugin layer"
            description="OpenAI, Vapi, Mongo, and the knowledge base provide execution context."
            icon={Workflow}
            tone="border-hairline bg-surface text-ink shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          />
          <Connector live={false} />
          <FlowNode
            title="Lead update"
            description="State, transcripts, and history get written back into the operating record."
            icon={Database}
            tone="border-hairline bg-surface text-ink shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          />
          <Connector live />
          <FlowNode
            title="Broadcast"
            description="Fresh events stream back into Ops Center and the live activity surfaces."
            icon={Radio}
            tone="border-accent/20 bg-accent/5 text-ink shadow-[0_10px_30px_rgba(189,102,44,0.08)]"
          />
        </div>
      </div>
    </div>
  )
}
