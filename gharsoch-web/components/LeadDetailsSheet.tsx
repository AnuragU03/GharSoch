import React, { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FiPhoneCall, FiCalendar, FiMapPin, FiClock } from 'react-icons/fi'

interface CallLog {
  _id: string
  created_at: string
  duration: number
  disposition: string
  call_outcome: string
  call_summary: string
  transcript: string
  recording_url: string
}

interface LeadDetailsSheetProps {
  lead: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailsSheet({ lead, open, onOpenChange }: LeadDetailsSheetProps) {
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && lead?._id) {
      fetchCalls()
    }
  }, [open, lead])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calls/lead/${lead._id}`)
      const data = await res.json()
      if (data.success) {
        setCalls(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch calls:', e)
    } finally {
      setLoading(false)
    }
  }

  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-6 pb-2 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl">{lead.name}</SheetTitle>
              <SheetDescription className="text-sm mt-1">{lead.phone}</SheetDescription>
            </div>
            <Badge variant="outline" className="uppercase bg-muted/50">{lead.status}</Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b">
            <TabsList className="w-full justify-start h-12 bg-transparent p-0">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 rounded-none data-[state=active]:border-primary px-4 h-full">Lead Profile</TabsTrigger>
              <TabsTrigger value="calls" className="data-[state=active]:border-b-2 rounded-none data-[state=active]:border-primary px-4 h-full">Call History ({calls.length})</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent value="details" className="mt-0 space-y-6">
                
                {/* AI Extracted Requirements */}
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">AI Extracted Requirements</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Budget</span>
                      <span className="font-medium">{lead.budget_range || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Location</span>
                      <span className="font-medium">{lead.location_pref || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Property Type</span>
                      <span className="font-medium">{lead.property_type || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Timeline</span>
                      <span className="font-medium">{lead.timeline || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Objections / Notes</h3>
                  <div className="bg-card border rounded-lg p-3 text-sm">
                    {lead.objections ? (
                      <p className="text-destructive/80 mb-2 font-medium">Objection: {lead.objections}</p>
                    ) : null}
                    <p className="text-foreground whitespace-pre-wrap">{lead.notes || 'No notes available.'}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
                  <div className="flex items-center gap-1.5"><FiMapPin /> Source: {lead.source || 'Unknown'}</div>
                  <div className="flex items-center gap-1.5"><FiCalendar /> Next Follow-up: {lead.next_follow_up_date ? new Date(lead.next_follow_up_date).toLocaleDateString() : 'None'}</div>
                  <div className="flex items-center gap-1.5"><FiPhoneCall /> Total Calls: {lead.total_calls}</div>
                  <div className="flex items-center gap-1.5"><FiClock /> Created: {new Date(lead.created_at).toLocaleDateString()}</div>
                </div>

              </TabsContent>

              <TabsContent value="calls" className="mt-0 space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading call history...</p>
                ) : calls.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No calls recorded yet.</p>
                ) : (
                  calls.map((call) => (
                    <div key={call._id} className="border rounded-xl p-4 bg-card shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="bg-muted/50">{new Date(call.created_at).toLocaleString()}</Badge>
                        <Badge variant={call.call_outcome === 'follow_up_needed' ? 'default' : 'secondary'}>{call.call_outcome.replace('_', ' ')}</Badge>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">AI Summary</h4>
                        <p className="text-sm">{call.call_summary || 'No summary available.'}</p>
                      </div>

                      {call.recording_url && (
                        <div className="mb-4">
                          <audio src={call.recording_url} controls className="w-full h-8" />
                        </div>
                      )}

                      {call.transcript && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Full Transcript</h4>
                          <div className="bg-muted/30 p-3 rounded-lg max-h-40 overflow-y-auto text-xs font-mono leading-relaxed whitespace-pre-wrap border border-border/50">
                            {call.transcript}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
