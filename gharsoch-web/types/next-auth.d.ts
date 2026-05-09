/**
 * next-auth.d.ts — Augments NextAuth session types with GharSoch-specific fields.
 * This file must be present for TypeScript to recognize session.user.role etc.
 */
import type { UserRole, UserStatus } from '@/models/User'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      status: UserStatus
      brokerage_id: string | null
    }
  }

  interface JWT {
    dbId?: string
    role?: UserRole
    status?: UserStatus
    brokerage_id?: string | null
  }
}
