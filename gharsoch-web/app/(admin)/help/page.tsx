import { PlatformShortcut } from '@/components/HelpNav'

export const dynamic = 'force-static'

const CAPABILITIES = [
  'Nine specialized AI agents qualify leads, match properties, protect appointments, and coordinate follow-ups.',
  'Real Vapi voice agents place outbound calls, handle inbound conversations, and write call reports back to GharSoch.',
  'Compliance controls support TRAI windows, DND safeguards, IST business hours, and audit-friendly execution logs.',
]

const STACK = ['Next.js 14', 'Auth.js v5', 'MongoDB Atlas', 'Vapi', 'OpenAI']

export default function HelpPage() {
  return (
    <section className="page active">
      <div className="crumb">System · Help</div>
      <div className="head">
        <div>
          <h1 className="title">Help &amp; About</h1>
          <p className="sub">Plan details, product context, and practical support for the production workspace.</p>
        </div>
        <div className="actions">
          <a className="btn" href="mailto:anuragugargol@gmail.com">Contact Anurag</a>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">About GharSoch</div>
              <div className="panel-sub">Autonomous AI sales workforce for Indian real estate brokers.</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            <p>
              GharSoch helps brokers run a modern real estate sales desk from one operations center: leads, clients,
              properties, appointments, campaigns, calls, AI runs, and production health all stay connected.
            </p>
            <p>
              Built by Anurag Ugargol (<a href="mailto:anuragugargol@gmail.com">anuragugargol@gmail.com</a>) and deployed
              at <a href="https://gharsoch.tech">gharsoch.tech</a>.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">What it does</div>
              <div className="panel-sub">From lead intake to voice follow-up, with every step traceable.</div>
            </div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {CAPABILITIES.map((item) => (
                <div
                  key={item}
                  style={{
                    border: '1px solid var(--hairline)',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    padding: 14,
                    color: 'var(--ink-2)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Your Plan</div>
                <div className="panel-sub">Current production workspace status.</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    <tr><td>Plan</td><td><strong>Solo Broker</strong></td></tr>
                    <tr><td>Status</td><td><strong>Active</strong></td></tr>
                    <tr><td>Production deployed since</td><td>2026-05-09</td></tr>
                    <tr><td>Current phase</td><td>Phase 12-UI in progress</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Need help?</div>
                <div className="panel-sub">Fast paths when something feels off.</div>
              </div>
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
              <p>
                Press <kbd className="kbd-chip"><PlatformShortcut /></kbd> to open the command palette from anywhere in
                the admin shell.
              </p>
              <p>
                Email <a href="mailto:anuragugargol@gmail.com">anuragugargol@gmail.com</a> with the page URL, time in
                IST, and any visible run ID.
              </p>
              <p>Documentation is in progress and will expand as Phase 12 acceptance testing hardens the system.</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Tech stack</div>
              <div className="panel-sub">Small footprint, production-first building blocks.</div>
            </div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STACK.map((item) => (
                <span key={item} className="tag">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
