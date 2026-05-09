/**
 * app/welcome/page.tsx
 * Landing page for pending_approval users.
 * Shows their Google avatar + email + status + logout.
 */
import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getDefaultLanding } from '@/lib/auth/roles'
import type { UserRole } from '@/models/User'

export const metadata = {
  title: 'Account Pending — GharSoch',
  description: 'Your GharSoch account is pending approval',
}

export default async function WelcomePage() {
  const session = await auth()

  // Redirect if not signed in or status changed
  if (!session?.user) redirect('/auth/signin')
  if (session.user.status === 'suspended') redirect('/auth/suspended')
  if (session.user.status === 'active') {
    redirect(getDefaultLanding(session.user.role as UserRole))
  }

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
        <div style={{ textAlign: 'center' }}>
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
          {/* Avatar */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--hairline-strong)',
              background: 'var(--surface-2)',
              flexShrink: 0,
            }}
          >
            {image ? (
              <Image
                src={image}
                alt={name ?? 'User avatar'}
                width={64}
                height={64}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                }}
              >
                {(name ?? email ?? 'U')[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Status badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'var(--amber-soft)',
              border: '1px solid var(--amber)',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--amber)',
              letterSpacing: '0.02em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--amber)',
                display: 'inline-block',
              }}
            />
            Pending Approval
          </div>

          {/* Name + email */}
          <div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {name ?? 'Welcome'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '14px', color: 'var(--ink-3)' }}>
              {email}
            </div>
          </div>

          {/* Message */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
            }}
          >
            Your account has been created and is waiting for admin approval. You&apos;ll
            receive access once an admin reviews your sign-up.
            <br />
            <br />
            <span style={{ color: 'var(--ink-3)', fontSize: '13px' }}>
              Questions? Contact{' '}
              <a
                href="mailto:anurag.ugargol@gm.com"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                anurag.ugargol@gm.com
              </a>
            </span>
          </div>

          {/* Sign out */}
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/auth/signin' })
            }}
          >
            <button
              id="welcome-signout-btn"
              type="submit"
              style={{
                padding: '10px 24px',
                background: 'transparent',
                border: '1px solid var(--hairline-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--ink-2)',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
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
