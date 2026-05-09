'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { toast } from '@/lib/toast'
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
  Megaphone,
  PhoneCall,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'

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

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

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
  pathname: string
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

export function SidebarClient({ counts }: { counts: { leads: number; clients: number; appointments: number } }) {
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

        <button
          type="button"
          className="user w-full text-left"
          onClick={() => toast('Account menu coming in Phase 11')}
        >
          <div className="avatar">AU</div>
          <div className="user-copy">
            <div className="user-name">Anurag Ugargol</div>
            <div className="user-role">Admin {'\u00B7'} Production</div>
          </div>
          <ChevronUp size={14} strokeWidth={1.75} className="user-chevron shrink-0" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
