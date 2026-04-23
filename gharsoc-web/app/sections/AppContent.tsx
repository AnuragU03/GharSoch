'use client'

import React, { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import Sidebar, { type ScreenId } from './Sidebar'
import DashboardSection from './DashboardSection'
import AgentStatusSection from './AgentStatusSection'
import LeadPipelineSection from './LeadPipelineSection'
import CallActivitySection from './CallActivitySection'
import CampaignsSection from './CampaignsSection'
import AffordabilitySection from './AffordabilitySection'
import CallCentreSection from './CallCentreSection'
import HomeTruthSection from './HomeTruthSection'
import SettingsSection from './SettingsSection'

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

const SCREEN_TITLES: Record<ScreenId, string> = {
  dashboard: 'Dashboard Overview',
  callcentre: 'Call Centre',
  hometruth: 'HomeTruth',
  agents: 'Agent Status',
  leads: 'Lead Pipeline',
  calls: 'Call Activity',
  campaigns: 'Campaigns',
  affordability: 'Affordability Tool',
  settings: 'Settings',
}

const AGENT_INFO = [
  { id: '69e8f73cd8820b5d0188ed99', name: 'Voice Orchestrator' },
  { id: '69e8f707f89cad5d4b752d22', name: 'Lead Qualifier' },
  { id: '69e8f7086aa016932b1c1a83', name: 'Financial Advisor' },
  { id: '69e8f709d2531e39b8b15889', name: 'Property Search' },
  { id: '69e8f71ed8820b5d0188ed95', name: 'Calendar' },
  { id: '69e8f709f89cad5d4b752d24', name: 'Post-Call Sync' },
  { id: '69e8f70a86926aed0100ba92', name: 'Re-engagement' },
  { id: '69e8f709f89cad5d4b752d26', name: 'Self-Service' },
]

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Try again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AppContent() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard')
  const [sampleMode, setSampleMode] = useState(true)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardSection sampleMode={sampleMode} onNavigate={(s) => setActiveScreen(s as ScreenId)} />
      case 'callcentre':
        return <CallCentreSection sampleMode={sampleMode} />
      case 'hometruth':
        return <HomeTruthSection sampleMode={sampleMode} activeAgentId={activeAgentId} setActiveAgentId={setActiveAgentId} />
      case 'agents':
        return <AgentStatusSection sampleMode={sampleMode} />
      case 'leads':
        return <LeadPipelineSection sampleMode={sampleMode} />
      case 'calls':
        return <CallActivitySection sampleMode={sampleMode} />
      case 'campaigns':
        return <CampaignsSection sampleMode={sampleMode} />
      case 'affordability':
        return <AffordabilitySection />
      case 'settings':
        return <SettingsSection />
      default:
        return <DashboardSection sampleMode={sampleMode} onNavigate={(s) => setActiveScreen(s as ScreenId)} />
    }
  }

  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground flex">
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <header className="flex-shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
              {SCREEN_TITLES[activeScreen] || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sample Data</span>
                <Switch checked={sampleMode} onCheckedChange={setSampleMode} />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {renderScreen()}
          </main>

          <footer className="flex-shrink-0 border-t border-border bg-card px-5 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Agent Status</p>
              <div className="flex items-center gap-3 flex-wrap">
                {AGENT_INFO.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${activeAgentId === a.id ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/25'}`} />
                    <span className="text-[10px] font-medium text-muted-foreground">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}
