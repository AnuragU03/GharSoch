import React from 'react'

export type SystemMapAgent = {
  id: string
  name: string
  triggerLabel: string
}

export function SystemMap({
  agents,
  onNodeClick,
}: {
  agents: SystemMapAgent[]
  onNodeClick: (agentId: string) => void
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">System map</div>
          <div className="panel-sub">Live data flow · click any agent node to view latest execution.</div>
        </div>
      </div>

      <div className="map-wrap flex flex-col gap-8 p-4">
        {/* Core Orchestration Flow */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="node live min-w-[200px]">
            <b>Trigger</b>
            Cron · Event · Vapi tool
          </div>
          <div className="arrow-h live"></div>
          <div className="node live min-w-[200px]">
            <b>Orchestrator</b>
            Semantic Kernel · memory
          </div>
          <div className="arrow-h live hidden md:block"></div>
        </div>

        {/* Agent Fleet */}
        <div className="flex flex-col gap-4 ml-0 md:ml-[500px]">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-4">
              <div className="arrow-h w-8 hidden md:block"></div>
              <button 
                type="button" 
                className="node hover:border-accent hover:bg-surface-2 transition-all min-w-[250px] text-left cursor-pointer"
                onClick={() => onNodeClick(agent.id)}
              >
                <b>{agent.name}</b>
                {agent.triggerLabel}
              </button>
            </div>
          ))}
        </div>

        {/* Output Flow */}
        <div className="flex items-center gap-4 flex-wrap mt-4">
          <div className="node min-w-[200px]">
            <b>Plugin Layer</b>
            OpenAI · Vapi · Mongo · KB
          </div>
          <div className="arrow-h"></div>
          <div className="node min-w-[200px]">
            <b>Lead update</b>
            state · history · transcript
          </div>
          <div className="arrow-h live"></div>
          <div className="node live min-w-[200px]">
            <b>Broadcast</b>
            SSE → Ops Center UI
          </div>
        </div>
      </div>
    </div>
  )
}
