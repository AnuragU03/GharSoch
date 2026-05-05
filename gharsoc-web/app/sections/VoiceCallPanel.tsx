'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiActivity, FiLoader, FiAlertCircle } from 'react-icons/fi'
import Vapi from '@vapi-ai/web'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  isFinal: boolean
  timestamp: number
}

interface VoiceCallPanelProps {
  onCallStateChange?: (active: boolean) => void
}

export default function VoiceCallPanel({ onCallStateChange }: VoiceCallPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [callDuration, setCallDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  
  const vapiRef = useRef<any>(null)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, isThinking])

  // Initialize Vapi SDK
  useEffect(() => {
    // Vapi Public Key should be in .env (e.g. NEXT_PUBLIC_VAPI_PUBLIC_KEY)
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || 'mock-public-key'
    
    try {
      vapiRef.current = new Vapi(publicKey)
      
      vapiRef.current.on('call-start', () => {
        setStatus('connected')
        setErrorMessage('')
        setIsThinking(false)
        onCallStateChange?.(true)
        
        // Start duration timer
        setCallDuration(0)
        if (callTimerRef.current) clearInterval(callTimerRef.current)
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      })

      vapiRef.current.on('call-end', () => {
        setStatus('disconnected')
        cleanupCall()
      })

      vapiRef.current.on('message', (message: any) => {
        if (message.type === 'transcript') {
          const entry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role: message.role === 'user' ? 'user' : 'assistant',
            text: message.transcript ?? '',
            isFinal: message.transcriptType === 'final',
            timestamp: Date.now(),
          }
          
          setTranscript(prev => {
            // Replace non-final transcripts
            if (!entry.isFinal && prev.length > 0) {
              const last = prev[prev.length - 1]
              if (!last.isFinal && last.role === entry.role) {
                return [...prev.slice(0, -1), entry]
              }
            }
            return [...prev, entry]
          })
        }
        
        // Handle function calling indicator
        if (message.type === 'function-call') {
          setIsThinking(true)
        }
        if (message.type === 'function-call-result') {
          setIsThinking(false)
        }
      })

      vapiRef.current.on('error', (e: Error) => {
        setErrorMessage(e.message || 'An error occurred during the call')
        setStatus('error')
        cleanupCall()
      })
      
      vapiRef.current.on('volume-level', (volume: number) => {
        // Vapi volume is typically 0 to 1
        setAudioLevel(volume)
      })

    } catch (err: any) {
      console.error('Failed to initialize Vapi:', err)
      setErrorMessage('Failed to initialize voice orchestrator.')
      setStatus('error')
    }

    return () => {
      cleanupCall()
      if (vapiRef.current) {
        vapiRef.current.stop()
      }
    }
  }, [onCallStateChange])

  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
    setAudioLevel(0)
    setIsThinking(false)
    onCallStateChange?.(false)
  }

  const startCall = async () => {
    if (!vapiRef.current) return
    setStatus('connecting')
    setErrorMessage('')
    setTranscript([])
    setIsMuted(false)
    
    try {
      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'mock-assistant-id'
      await vapiRef.current.start(assistantId, {
        endCallFunctionEnabled: true,
        endCallMessage: 'Thank you for your time. Have a great day!',
      })
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start call')
      setStatus('error')
      cleanupCall()
    }
  }

  const endCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop()
    }
    setStatus('disconnected')
    cleanupCall()
  }

  const toggleMute = () => {
    if (vapiRef.current) {
      const newMutedState = !isMuted
      vapiRef.current.setMuted(newMutedState)
      setIsMuted(newMutedState)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isActive = status === 'connected' || status === 'connecting'

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-3" style={{ background: 'linear-gradient(135deg, hsl(20, 15%, 12%) 0%, hsl(25, 20%, 18%) 100%)' }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-white/80 flex items-center gap-2">
            <FiPhone className="w-4 h-4" /> Live Voice Orchestrator
          </CardTitle>
          <div className="flex items-center gap-2">
            {status === 'connected' && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block" />
                Connected
              </Badge>
            )}
            {status === 'connecting' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                <FiLoader className="w-3 h-3 animate-spin mr-1" />
                Connecting
              </Badge>
            )}
            {status === 'disconnected' && (
              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">
                Disconnected
              </Badge>
            )}
            {status === 'error' && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                <FiAlertCircle className="w-3 h-3 mr-1" />
                Error
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Call Interface */}
        <div className="p-6" style={{ background: 'linear-gradient(180deg, hsl(20, 15%, 14%) 0%, hsl(25, 18%, 10%) 100%)' }}>
          {/* Audio Visualizer Circle */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {/* Main circle */}
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center relative transition-all duration-75"
                style={{
                  background: isActive
                    ? `radial-gradient(circle, hsl(25, 70%, ${35 + audioLevel * 20}%) 0%, hsl(25, 60%, ${25 + audioLevel * 10}%) 100%)`
                    : 'radial-gradient(circle, hsl(0, 0%, 25%) 0%, hsl(0, 0%, 18%) 100%)',
                  boxShadow: isActive
                    ? `0 0 ${20 + audioLevel * 40}px hsl(25, 70%, 45%, ${0.2 + audioLevel * 0.4})`
                    : 'none',
                  transform: `scale(${1 + audioLevel * 0.08})`,
                }}
              >
                {isActive ? (
                  <FiActivity className="w-8 h-8 text-white/90" />
                ) : (
                  <FiPhone className="w-8 h-8 text-white/40" />
                )}
              </div>
            </div>

            {/* Call Timer */}
            {isActive && (
              <div className="mt-4 text-center">
                <p className="text-2xl font-mono font-bold text-white tabular-nums">{formatTime(callDuration)}</p>
                {isThinking && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1 justify-center">
                    <FiLoader className="w-3 h-3 animate-spin" />
                    Agent is fetching data...
                  </p>
                )}
                {isMuted && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1 justify-center">
                    <FiMicOff className="w-3 h-3" />
                    Microphone muted
                  </p>
                )}
              </div>
            )}

            {status === 'idle' && (
              <p className="mt-4 text-sm text-white/40 text-center">Press Start Call to connect with the AI Voice Orchestrator</p>
            )}
            {status === 'disconnected' && callDuration > 0 && (
              <p className="mt-4 text-sm text-white/50 text-center">Call ended - Duration: {formatTime(callDuration)}</p>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isActive ? (
              <Button
                onClick={startCall}
                disabled={isActive}
                className="rounded-full w-14 h-14 p-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-105"
              >
                <FiPhone className="w-6 h-6" />
              </Button>
            ) : (
              <>
                <Button
                  onClick={toggleMute}
                  variant="outline"
                  className={`rounded-full w-12 h-12 p-0 border-white/20 transition-all ${isMuted ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'}`}
                >
                  {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={endCall}
                  className="rounded-full w-14 h-14 p-0 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all hover:scale-105"
                >
                  <FiPhoneOff className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>

          {/* Error Display */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 flex items-center gap-2">
                <FiAlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Transcript Area */}
        <div className="border-t border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Live Transcript {transcript.length > 0 && `(${transcript.filter(t => t.isFinal).length} messages)`}
            </p>
          </div>
          <ScrollArea className="h-[220px]">
            <div className="p-4 space-y-3">
              {transcript.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FiActivity className="w-8 h-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {isActive ? 'Waiting for conversation...' : 'Start a call to see the transcript'}
                  </p>
                </div>
              )}
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      entry.role === 'user'
                        ? 'bg-primary/10 text-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    } ${!entry.isFinal ? 'opacity-60' : ''}`}
                  >
                    <p className="text-[10px] font-semibold mb-0.5 uppercase tracking-wider" style={{ color: entry.role === 'user' ? 'hsl(25, 70%, 50%)' : 'hsl(210, 50%, 50%)' }}>
                      {entry.role === 'user' ? 'You' : 'Agent'}
                    </p>
                    <p className="text-sm leading-relaxed">{entry.text}</p>
                    {!entry.isFinal && (
                      <span className="text-[9px] text-muted-foreground italic">transcribing...</span>
                    )}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-muted text-foreground rounded-bl-sm">
                    <p className="text-[10px] font-semibold mb-0.5 uppercase tracking-wider" style={{ color: 'hsl(210, 50%, 50%)' }}>
                      Agent
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
