import { PlatformShortcut } from '@/components/HelpNav'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CAPABILITIES = [
  'Nine specialized AI agents qualify leads, match properties, protect appointments, and coordinate follow-ups.',
  'Real Vapi voice agents place outbound calls, handle inbound conversations, and write call reports back to GharSoch.',
  'Compliance controls support TRAI windows, DND safeguards, IST business hours, and audit-friendly execution logs.',
]

export default async function HelpPage() {
  await auth()
  return (
    <section className="page active">
      <div className="crumb">System / Help</div>
      <div className="head">
        <div>
          <h1 className="title">Help &amp; About</h1>
          <p className="sub">What GharSoch does for brokers, and how to get help fast when you need it.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">About GharSoch</div>
              <div className="panel-sub">Autonomous AI sales workspace for Indian real estate brokers.</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'grid', gap: 12, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            <p>
              GharSoch helps brokers run a modern real estate sales desk from one operations center: leads, clients,
              properties, appointments, campaigns, calls, AI runs, and production health all stay connected.
            </p>
            <p>
              It is built for broker teams that want one place to manage outreach, follow-up, appointment handling,
              and visibility into what the AI fleet is doing across the day.
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

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Need help?</div>
              <div className="panel-sub">Minimal support path for the production workspace.</div>
            </div>
          </div>
          <div className="panel-body" style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            Need help? Email <a href="mailto:anuragugargol@gmail.com">anuragugargol@gmail.com</a> or press{' '}
            <kbd className="kbd-chip"><PlatformShortcut /></kbd> for the command palette.
          </div>
        </div>
      </div>
    </section>
  )
}
