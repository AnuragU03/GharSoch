'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FiUpload, FiTrash2, FiGlobe } from 'react-icons/fi'
import { HiOutlineCog6Tooth } from 'react-icons/hi2'
import { uploadAndTrainDocument, getDocuments, deleteDocuments, crawlWebsite, validateFile } from '@/lib/ragKnowledgeBase'

const RAG_ID = '69e8f683aa9f34bdaf6dcde1'

const AGENTS_CONFIG = [
  { name: 'Voice Orchestrator', id: '69e8f73c...ed99', type: 'Voice', model: 'GPT-4.1', status: 'Autonomous' },
  { name: 'Lead Qualification', id: '69e8f707...d22', type: 'JSON', model: 'Claude Sonnet', status: 'Autonomous' },
  { name: 'Financial Advisory', id: '69e8f708...a83', type: 'JSON', model: 'Claude Sonnet', status: 'Autonomous' },
  { name: 'Property Search', id: '69e8f709...889', type: 'JSON', model: 'Claude Sonnet', status: 'KB-backed' },
  { name: 'Calendar Scheduling', id: '69e8f71e...d95', type: 'JSON', model: 'Claude Sonnet', status: 'Tools: GCal' },
  { name: 'Post-Call Sync', id: '69e8f709...d24', type: 'JSON', model: 'Claude Sonnet', status: 'Autonomous' },
  { name: 'Re-engagement', id: '69e8f70a...a92', type: 'JSON', model: 'Claude Sonnet', status: 'Scheduled' },
  { name: 'Self-Service Advisor', id: '69e8f709...d26', type: 'JSON', model: 'Claude Sonnet', status: 'Interactive' },
]

export default function SettingsSection() {
  const [greeting, setGreeting] = useState('Welcome to GharSoch. I am your AI real estate financial advisor. How can I help you today?')
  const [voicemailScript, setVoicemailScript] = useState('Thank you for calling GharSoch. Please leave your name and number.')
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifEscalation, setNotifEscalation] = useState(true)
  const [notifDaily, setNotifDaily] = useState(false)

  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [kbStatus, setKbStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocs() }, [])

  const loadDocs = async () => {
    setDocsLoading(true)
    try {
      const res = await getDocuments(RAG_ID)
      if (res.success) setDocs(Array.isArray(res.documents) ? res.documents : [])
    } catch {}
    setDocsLoading(false)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = validateFile(file)
    if (!validation.valid) { setKbStatus(validation.error || 'Invalid file'); return }
    setUploadLoading(true); setKbStatus('')
    const res = await uploadAndTrainDocument(RAG_ID, file)
    setKbStatus(res.success ? 'Document uploaded and training started' : `Upload failed: ${res.error || 'Unknown error'}`)
    if (res.success) await loadDocs()
    setUploadLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (fileName: string) => {
    setDocsLoading(true)
    await deleteDocuments(RAG_ID, [fileName])
    await loadDocs()
  }

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawlLoading(true); setKbStatus('')
    const res = await crawlWebsite(RAG_ID, crawlUrl)
    setKbStatus(res.success ? 'Website crawled successfully' : `Crawl failed: ${res.error || 'Unknown error'}`)
    setCrawlLoading(false)
    if (res.success) { setCrawlUrl(''); await loadDocs() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Platform configuration and knowledge base management</p>
      </div>

      <Tabs defaultValue="agents">
        <TabsList className="bg-muted flex-wrap h-auto">
          <TabsTrigger value="agents" className="text-xs">Agent Config</TabsTrigger>
          <TabsTrigger value="scripts" className="text-xs">Scripts</TabsTrigger>
          <TabsTrigger value="kb" className="text-xs">Knowledge Base</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <HiOutlineCog6Tooth className="w-4 h-4" /> Agent Configuration (Read-only)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {AGENTS_CONFIG.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{agent.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{agent.type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{agent.model}</Badge>
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">{agent.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agent Greeting Script</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={greeting} onChange={e => setGreeting(e.target.value)} rows={3} />
              <p className="text-[10px] text-muted-foreground">This greeting is used by the Voice Orchestrator when answering calls.</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Voicemail Script</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={voicemailScript} onChange={e => setVoicemailScript(e.target.value)} rows={3} />
              <p className="text-[10px] text-muted-foreground">Played when the system detects a voicemail scenario.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kb" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Property Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {kbStatus && <p className="text-xs" style={{ color: 'hsl(25, 70%, 50%)' }}>{kbStatus}</p>}
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}>
                  {uploadLoading ? <AiOutlineLoading3Quarters className="h-3 w-3 mr-2 animate-spin" /> : <FiUpload className="h-3 w-3 mr-2" />} Upload Document
                </Button>
                <span className="text-xs text-muted-foreground">PDF, DOCX, TXT</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Input value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} placeholder="https://example.com/properties" className="flex-1" />
                <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawlLoading || !crawlUrl.trim()}>
                  {crawlLoading ? <AiOutlineLoading3Quarters className="h-3 w-3 animate-spin" /> : <FiGlobe className="h-3 w-3 mr-1" />} Crawl
                </Button>
              </div>
              <Separator />
              {docsLoading && <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" style={{ color: 'hsl(25, 70%, 45%)' }} />}
              {docs.length === 0 && !docsLoading && <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>}
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {docs.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-background">
                      <div>
                        <p className="text-sm">{d?.fileName ?? 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground">{d?.fileType ?? ''} | {d?.status ?? 'unknown'}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d?.fileName ?? '')} className="h-7 w-7 text-red-400 hover:text-red-500">
                        <FiTrash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Email notifications for converted leads', checked: notifEmail, onChange: setNotifEmail },
                { label: 'Escalation alerts (low sentiment)', checked: notifEscalation, onChange: setNotifEscalation },
                { label: 'Daily performance digest', checked: notifDaily, onChange: setNotifDaily },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <Label className="text-sm">{item.label}</Label>
                  <Switch checked={item.checked} onCheckedChange={item.onChange} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
