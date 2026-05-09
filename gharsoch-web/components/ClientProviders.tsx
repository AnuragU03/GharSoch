'use client'

import { useState, useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { HydrationGuard } from '@/components/HydrationGuard'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // During SSR/prerendering, render children directly without providers
  if (!mounted) return <>{children}</>

  return (
    <SessionProvider>
      <ErrorBoundary>
        <HydrationGuard>
          {children}
        </HydrationGuard>
      </ErrorBoundary>
    </SessionProvider>
  )
}
