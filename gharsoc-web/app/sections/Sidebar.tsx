'use client'

import React from 'react'
import { HiOutlineSquares2X2, HiOutlineUsers, HiOutlinePhone, HiOutlineCog6Tooth, HiOutlineCalendarDays } from 'react-icons/hi2'
import { FiCpu, FiDollarSign, FiTarget, FiHome, FiPhoneCall } from 'react-icons/fi'
import { ScrollArea } from '@/components/ui/scroll-area'

export type ScreenId = 'dashboard' | 'callcentre' | 'hometruth' | 'agents' | 'leads' | 'calls' | 'campaigns' | 'affordability' | 'settings'

interface SidebarProps {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
}

const NAV_ITEMS: { id: ScreenId; label: string; icon: React.ElementType; priority?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: HiOutlineSquares2X2 },
  { id: 'affordability', label: 'GharSoch Tool', icon: FiDollarSign, priority: true },
  { id: 'campaigns', label: 'Campaigns', icon: FiTarget },
  { id: 'calls', label: 'Call Logs', icon: HiOutlinePhone },
  { id: 'leads', label: 'Lead Pipeline', icon: HiOutlineUsers },
  { id: 'agents', label: 'Agent Status', icon: FiCpu },
  { id: 'settings', label: 'Settings', icon: HiOutlineCog6Tooth },
]

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 min-h-screen flex flex-col flex-shrink-0" style={{ background: '#141118', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'hsl(25, 70%, 45%)' }}>
            <HiOutlineCalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight font-sans">GharSoch</h1>
            <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>RealVoice Agent Platform</p>
          </div>
        </div>
      </div>

      <div className="px-4 mb-1">
        <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: isActive ? 'hsl(25, 70%, 60%)' : 'rgba(255,255,255,0.5)',
                }}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
                {item.priority && !isActive && (
                  <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'hsl(25, 70%, 45%)', color: '#fff' }}>New</span>
                )}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(25, 70%, 55%)' }} />
                )}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 mx-3 mb-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-emerald-400">System Online</span>
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>8 agents operational</p>
      </div>
    </aside>
  )
}
