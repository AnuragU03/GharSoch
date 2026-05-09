'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded-[20px] border border-hairline bg-surface p-8 shadow-elev-1">
        <div className="mb-6 inline-flex rounded-full bg-warm-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-warm">
          Operations Center
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-6 text-ink-2">
          The Operations Center hit an unexpected error. We&apos;ve been notified.
        </p>
        <div className="mt-6">
          <button type="button" className="btn warm" onClick={reset}>
            Try again
          </button>
        </div>
        <details className="mt-6 rounded-[12px] border border-hairline bg-[var(--surface-2)] p-4 text-[13px] text-ink-2">
          <summary className="cursor-pointer font-medium text-ink">Error details</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-ink-2">
            {error.message}
          </pre>
        </details>
      </div>
    </div>
  )
}
