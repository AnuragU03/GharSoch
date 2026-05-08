'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FiHome, FiSearch, FiShield, FiMapPin, FiTrendingUp, FiCheckCircle, FiAlertTriangle, FiInfo } from 'react-icons/fi'
import { HiOutlineScale } from 'react-icons/hi2'
import { callAIAgent } from '@/lib/aiAgent'

const PROPERTY_SEARCH_AGENT_ID = '69e8f709d2531e39b8b15889'
const SELF_SERVICE_AGENT_ID = '69e8f709f89cad5d4b752d26'

interface HomeTruthProps {
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

export default function HomeTruthSection({ activeAgentId, setActiveAgentId }: HomeTruthProps) {
  const [formData, setFormData] = useState({
    propertyName: '',
    location: '',
    propertyType: '2BHK',
    budgetMin: '',
    budgetMax: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const displayData = result

  const handleSearch = async () => {
    if (!formData.propertyName) {
      setError('Please enter a property or project name')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setActiveAgentId(PROPERTY_SEARCH_AGENT_ID)

    try {
      const budgetStr = formData.budgetMin && formData.budgetMax
        ? ` Budget range: INR ${formData.budgetMin} to ${formData.budgetMax}.`
        : ''
      const message = `Provide a comprehensive honest assessment and verification of the property/project "${formData.propertyName}" in ${formData.location || 'Bangalore'}. Property type: ${formData.propertyType}.${budgetStr} Include: builder reputation score, RERA compliance status, legal clearance, construction progress, price per sqft analysis compared to market average, location score, connectivity, nearby amenities, upcoming infrastructure, honest pros and cons, and buying recommendation.`
      const res = await callAIAgent(message, PROPERTY_SEARCH_AGENT_ID)
      if (res.success) {
        const parsed = res?.response?.result ?? res?.response ?? null
        setResult(parsed)
      } else {
        setError('Failed to get property assessment. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    }

    setLoading(false)
    setActiveAgentId(null)
  }

  const resultText = typeof displayData === 'string' ? displayData : ''
  const hasTextResult = typeof resultText === 'string' && resultText.length > 0
  const isStructured = displayData && typeof displayData === 'object' && !hasTextResult

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FiHome className="w-6 h-6" style={{ color: 'hsl(25, 70%, 45%)' }} />
          HomeTruth
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Honest, Agent-powered property verification and assessment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FiSearch className="w-4 h-4" /> Property Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Property / Project Name *</Label>
              <Input placeholder="e.g. Prestige Lakeside Habitat" value={formData.propertyName} onChange={(e) => setFormData(prev => ({ ...prev, propertyName: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Location</Label>
              <Input placeholder="e.g. Whitefield, Bangalore" value={formData.location} onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Property Type</Label>
              <Select value={formData.propertyType} onValueChange={(v) => setFormData(prev => ({ ...prev, propertyType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1BHK">1 BHK</SelectItem>
                  <SelectItem value="2BHK">2 BHK</SelectItem>
                  <SelectItem value="3BHK">3 BHK</SelectItem>
                  <SelectItem value="4BHK">4 BHK</SelectItem>
                  <SelectItem value="Villa">Villa</SelectItem>
                  <SelectItem value="Plot">Plot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Budget Min (INR)</Label>
                <Input type="number" placeholder="e.g. 5000000" value={formData.budgetMin} onChange={(e) => setFormData(prev => ({ ...prev, budgetMin: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium">Budget Max (INR)</Label>
                <Input type="number" placeholder="e.g. 10000000" value={formData.budgetMax} onChange={(e) => setFormData(prev => ({ ...prev, budgetMax: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <Button onClick={handleSearch} disabled={loading || !formData.propertyName} className="w-full" style={{ background: 'hsl(25, 70%, 45%)' }}>
              {loading ? <><AiOutlineLoading3Quarters className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : 'Get HomeTruth Report'}
            </Button>

            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}


          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">HomeTruth Report</CardTitle>
          </CardHeader>
          <CardContent>
            {!displayData && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FiShield className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Enter a property name to get an honest, Agent-powered assessment.</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <AiOutlineLoading3Quarters className="w-8 h-8 animate-spin mb-3" style={{ color: 'hsl(25, 70%, 45%)' }} />
                <p className="text-sm text-muted-foreground">Running property verification...</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Analyzing builder, legal, pricing, and location data</p>
              </div>
            )}

            {displayData && !loading && (
              <ScrollArea className="h-[500px]">
                <div className="pr-4">
                  {hasTextResult && renderMarkdown(resultText)}

                  {isStructured && (
                    <div className="space-y-5">
                      {displayData?.propertyName && (
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold">{displayData.propertyName}</h3>
                            {displayData?.location && <p className="text-sm text-muted-foreground flex items-center gap-1"><FiMapPin className="w-3 h-3" /> {displayData.location}</p>}
                          </div>
                          {displayData?.priceVerdict && (
                            <Badge variant="outline" className={`text-xs ${displayData.priceVerdict?.includes('Over') ? 'border-amber-500/40 text-amber-600' : displayData.priceVerdict?.includes('Under') ? 'border-emerald-500/40 text-emerald-600' : 'border-blue-500/40 text-blue-600'}`}>
                              {displayData.priceVerdict}
                            </Badge>
                          )}
                        </div>
                      )}

                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid grid-cols-4 w-full">
                          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                          <TabsTrigger value="location" className="text-xs">Location</TabsTrigger>
                          <TabsTrigger value="pricing" className="text-xs">Pricing</TabsTrigger>
                          <TabsTrigger value="verdict" className="text-xs">Verdict</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <div className="flex items-center gap-2 mb-1">
                                <FiShield className="w-4 h-4 text-emerald-500" />
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Builder Score</span>
                              </div>
                              <p className="text-xl font-bold">{displayData?.builderScore ?? '--'}<span className="text-xs text-muted-foreground">/10</span></p>
                            </div>
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <div className="flex items-center gap-2 mb-1">
                                <FiCheckCircle className="w-4 h-4 text-blue-500" />
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">RERA Status</span>
                              </div>
                              <p className="text-sm font-semibold">{displayData?.reraStatus ?? '--'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <div className="flex items-center gap-2 mb-1">
                                <HiOutlineScale className="w-4 h-4 text-purple-500" />
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Legal Status</span>
                              </div>
                              <p className="text-sm font-semibold">{displayData?.legalStatus ?? '--'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <div className="flex items-center gap-2 mb-1">
                                <FiTrendingUp className="w-4 h-4 text-amber-500" />
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Construction</span>
                              </div>
                              <p className="text-xl font-bold">{displayData?.constructionProgress ?? '--'}</p>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="location" className="mt-4 space-y-4">
                          <div className="p-3 rounded-lg border border-border bg-background">
                            <div className="flex items-center gap-2 mb-2">
                              <FiMapPin className="w-4 h-4" style={{ color: 'hsl(25, 70%, 45%)' }} />
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Location Score</span>
                            </div>
                            <p className="text-xl font-bold mb-1">{displayData?.locationScore ?? '--'}<span className="text-xs text-muted-foreground">/10</span></p>
                          </div>
                          {displayData?.connectivity && (
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Connectivity</p>
                              <p className="text-sm">{displayData.connectivity}</p>
                            </div>
                          )}
                          {displayData?.amenities && (
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Nearby Amenities</p>
                              <p className="text-sm">{displayData.amenities}</p>
                            </div>
                          )}
                          {displayData?.upcomingInfra && (
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Upcoming Infrastructure</p>
                              <p className="text-sm">{displayData.upcomingInfra}</p>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="pricing" className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Price / Sq.ft</p>
                              <p className="text-xl font-bold">{displayData?.pricePerSqft ? `INR ${displayData.pricePerSqft.toLocaleString()}` : '--'}</p>
                            </div>
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Market Average</p>
                              <p className="text-xl font-bold">{displayData?.marketAvgPrice ? `INR ${displayData.marketAvgPrice.toLocaleString()}` : '--'}</p>
                            </div>
                          </div>
                          {displayData?.pricePerSqft && displayData?.marketAvgPrice && (
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Price Difference</p>
                              <p className={`text-sm font-semibold ${displayData.pricePerSqft > displayData.marketAvgPrice ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {displayData.pricePerSqft > displayData.marketAvgPrice ? '+' : ''}{Math.round(((displayData.pricePerSqft - displayData.marketAvgPrice) / displayData.marketAvgPrice) * 100)}% vs market average
                              </p>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="verdict" className="mt-4 space-y-4">
                          {Array.isArray(displayData?.pros) && displayData.pros.length > 0 && (
                            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                              <p className="text-[11px] font-semibold text-emerald-600 uppercase mb-2 flex items-center gap-1"><FiCheckCircle className="w-3 h-3" /> Pros</p>
                              <ul className="space-y-1.5">
                                {displayData.pros.map((pro: string, i: number) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">+</span>
                                    <span>{pro}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(displayData?.cons) && displayData.cons.length > 0 && (
                            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                              <p className="text-[11px] font-semibold text-amber-600 uppercase mb-2 flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" /> Cons</p>
                              <ul className="space-y-1.5">
                                {displayData.cons.map((con: string, i: number) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5 flex-shrink-0">-</span>
                                    <span>{con}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {displayData?.recommendation && (
                            <div className="p-3 rounded-lg border border-border bg-background">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><FiInfo className="w-3 h-3" /> Buyer Advisory</p>
                              {renderMarkdown(displayData.recommendation)}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      {!displayData?.propertyName && (
                        <div className="space-y-3">
                          {Object.entries(displayData).map(([key, value]) => {
                            if (value === null || value === undefined) return null
                            return (
                              <div key={key} className="border-b border-border/50 pb-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
                                {typeof value === 'string' ? renderMarkdown(value) : (
                                  Array.isArray(value) ? (
                                    <ul className="space-y-1">
                                      {value.map((item, i) => <li key={i} className="text-sm ml-4 list-disc">{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}
                                    </ul>
                                  ) : (
                                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
                                  )
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {displayData && typeof displayData === 'string' && !hasTextResult && (
                    <p className="text-sm text-muted-foreground">{displayData}</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
