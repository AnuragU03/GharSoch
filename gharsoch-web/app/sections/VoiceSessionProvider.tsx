'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import Vapi from '@vapi-ai/web'

interface VoiceContextType {
  vapi: Vapi | null
  isCallActive: boolean
  startCall: (assistantId: string) => void
  endCall: () => void
}

const VoiceContext = createContext<VoiceContextType>({
  vapi: null,
  isCallActive: false,
  startCall: () => {},
  endCall: () => {},
})

export const useVoice = () => useContext(VoiceContext)

export function VoiceSessionProvider({ children }: { children: React.ReactNode }) {
  const [vapi, setVapi] = useState<Vapi | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)

  useEffect(() => {
    // Only init on client side if public key exists
    const pubKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
    if (pubKey) {
      const vapiInstance = new Vapi(pubKey)
      
      vapiInstance.on('call-start', () => setIsCallActive(true))
      vapiInstance.on('call-end', () => setIsCallActive(false))
      vapiInstance.on('error', (e) => { console.error('Vapi Web Error:', e); setIsCallActive(false) })
      
      setVapi(vapiInstance)
      return () => { vapiInstance.stop() }
    }
  }, [])

  const startCall = (assistantId: string) => {
    if (vapi && !isCallActive) {
      vapi.start(assistantId)
    }
  }

  const endCall = () => {
    if (vapi && isCallActive) {
      vapi.stop()
    }
  }

  return (
    <VoiceContext.Provider value={{ vapi, isCallActive, startCall, endCall }}>
      {children}
    </VoiceContext.Provider>
  )
}
