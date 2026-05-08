'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiOutlinePhone, HiOutlineUserGroup, HiOutlineCalendarDays } from 'react-icons/hi2'
import { FiTrendingUp } from 'react-icons/fi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function AnalyticsSection() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading analytics...</div>
  if (!stats) return <div className="py-12 text-center text-destructive">Failed to load analytics.</div>

  const funnelData = [
    { name: 'Total Leads', value: stats.funnel.total },
    { name: 'Contacted', value: stats.funnel.contacted },
    { name: 'Qualified', value: stats.funnel.qualified },
    { name: 'Appointments', value: stats.funnel.appointed },
  ]

  const mockWeeklyCalls = [
    { day: 'Mon', calls: Math.floor(stats.totalCalls * 0.1) },
    { day: 'Tue', calls: Math.floor(stats.totalCalls * 0.15) },
    { day: 'Wed', calls: Math.floor(stats.totalCalls * 0.2) },
    { day: 'Thu', calls: Math.floor(stats.totalCalls * 0.18) },
    { day: 'Fri', calls: Math.floor(stats.totalCalls * 0.25) },
    { day: 'Sat', calls: Math.floor(stats.totalCalls * 0.12) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Analytics & Performance</h2>
        <p className="text-sm text-muted-foreground">Campaign and agent conversion metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Conversion Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.funnel.total ? Math.round((stats.funnel.appointed / stats.funnel.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Leads to Appointments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Qualification Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.funnel.contacted ? Math.round((stats.funnel.qualified / stats.funnel.contacted) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Contacted to Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Call Duration</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgCallDuration / 60)}m {stats.avgCallDuration % 60}s</div>
            <p className="text-xs text-muted-foreground">Across all connected calls</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FiTrendingUp /> Funnel Drop-off</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 20 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" fill="hsl(25, 70%, 45%)" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><HiOutlinePhone /> Call Volume (7 Days)</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockWeeklyCalls} margin={{ left: -20, right: 20, top: 20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="calls" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
