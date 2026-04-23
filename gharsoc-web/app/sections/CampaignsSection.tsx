'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FiTarget, FiClock, FiRefreshCw } from 'react-icons/fi'
import { HiOutlinePlay } from 'react-icons/hi2'
import { listSchedules, pauseSchedule, resumeSchedule, triggerScheduleNow, getScheduleLogs, cronToHuman } from '@/lib/scheduler'

const SCHEDULE_ID = '69e8f71fe35ffb1f44a91e56'

interface CampaignsProps {
  sampleMode: boolean
}

const SAMPLE_CAMPAIGNS = [
  { id: '1', name: 'Dormant Lead Revival - Q1', audience: 'Leads inactive 60+ days', status: 'active', reached: 156, total: 240, convRate: '12.8%', schedule: 'Daily at 10:00 AM IST' },
  { id: '2', name: 'Price Drop Notification', audience: 'Leads with budget constraints', status: 'active', reached: 89, total: 120, convRate: '18.2%', schedule: 'Triggered on price update' },
  { id: '3', name: 'New Listing Alert - Whitefield', audience: 'Whitefield preference leads', status: 'paused', reached: 42, total: 85, convRate: '9.5%', schedule: 'Weekly on Monday' },
  { id: '4', name: 'Festival Offer Outreach', audience: 'All qualified leads', status: 'completed', reached: 310, total: 310, convRate: '22.1%', schedule: 'Completed Apr 15' },
]

function campaignStatusBadge(status: string) {
  switch (status) {
    case 'active': return 'bg-emerald-50 text-emerald-600 border-emerald-300'
    case 'paused': return 'bg-amber-50 text-amber-600 border-amber-300'
    case 'completed': return 'bg-blue-50 text-blue-600 border-blue-300'
    default: return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

export default function CampaignsSection({ sampleMode }: CampaignsProps) {
  const [scheduleActive, setScheduleActive] = useState(false)
  const [scheduleInfo, setScheduleInfo] = useState<any>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const campaigns = sampleMode ? SAMPLE_CAMPAIGNS : []

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    setScheduleLoading(true)
    try {
      const res = await listSchedules()
      if (res.success && Array.isArray(res.schedules)) {
        const sched = res.schedules.find((s: any) => s.id === SCHEDULE_ID)
        if (sched) { setScheduleInfo(sched); setScheduleActive(sched.is_active) }
      }
      const logRes = await getScheduleLogs(SCHEDULE_ID, { limit: 5 })
      if (logRes.success) setLogs(Array.isArray(logRes.executions) ? logRes.executions : [])
    } catch {}
    setScheduleLoading(false)
  }

  const handleToggleSchedule = async () => {
    setScheduleLoading(true)
    if (scheduleActive) { await pauseSchedule(SCHEDULE_ID) }
    else { await resumeSchedule(SCHEDULE_ID) }
    await loadSchedules()
    setScheduleLoading(false)
  }

  const handleTriggerNow = async () => {
    setTriggerLoading(true); setStatusMsg('')
    const res = await triggerScheduleNow(SCHEDULE_ID)
    setStatusMsg(res.success ? 'Re-engagement scan triggered successfully' : `Failed: ${res?.error || 'Unknown error'}`)
    setTriggerLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Campaigns</h2>
        <p className="text-sm text-muted-foreground mt-1">Re-engagement campaigns and automation status</p>
      </div>

      {campaigns.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <FiTarget className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No campaigns to display. Enable sample data to preview.</p>
          </CardContent>
        </Card>
      )}

      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="border-border bg-card hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold">{c.name}</h3>
                  <Badge variant="outline" className={`text-[10px] capitalize ${campaignStatusBadge(c.status)}`}>{c.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{c.audience}</p>

                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                  <div className="h-1.5 rounded-full" style={{ width: `${(c.reached / c.total) * 100}%`, background: 'hsl(25, 70%, 45%)' }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                  <span>{c.reached} / {c.total} reached</span>
                  <span>{c.convRate} conversion</span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <FiClock className="w-3 h-3" />
                  <span>{c.schedule}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FiClock className="w-4 h-4" /> Re-engagement Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily Re-engagement Scan</p>
              <p className="text-xs text-muted-foreground">{scheduleInfo?.cron_expression ? cronToHuman(scheduleInfo.cron_expression) : 'Loading schedule...'} (Asia/Kolkata)</p>
            </div>
            <div className="flex items-center gap-3">
              {scheduleLoading && <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch checked={scheduleActive} onCheckedChange={handleToggleSchedule} disabled={scheduleLoading} />
              <Badge variant="outline" className={`text-[10px] ${scheduleActive ? 'text-emerald-500 border-emerald-500/30' : 'text-gray-400 border-gray-400/30'}`}>
                {scheduleActive ? 'Active' : 'Paused'}
              </Badge>
            </div>
          </div>

          {scheduleInfo?.next_run_time && (
            <p className="text-xs text-muted-foreground">Next run: {new Date(scheduleInfo.next_run_time).toLocaleString()}</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTriggerNow} disabled={triggerLoading}>
              {triggerLoading ? <AiOutlineLoading3Quarters className="h-3 w-3 animate-spin mr-1.5" /> : <HiOutlinePlay className="h-3 w-3 mr-1.5" />} Run Now
            </Button>
            <Button variant="outline" size="sm" onClick={loadSchedules} disabled={scheduleLoading}>
              <FiRefreshCw className="h-3 w-3 mr-1.5" /> Refresh
            </Button>
          </div>

          {statusMsg && <p className="text-xs text-muted-foreground">{statusMsg}</p>}

          {logs.length > 0 && (
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {logs.map((l: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">{l?.executed_at ? new Date(l.executed_at).toLocaleString() : 'N/A'}</span>
                    <Badge variant="outline" className={`text-[10px] ${l?.success ? 'text-emerald-400 border-emerald-400/30' : 'text-red-400 border-red-400/30'}`}>
                      {l?.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
