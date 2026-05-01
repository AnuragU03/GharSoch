'use client'
import React, { useState } from 'react'
import { HiOutlineHome, HiOutlineUserGroup, HiOutlinePhone, HiOutlineCalendarDays, HiOutlineMegaphone, HiOutlineCog6Tooth, HiOutlineChartBar } from 'react-icons/hi2'
import { FiCommand } from 'react-icons/fi'

export type ScreenId = 'dashboard' | 'leads' | 'properties' | 'appointments' | 'calls' | 'campaigns' | 'analytics' | 'settings'

interface SidebarProps {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: HiOutlineHome },
  { id: 'leads', label: 'Leads Pipeline', icon: HiOutlineUserGroup },
  { id: 'properties', label: 'Properties', icon: HiOutlineHome },
  { id: 'appointments', label: 'Appointments', icon: HiOutlineCalendarDays },
  { id: 'calls', label: 'Call Logs', icon: HiOutlinePhone },
  { id: 'campaigns', label: 'Campaigns', icon: HiOutlineMegaphone },
  { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBar },
  { id: 'settings', label: 'Settings', icon: HiOutlineCog6Tooth },
] as const

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen overflow-hidden">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
          <FiCommand className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-none text-foreground tracking-tight">GharSoch</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-semibold">Voice Agent</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {item.label}
            </button>
          )
        })}
      </div>
      
      <div className="p-4 border-t border-border bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            GS
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Admin</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Agents Online
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
