'use client'

import React, { useState } from 'react'
import Sidebar, { type ScreenId } from './Sidebar'
import DashboardSection from './DashboardSection'
import LeadsSection from './LeadsSection'
import PropertiesSection from './PropertiesSection'
import AppointmentsSection from './AppointmentsSection'
import CallLogsSection from './CallLogsSection'
import CampaignsSection from './CampaignsSection'
import AnalyticsSection from './AnalyticsSection'
import SettingsSection from './SettingsSection'
import AgentActivitySection from './AgentActivitySection'
import ClientsSection from './ClientsSection'
import { VoiceSessionProvider, useVoice } from './VoiceSessionProvider'

const SCREEN_TITLES: Record<ScreenId, string> = {
  dashboard: 'Dashboard Overview',
  leads: 'Lead Pipeline',
  clients: 'Client Prospects',
  properties: 'Property Listings',
  appointments: 'Appointments & Viewings',
  calls: 'Call Activity Logs',
  campaigns: 'Outbound Campaigns',
  agent_ops: 'AI Operations Center',
  analytics: 'Analytics & Performance',
  settings: 'System Settings',
}

const THEME_VARS = {
  '--background': '30 15% 97%',
  '--foreground': '20 15% 12%',
  '--card': '0 0% 100%',
  '--card-foreground': '20 15% 12%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '20 15% 12%',
  '--primary': '25 70% 45%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '30 12% 92%',
  '--secondary-foreground': '20 15% 20%',
  '--accent': '30 12% 92%',
  '--accent-foreground': '20 15% 20%',
  '--destructive': '0 65% 52%',
  '--destructive-foreground': '0 0% 100%',
  '--muted': '30 12% 92%',
  '--muted-foreground': '20 8% 50%',
  '--border': '30 15% 88%',
  '--input': '30 15% 88%',
  '--ring': '25 70% 45%',
  '--radius': '0.5rem',
} as React.CSSProperties

function AppLayout() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard')
  const { isCallActive, endCall } = useVoice()

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardSection onNavigate={(s) => setActiveScreen(s as ScreenId)} />
      case 'leads': return <LeadsSection />
      case 'clients': return <ClientsSection />
      case 'properties': return <PropertiesSection />
      case 'appointments': return <AppointmentsSection />
      case 'calls': return <CallLogsSection />
      case 'campaigns': return <CampaignsSection />
      case 'agent_ops': return <AgentActivitySection />
      case 'analytics': return <AnalyticsSection />
      case 'settings': return <SettingsSection />
      default: return <DashboardSection onNavigate={(s) => setActiveScreen(s as ScreenId)} />
    }
  }

  return (
    <div style={THEME_VARS} className="min-h-screen bg-background text-foreground flex font-sans selection:bg-primary/20">
      <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        <header className="flex-shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
            {SCREEN_TITLES[activeScreen] || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-medium bg-muted px-2 py-1 rounded-md text-muted-foreground tracking-wide uppercase">
              Production Mode
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative z-0">
          {renderScreen()}
        </main>

        {/* Live Call Active Modal/Banner */}
        {isCallActive && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-in slide-in-from-top-4">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="text-sm font-medium">Live Browser Call Active</span>
            <button 
              onClick={endCall}
              className="ml-2 bg-white/20 hover:bg-white/30 text-white text-xs px-2 py-1 rounded transition-colors"
            >
              End Call
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AppContent() {
  return (
    <VoiceSessionProvider>
      <AppLayout />
    </VoiceSessionProvider>
  )
}
