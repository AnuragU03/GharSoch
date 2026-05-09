'use client'

import { useSession } from 'next-auth/react'
import { VISIBILITY, type Role } from './roles'

const EMPTY_VISIBILITY = {
  nav: [],
  canForceRun: false,
  canViewReasoning: false,
  canViewCosts: false,
  canManageUsers: false,
  canManageSettings: false,
}

export function useUserRole() {
  let sessionState: ReturnType<typeof useSession> | null = null

  try {
    sessionState = useSession()
  } catch {
    sessionState = null
  }

  const session = sessionState?.data ?? null
  const status = sessionState?.status ?? 'unauthenticated'

  const isLoading = status === 'loading'
  const rawRole = session?.user?.role as Role | undefined
  const role = rawRole && rawRole in VISIBILITY ? rawRole : null
  const permissions = role ? VISIBILITY[role] : EMPTY_VISIBILITY
  const can = {
    ...permissions,
    forceRun: permissions.canForceRun,
    viewReasoning: permissions.canViewReasoning,
    viewCosts: permissions.canViewCosts,
    manageUsers: permissions.canManageUsers,
    manageSettings: permissions.canManageSettings,
  }

  return {
    role,
    can,
    isLoading,
    user: session?.user || null,
  }
}
