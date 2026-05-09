'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronUp,
  CircleHelp,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Megaphone,
  PhoneCall,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/models/User'

type NavIcon = LucideIcon

type NavItem = {
  href: string
  label: string
  icon: NavIcon
  badgeKey?: 'leads' | 'clients' | 'appointments'
}

const WORK: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads Pipeline', icon: ListFilter, badgeKey: 'leads' },
  { href: '/clients', label: 'Clients', icon: Users, badgeKey: 'clients' },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/appointments', label: 'Appointments', icon: CalendarClock, badgeKey: 'appointments' },
  { href: '/calls', label: 'Call Logs', icon: PhoneCall },
]

const INTELLIGENCE: NavItem[] = [
  { href: '/ai-operations', label: 'AI Operations', icon: Sparkles },
  { href: '/agent-activity', label: 'Agent Activity', icon: Activity },
  { href: '/kb', label: 'Knowledge Base', icon: BookOpen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  broker: 'Broker',
  tech: 'Tech',
}

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavGroup({
  label,
  items,
  pathname,
  counts,
}: {
  label: string
  items: NavItem[]
  pathname: string | null
  counts: { leads: number; clients: number; appointments: number }
}) {
  return (
    <div className="nav-group">
      <div className="nav-label">{label}</div>
      {items.map((item) => {
        const isActive = isActivePath(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn('nav-item', isActive && 'active')}
          >
            <Icon size={16} strokeWidth={1.75} className="ico shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.badgeKey && counts[item.badgeKey] > 0 && (
              <span className="badge">{counts[item.badgeKey]}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

// ─── User pill avatar ─────────────────────────────────────────────────────────

function UserAvatar({ name, image }: { name?: string | null; image?: string | null }) {
  const initials = (name ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? 'User avatar'}
        className="avatar"
        style={{ objectFit: 'cover', borderRadius: '50%', width: 32, height: 32 }}
      />
    )
  }

  return <div className="avatar">{initials}</div>
}

// ─── SidebarClient ────────────────────────────────────────────────────────────

type SidebarUser = {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: UserRole | null
  status?: string | null
}

export function SidebarClient({
  counts,
  user,
}: {
  counts: { leads: number; clients: number; appointments: number }
  user: SidebarUser | null
}) {
  const pathname = usePathname()
  const settingsActive = isActivePath(pathname, '/settings')
  const helpActive = isActivePath(pathname, '/help')
  const [shortcut, setShortcut] = useState('\u2318K')

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent
    setShortcut(/mac|iphone|ipad|ipod/i.test(platform) ? '\u2318K' : 'Ctrl+K')
  }, [])

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('open-command-palette'))
  }

  const displayName = user?.name ?? user?.email ?? 'User'
  const role = user?.role ?? ''
  const displayRole = role ? (ROLE_LABEL[role] ?? role) : 'Guest'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">G</div>
        <div>
          <div className="brand-name">GharSoch</div>
          <div className="brand-sub">Operations Center</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <NavGroup label="Work" items={WORK} pathname={pathname} counts={counts} />
        <div className="nav-divider" aria-hidden="true" />
        <NavGroup label="Intelligence" items={INTELLIGENCE} pathname={pathname} counts={counts} />
      </div>

      <div className="sidebar-footer">
        <div className="nav-mini">
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            aria-current={settingsActive ? 'page' : undefined}
            className={cn('nav-mini-item', settingsActive && 'active')}
          >
            <Settings size={15} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          </Link>
          <button
            type="button"
            aria-label="Command palette"
            title={`Command palette (${shortcut})`}
            className="nav-mini-item"
            onClick={openCommandPalette}
          >
            <kbd className="kbd-chip">{shortcut}</kbd>
          </button>
          <Link
            href="/help"
            aria-label="Help"
            title="Help"
            aria-current={helpActive ? 'page' : undefined}
            className={cn('nav-mini-item', helpActive && 'active')}
          >
            <CircleHelp size={15} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          </Link>
        </div>

        {/* ─── User pill with dropdown ─── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id="user-pill-trigger"
              className="user w-full text-left"
              aria-label="Account menu"
            >
              <UserAvatar name={user?.name} image={user?.image} />
              <div className="user-copy">
                <div className="user-name">{displayName}</div>
                <div className="user-role">{displayRole} · Production</div>
              </div>
              <ChevronUp size={14} strokeWidth={1.75} className="user-chevron shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-56"
          >
            {/* Identity header */}
            <div className="px-3 py-2">
              <div className="text-xs font-medium text-[var(--ink)] truncate">{displayName}</div>
              {user?.email && (
                <div className="text-xs text-[var(--ink-3)] truncate mt-0.5">{user.email}</div>
              )}
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                id="account-settings-link"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings size={14} strokeWidth={1.75} />
                Account settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              id="signout-btn"
              className="flex items-center gap-2 cursor-pointer text-[var(--red)] focus:text-[var(--red)]"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            >
              <LogOut size={14} strokeWidth={1.75} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
