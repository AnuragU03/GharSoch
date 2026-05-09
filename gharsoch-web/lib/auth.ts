/**
 * lib/auth.ts — GharSoch Auth (NextAuth.js v5 / Auth.js)
 *
 * Exports:
 *   auth            — universal session accessor (server components, route handlers, middleware, actions)
 *   signIn, signOut — re-exported for client components
 *   requireSession  — throws 401 if no valid active session
 *   requireRole     — throws 403 if session role not in allowed list
 *   authConfig      — base config (imported by middleware without DB deps)
 *
 * Design decisions (from Phase 11 design doc):
 *   - JWT strategy: zero extra Cosmos RU per request; role/status embedded in token
 *   - No MongoDB adapter for session storage: user lifecycle managed manually in signIn callback
 *   - DB revalidation on every jwt() call (token refresh window handles stale state)
 *   - Hardcoded admin bootstrap: BOOTSTRAP_ADMIN_EMAIL env var → role='admin', status='active' on first login
 *
 * NOTE on cron-triggered agent runs:
 *   Cron routes (/api/cron/*) are secured by x-cron-secret, NOT by session.
 *   They run on system behalf, not on behalf of any user.
 *   A suspended user does NOT affect cron execution.
 */

import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { getCollection } from '@/lib/mongodb'
import { getDefaultLanding } from '@/lib/auth/roles'
import type { UserRole, UserStatus } from '@/models/User'

// ─── Auth.js configuration ───────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24h

  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },

  callbacks: {
    /**
     * signIn: runs after Google OAuth succeeds, before the session is created.
     * - Creates user doc on first login with bootstrap-admin logic
     * - Blocks suspended users at the OAuth boundary
     * - Allows pending_approval users through (middleware will redirect them to /welcome)
     */
    async signIn({ user }) {
      if (!user.email) return false

      try {
        const users = await getCollection('users')
        const existing = await users.findOne({ email: user.email })

        if (!existing) {
          const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL
          const isBootstrapAdmin =
            bootstrapAdminEmail && user.email === bootstrapAdminEmail

          await users.insertOne({
            email: user.email,
            name: user.name ?? '',
            image: user.image ?? null,
            role: (isBootstrapAdmin ? 'admin' : 'broker') as UserRole,
            status: (isBootstrapAdmin ? 'active' : 'pending_approval') as UserStatus,
            brokerage_id: null,
            created_at: new Date(),
            last_login_at: new Date(),
            promoted_by_user_id: null,
            promoted_at: null,
          })

          return true
        }

        // Suspended users cannot sign in at all
        if (existing.status === 'suspended') return false

        // Update last login + refresh avatar
        await users.updateOne(
          { email: user.email },
          { $set: { last_login_at: new Date(), image: user.image ?? existing.image } }
        )

        return true
      } catch (err) {
        console.error('[auth] signIn DB error:', err)
        // If DB is unreachable, fail closed — do not allow login without a verified user record
        return false
      }
    },

    /**
     * jwt: called when the JWT is created or refreshed.
     * Injects role, status, brokerage_id from DB into the token.
     * The `trigger` field tells us when a forced refresh happens (e.g. after user management actions).
     */
    async jwt({ token, trigger }) {
      // Always re-read from DB on initial sign-in and on explicit session updates
      if (trigger === 'signIn' || trigger === 'update' || !token.role) {
        try {
          const users = await getCollection('users')
          const dbUser = await users.findOne({ email: token.email as string })
          if (dbUser) {
            token.role = dbUser.role
            token.status = dbUser.status
            token.brokerage_id = dbUser.brokerage_id?.toString() ?? null
            token.dbId = dbUser._id.toString()
          }
        } catch (err) {
          console.error('[auth] jwt DB revalidation error:', err)
          // Keep stale token values — better than logging the user out due to a transient DB error
        }
      }
      return token
    },

    /**
     * session: shapes the Session object available to consumers.
     * Adds GharSoch-specific fields (role, status, brokerage_id) to session.user.
     */
    async session({ session, token }) {
      session.user.id = token.dbId as string
      session.user.role = token.role as UserRole
      session.user.status = token.status as UserStatus
      session.user.brokerage_id = (token.brokerage_id as string) ?? null
      return session
    },

    /**
     * authorized: used by the middleware export to decide if a request is allowed.
     * Actual redirect logic is in middleware.ts — this just gates on token existence.
     */
    authorized({ auth: session }) {
      return !!session?.user
    },
  },
}

// ─── Auth.js v5 handler (all-in-one) ─────────────────────────────────────────

export const { auth, signIn, signOut, handlers } = NextAuth(authConfig)

// ─── Server-side guards ───────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * requireSession — throws AuthError(401) if unauthenticated or account is not active.
 * Use in server actions and GET API routes.
 *
 * NOTE: does NOT block pending_approval users from reading data —
 * middleware already redirects them to /welcome before they can call anything.
 * The guard is a server-side safety net.
 */
export async function requireSession() {
  const session = await auth()

  if (!session?.user) {
    throw new AuthError('Unauthorized — no valid session', 401)
  }

  if (session.user.status === 'suspended') {
    throw new AuthError('Account suspended', 403)
  }

  return session
}

/**
 * requireRole — throws AuthError(403) if the session user's role is not in the allowed list.
 * Always calls requireSession() first, so it covers the unauthenticated case too.
 *
 * Usage:
 *   await requireRole(['admin'])              — admin-only
 *   await requireRole(['admin', 'tech'])      — admin or tech
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireSession()

  if (!allowedRoles.includes(session.user.role as UserRole)) {
    throw new AuthError(
      `Insufficient permissions — requires one of: ${allowedRoles.join(', ')}`,
      403
    )
  }

  return session
}
