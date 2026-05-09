import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const ADMIN_ONLY_ROUTES = ['/ai-operations', '/agent-activity', '/settings/users']

export default auth((req) => {
  const token = req.auth?.user
  const pathname = req.nextUrl.pathname

  // 1. No token = unauthenticated
  if (!token) {
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin)
    return NextResponse.redirect(signInUrl)
  }

  // 2. Suspended → force to signin with error
  if (token.status === 'suspended' && !pathname.startsWith('/auth/suspended')) {
    const suspendedUrl = new URL('/auth/suspended', req.nextUrl.origin)
    return NextResponse.redirect(suspendedUrl)
  }

  // 3. Pending approval → force to /welcome
  if (token.status === 'pending_approval' && pathname !== '/welcome') {
    const welcomeUrl = new URL('/welcome', req.nextUrl.origin)
    return NextResponse.redirect(welcomeUrl)
  }

  // 4. Role-based route gating
  const role = token.role

  if (role === 'broker' && ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
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
     * - /auth/*          (signin/signup pages)
     * - /_next/*         (Next.js internals)
     * - /favicon.ico, /robots.txt, etc.
     */
    '/((?!api/auth|api/cron|api/vapi|auth/signin|_next|favicon.ico|robots.txt).*)',
  ],
}
