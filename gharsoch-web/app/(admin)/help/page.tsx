import { HelpNav, PlatformShortcut } from '@/components/HelpNav'

const AGENTS = [
  {
    name: 'The Matchmaker',
    purpose: 'Pairs qualified leads with live property inventory using preferences, score, and builder context.',
    fires: 'Event and scheduled sweeps.',
    lookFor: 'High match scores, Vapi call dispatches, and KB hits in the reasoning trace.',
  },
  {
    name: 'The Follow-Up Agent',
    purpose: 'Finds leads whose promised callback time has arrived and reopens the conversation.',
    fires: 'Hourly cron.',
    lookFor: 'Due follow-ups, DND skips, callback notes, and rescheduled outreach.',
  },
  {
    name: 'The Appointment Guardian',
    purpose: 'Protects site visits by confirming, rescheduling, or flagging appointments before they slip.',
    fires: 'Daily at 09:00 IST.',
    lookFor: 'Confirmed visits, reminder calls, and appointment state changes.',
  },
  {
    name: 'The Dead Lead Re-engager',
    purpose: 'Reactivates dormant leads using prior context instead of starting cold.',
    fires: 'Daily at 10:00 IST.',
    lookFor: 'Revived leads, softer outreach copy, and DNC decisions.',
  },
  {
    name: 'The Price-Drop Negotiator',
    purpose: 'Re-pitches buyers who objected on price when a matching property becomes cheaper.',
    fires: 'Property price-drop event.',
    lookFor: 'Old price vs new price, matched objections, and notified leads.',
  },
  {
    name: 'Client to Lead Converter',
    purpose: 'Turns raw client intake into a qualified lead or a rejected client with a reason.',
    fires: 'When a client is created.',
    lookFor: 'Lead score, rejection reason, and linked lead_id.',
  },
  {
    name: 'Campaign Conductor',
    purpose: 'Coordinates campaign launch state, targeting, and queued dialing batches.',
    fires: 'Campaign launch or campaign sweep.',
    lookFor: 'Queued campaigns, dial counters, paused states, and target lead counts.',
  },
  {
    name: 'Voice Orchestrator',
    purpose: 'Routes Vapi tool calls during live calls and records the call report afterwards.',
    fires: 'Vapi webhook events.',
    lookFor: 'Tool dispatch actions, call transcript, recording URL, and call status updates.',
  },
  {
    name: 'Builder Refiner',
    purpose: 'Keeps builder facts useful for matching by improving KB quality and reputation context.',
    fires: 'Manual or scheduled KB maintenance.',
    lookFor: 'Builder updates, reputation changes, and document/query references.',
  },
]

export const dynamic = 'force-static'

