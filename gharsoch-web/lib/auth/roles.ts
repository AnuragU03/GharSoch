export type Role = 'admin' | 'tech' | 'broker'

const BASE_NAV = [
  '/',
  '/leads',
  '/clients',
  '/properties',
  '/campaigns',
  '/appointments',
  '/calls',
  '/ai-operations',
  '/kb',
  '/analytics',
  '/settings',
]

const ADMIN_NAV = [...BASE_NAV, '/settings/users']

// Brokers cannot see AI Ops (full reasoning traces, system internals)
const BROKER_NAV = [
  '/',
  '/leads',
  '/clients',
  '/properties',
  '/campaigns',
  '/appointments',
  '/calls',
  '/kb',
  '/analytics',
  '/settings',
]

export const VISIBILITY: Record<
  Role,
  {
    nav: string[]
    canForceRun: boolean
    canViewReasoning: boolean
    canViewCosts: boolean
    canManageUsers: boolean
    canManageSettings: boolean
  }
> = {
  admin: {
    nav: ADMIN_NAV,
    canForceRun: true,
    canViewReasoning: true,
    canViewCosts: true,
    canManageUsers: true,
    canManageSettings: true,
  },
  tech: {
    nav: BASE_NAV,
    canForceRun: true,
    canViewReasoning: true,
    canViewCosts: true,
    canManageUsers: false,
    canManageSettings: true,
  },
  broker: {
    nav: BROKER_NAV,
    canForceRun: false,
    canViewReasoning: false,
    canViewCosts: false,
    canManageUsers: false,
    canManageSettings: false,
  },
}

export function getDefaultLanding(role: Role): string {
  switch (role) {
    case 'admin':
      return '/'
    case 'tech':
      return '/ai-operations'
    case 'broker':
      return '/leads'
  }
}
