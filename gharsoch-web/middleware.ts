import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const ADMIN_ONLY_ROUTES = ['/ai-operations', '/agent-activity', '/settings/users']

export default auth((req) => {
  const token = req.auth?.user
  const pathname = req.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api/')

  // 1. No token = unauthenticated
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'NO_SESSION' },
        { status: 401 }
      )
    }

    const signInUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signInUrl)
  }

  // 2. Suspended users get a branded page in the UI and JSON for APIs.
  if (token.status === 'suspended' && !pathname.startsWith('/auth/suspended')) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      )
    }

    const suspendedUrl = new URL('/auth/suspended', req.nextUrl.origin)
    return NextResponse.redirect(suspendedUrl)
  }

  // 3. Pending approval users get the welcome page in the UI and JSON for APIs.
  if (token.status === 'pending_approval' && pathname !== '/welcome') {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'PENDING_APPROVAL' },
        { status: 403 }
      )
    }

    const welcomeUrl = new URL('/welcome', req.nextUrl.origin)
    return NextResponse.redirect(welcomeUrl)
  }

  // 4. Role-based route gating
  const role = token.role

  if (role === 'broker' && ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route))) {
    const leadsUrl = new URL('/leads', req.nextUrl.origin)
    return NextResponse.redirect(leadsUrl)
  }

  if (role === 'tech' && pathname.startsWith('/settings/users')) {
    const rootUrl = new URL('/', req.nextUrl.origin)
    return NextResponse.redirect(rootUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /api/auth/*      (NextAuth endpoints)
     * - /api/cron/*      (secured by x-cron-secret)
     * - /api/vapi/*      (secured by Vapi signature in Phase 12)
     * - /api/health      (public health check)
     * - /auth/*          (signin/signup pages)
     * - /_next/*         (Next.js internals)
     * - /favicon.ico, /robots.txt, etc.
     */
    '/((?!api/auth|api/cron|api/vapi|api/health|auth/signin|_next|favicon.ico|robots.txt).*)',
  ],
}
