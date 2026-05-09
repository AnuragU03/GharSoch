export function SystemMap() {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">System map</div>
          <div className="panel-sub">Live data flow · edges flash when traffic moves.</div>
        </div>
      </div>

      <div className="map-wrap">
        <div className="map">
          <div className="node live">
            <b>Trigger</b>
            Cron · Event · Vapi tool
          </div>
          <div className="arrow-h live"></div>
          <div className="node live">
            <b>Orchestrator</b>
            Semantic Kernel · per-lead memory
          </div>
          <div className="arrow-h live"></div>
          <div className="node">
            <b>Agent</b>
            Matchmaker · Follow-Up · Voice · …
          </div>
        </div>

        <div className="map" style={{ marginTop: '14px' }}>
          <div className="node">
            <b>Plugin</b>
            OpenAI · Vapi · Mongo · KB
          </div>
          <div className="arrow-h"></div>
          <div className="node">
            <b>Lead update</b>
            state · history · transcript
          </div>
          <div className="arrow-h live"></div>
          <div className="node live">
            <b>Broadcast</b>
            SSE → Ops Center UI
          </div>
        </div>
      </div>
    </div>
  )
}
