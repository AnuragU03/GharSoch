'use client'

import { useState, useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { HydrationGuard } from '@/components/HydrationGuard'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // SessionProvider must be rendered during SSR to avoid useSession() hooks breaking the build
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
