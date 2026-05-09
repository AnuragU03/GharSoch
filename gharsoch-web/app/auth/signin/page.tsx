/**
 * app/auth/signin/page.tsx
 * GharSoch sign-in page — warm-cream branded, Google OAuth only.
 * Server Component — no client-side event handlers.
 */
import { auth, signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDefaultLanding } from '@/lib/auth/roles'
import type { UserRole } from '@/models/User'

export const metadata = {
  title: 'Sign In — GharSoch',
  description: 'Sign in to your GharSoch account',
}

// ─── Google Icon SVG ─────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.22c1.89-1.74 2.99-4.3 2.99-7.31z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.97-.9 6.62-2.43l-3.22-2.5c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H1.07v2.58A10 10 0 0 0 10 20z"
        fill="#34A853"
      />
      <path
        d="M4.39 11.9A5.98 5.98 0 0 1 4.08 10c0-.66.11-1.3.31-1.9V5.52H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.48l3.32-2.58z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.97c1.47 0 2.79.5 3.83 1.5l2.86-2.86C14.96.9 12.7 0 10 0A10 10 0 0 0 1.07 5.52l3.32 2.58C5.18 5.73 7.39 3.97 10 3.97z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  // If already signed in, redirect to appropriate landing
  const session = await auth()
  if (session?.user) {
    const status = session.user.status
    if (status === 'suspended') redirect('/auth/suspended')
    if (status === 'pending_approval') redirect('/welcome')
    const role = session.user.role as UserRole
    redirect(getDefaultLanding(role))
  }

  const params = await searchParams
  const error = params.error
  const callbackUrl = params.callbackUrl ?? '/'

  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Could not connect to Google. Try again.',
    OAuthCallback: 'Google sign-in failed. Try again.',
    OAuthAccountNotLinked: 'This email is linked to another sign-in method.',
    Callback: 'Authentication error. Try again.',
    Default: 'Something went wrong. Try again.',
  }
  const errorMsg = error ? (errorMessages[error] ?? errorMessages.Default) : null

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
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
        }}
      >
        {/* ─── Wordmark ─── */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
              lineHeight: 1.1,
            }}
          >
            GharSoch
          </div>
          <div
            style={{
              marginTop: '6px',
              fontSize: '13px',
              color: 'var(--ink-3)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            AI-Powered Real Estate CRM
          </div>
        </div>

        {/* ─── Card ─── */}
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
            gap: '24px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Welcome back
            </h1>
            <p
              style={{
                marginTop: '8px',
                fontSize: '14px',
                color: 'var(--ink-3)',
                lineHeight: 1.5,
              }}
            >
              Sign in with your Google workspace account to continue.
            </p>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                background: 'var(--red-soft)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--red)',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Google Sign-in Form */}
          <style>{`
            .gs-signin-btn {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              padding: 14px 24px;
              background: var(--surface);
              border: 1px solid var(--hairline-strong);
              border-radius: var(--radius-md);
              font-size: 15px;
              font-weight: 500;
              color: var(--ink);
              cursor: pointer;
              transition: background 0.15s, box-shadow 0.15s;
              box-shadow: var(--shadow-1);
              letter-spacing: -0.01em;
              font-family: inherit;
            }
            .gs-signin-btn:hover {
              background: var(--surface-2);
            }
          `}</style>
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: callbackUrl })
            }}
          >
            <button
              id="google-signin-btn"
              type="submit"
              className="gs-signin-btn"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <div
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--ink-4)',
              lineHeight: 1.5,
            }}
          >
            Access is by invitation only.
            <br />
            New accounts are reviewed by an admin before activation.
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>
          © {new Date().getFullYear()} GharSoch. All rights reserved.
        </div>
      </div>
    </div>
  )
}
