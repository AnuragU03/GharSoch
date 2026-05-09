/**
 * app/auth/suspended/page.tsx
 * Suspended account page.
 * Shown when a user's status is 'suspended'.
 * Per Correction 3: dedicated route, clean signOut, admin contact.
 */
import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'

export const metadata = {
  title: 'Account Suspended — GharSoch',
  description: 'Your GharSoch account access has been suspended',
}

// ─── Suspended icon ───────────────────────────────────────────────────────────

function SuspendedIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="var(--red)" strokeWidth="1.5" />
      <path
        d="M10 10L22 22M22 10L10 22"
        stroke="var(--red)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SuspendedPage() {
  const session = await auth()

  // If they somehow aren't suspended anymore, redirect them out
  if (!session?.user) redirect('/auth/signin')
  if (session.user.status === 'active') redirect('/')
  if (session.user.status === 'pending_approval') redirect('/welcome')

  const { name, email, image } = session.user

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--ink)',
          }}
        >
          GharSoch
        </div>

        {/* Card */}
        <div
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--hairline-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-2)',
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            textAlign: 'center',
          }}
        >
          {/* Suspended icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--red-soft)',
              border: '1px solid var(--red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SuspendedIcon />
          </div>

          {/* Status badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'var(--red-soft)',
              border: '1px solid var(--red)',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--red)',
              letterSpacing: '0.02em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--red)',
                display: 'inline-block',
              }}
            />
            Account Suspended
          </div>

          {/* Identity */}
          {(name || email) && (
            <div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {name}
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--ink-3)' }}>
                {email}
              </div>
            </div>
          )}

          {/* Message */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--red-soft)',
              border: '1px solid rgba(163, 35, 25, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
            }}
          >
            Your account access has been suspended. Contact your admin to restore access.
            <br />
            <br />
            <a
              href="mailto:anurag.ugargol@gm.com"
              style={{
                color: 'var(--accent)',
                fontWeight: 500,
                textDecoration: 'none',
                fontSize: '13px',
              }}
            >
              anurag.ugargol@gm.com
            </a>
          </div>

          {/* Sign out — clears cookies cleanly */}
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/auth/signin' })
            }}
          >
            <button
              id="suspended-signout-btn"
              type="submit"
              style={{
                padding: '11px 28px',
                background: 'var(--red)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 500,
                color: '#ffffff',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: '0 1px 3px rgba(163,35,25,0.3)',
              }}
            >
              Sign out
            </button>
          </form>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>
          © {new Date().getFullYear()} GharSoch
        </div>
      </div>
    </div>
  )
}