export default function HelpPage() {
  return (
    <section className="page active help-page">
      <div className="crumb">System · Help</div>
      <div className="head">
        <div>
          <h1 className="title">Help &amp; Documentation</h1>
          <p className="sub">A practical operating guide for GharSoch admins and production operators.</p>
        </div>
        <div className="actions">
          <a className="btn" href="mailto:support@gharsoch.tech">Contact support</a>
        </div>
      </div>

      <div className="help-layout">
        <HelpNav />

        <div className="help-content">
          <section id="getting-started" className="help-section">
            <h2>Getting started</h2>
            <p>
              GharSoch is an AI-assisted real estate operations center. It keeps leads, clients, properties, calls,
              campaigns, appointments, and agent activity in one admin workspace so the team can see what is happening
              without digging through separate tools.
            </p>
            <p>
              The system runs nine agents that handle qualification, matching, follow-up, site visit protection,
              price-drop outreach, campaign coordination, voice-call tool routing, and builder knowledge refinement.
              Every meaningful decision is written to the agent execution log with reasoning steps and actions.
            </p>
            <p>
              Day to day, start from the Operations Dashboard, inspect urgent leads, open recent agent runs when
              something looks unusual, and use AI Operations when you need the full trace behind a decision.
            </p>
          </section>

          <section id="agents" className="help-section">
            <h2>The 9 agents</h2>
            <div className="help-agent-grid">
              {AGENTS.map((agent) => (
                <article className="help-agent" key={agent.name}>
                  <h3>{agent.name}</h3>
                  <p>{agent.purpose}</p>
                  <div><b>Fires:</b> {agent.fires}</div>
                  <div><b>Watch:</b> {agent.lookFor}</div>
                </article>
              ))}
            </div>
          </section>

          <section id="dashboard" className="help-section">
            <h2>Reading the dashboard</h2>
            <p>
              The top stat strip shows today&apos;s operational pulse: calls made, appointments scheduled today, new
              leads, and agent runs. Deltas compare against yesterday in IST so morning and evening review use the same
              business day definition.
            </p>
            <p>
              Status colors follow the rest of the Operations Center: green means success or confirmed, amber means
              warm or needs attention soon, red means failed or rejected, violet highlights intelligence workflows, and
              muted grey means idle or pending.
            </p>
            <p>
              Recent agent activity opens the full reasoning drawer. Urgent leads navigate back to the pipeline with a
              focus parameter so operators can continue the work where the lead belongs.
            </p>
          </section>

          <section id="campaigns" className="help-section">
            <h2>Creating campaigns</h2>
            <ol>
              <li>Open Campaigns from the sidebar and choose New Campaign.</li>
              <li>Name the campaign, select a voice assistant, choose a script template, and set the date window.</li>
              <li>Enter the target lead filter in plain text. The current batch keeps this simple; a full filter builder arrives later.</li>
              <li>Save as draft when you need review, or launch to queue the campaign for the conductor workflow.</li>
            </ol>
            <div className="help-shot-grid">
              <div className="help-shot">Campaign form screenshot placeholder</div>
              <div className="help-shot">Active campaign progress screenshot placeholder</div>
            </div>
          </section>

          <section id="knowledge-base" className="help-section">
            <h2>Knowledge Base</h2>
            <p>
              The Knowledge Base tracks builders and the facts agents need during matching: regions, notable projects,
              reputation, delivery confidence, financing notes, and document coverage. Matchmaker and Builder Refiner use
              this data to explain why a builder or property is a good fit.
            </p>
            <p>
              Reputation scores are a compact operator signal, not a legal rating. Scores above 80 are strong, 60-80
              need normal review, and below 60 should be checked before an agent leans heavily on that builder.
            </p>
            <p>
              Use the KB page to see which builders are being queried, where coverage is thin, and which builder facts
              need fresh documents in a later document-upload phase.
            </p>
          </section>

          <section id="shortcuts" className="help-section">
            <h2>Keyboard shortcuts</h2>
            <table className="table">
              <thead><tr><th>Shortcut</th><th>Action</th><th>Where it works</th></tr></thead>
              <tbody>
                <tr>
                  <td><kbd className="kbd-chip"><PlatformShortcut /></kbd></td>
                  <td>Open the command palette</td>
                  <td>Anywhere in the admin shell</td>
                </tr>
                <tr>
                  <td><kbd className="kbd-chip">Esc</kbd></td>
                  <td>Close drawers, dialogs, and the command palette</td>
                  <td>When an overlay is open</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="troubleshooting" className="help-section">
            <h2>Troubleshooting</h2>
            <h3>Why is Matchmaker not firing?</h3>
            <p>Check that a qualified lead exists, at least one property is available, and the agent run route is not blocked by cron auth.</p>
            <h3>Why is my call summary failed?</h3>
            <p>Open the Voice Orchestrator run. Summary generation is non-blocking; failures usually come from an OpenAI timeout, invalid key, or malformed call report payload.</p>
            <h3>How do I trigger a manual run?</h3>
            <p>Open the command palette with <kbd className="kbd-chip"><PlatformShortcut /></kbd>, then choose the relevant Force Run action.</p>
          </section>

          <section id="support" className="help-section">
            <h2>Contact support</h2>
            <p>
              For production help, send the page URL, approximate time in IST, and any visible run_id to{' '}
              <a href="mailto:support@gharsoch.tech">support@gharsoch.tech</a>.
            </p>
          </section>
        </div>
      </div>
    </section>
  )
}
