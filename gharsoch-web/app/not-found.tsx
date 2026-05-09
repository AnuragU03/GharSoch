import Link from 'next/link'

export const metadata = {
  title: '404 — Page Not Found · GharSoch',
}

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--ink)',
            margin: '16px 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--ink-3)',
            lineHeight: 1.6,
            margin: '0 0 28px',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          id="not-found-back-btn"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
