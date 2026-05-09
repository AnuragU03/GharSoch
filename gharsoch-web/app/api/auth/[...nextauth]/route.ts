/**
 * app/api/auth/[...nextauth]/route.ts
 *
 * NextAuth v5 catch-all route handler.
 * Handles: /api/auth/signin, /api/auth/signout, /api/auth/callback/google,
 *          /api/auth/session, /api/auth/csrf, /api/auth/providers
 *
 * This route is intentionally excluded from middleware protection.
 */
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
