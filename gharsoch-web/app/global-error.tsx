'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg, #fcf7ef)',
          color: 'var(--ink, #1f2937)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '520px',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--hairline, #e7decf)',
            borderRadius: '18px',
            boxShadow: 'var(--shadow-1, 0 1px 2px rgba(60,40,10,0.04), 0 8px 24px rgba(60,40,10,0.05))',
            padding: '28px',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: '10px' }}>
            Something went wrong
          </div>
          <p style={{ margin: '0 0 16px', color: 'var(--ink-3, #7a6d5d)', lineHeight: 1.6 }}>
            The Operations Center hit an unexpected error. We&apos;ve been notified.
          </p>
          <details style={{ marginBottom: '18px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Error details</summary>
            <pre
              style={{
                marginTop: '12px',
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--surface-2, #f7f1e7)',
                border: '1px solid var(--hairline, #e7decf)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '12px',
              }}
            >
              {error.message}
            </pre>
          </details>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 'none',
              borderRadius: '10px',
              background: 'var(--accent, #d4541f)',
              color: '#fff',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
