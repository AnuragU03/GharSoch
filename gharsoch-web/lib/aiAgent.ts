'use client'

/**
 * AI Agent Client Utility (OpenAI Implementation)
 */

import { useState } from 'react'
import fetchWrapper from '@/lib/fetchWrapper'

export interface NormalizedAgentResponse {
  status: 'success' | 'error'
  result: Record<string, any>
  message?: string
  metadata?: {
    agent_name?: string
    timestamp?: string
    [key: string]: any
  }
}

export interface AIAgentResponse {
  success: boolean
  response: NormalizedAgentResponse
  agent_id?: string
  user_id?: string
  session_id?: string
  timestamp?: string
  raw_response?: string
  error?: string
}

/**
 * Call the AI Agent via server-side API route.
 * Now direct OpenAI call, no polling required.
 */
export async function callAIAgent(
  message: string,
  agent_id: string,
  options?: { user_id?: string; session_id?: string; assets?: string[] }
): Promise<AIAgentResponse> {
  try {
    const res = await fetchWrapper('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        agent_id,
        user_id: options?.user_id,
        session_id: options?.session_id,
        assets: options?.assets,
      }),
    })

    if (!res) {
      return {
        success: false,
        response: { status: 'error', result: {}, message: 'No response from server' },
        error: 'No response from server',
      }
    }

    const data = await res.json()
    return {
      ...data,
      agent_id,
      user_id: options?.user_id,
      session_id: options?.session_id,
    }
  } catch (error) {
    return {
      success: false,
      response: {
        status: 'error',
        result: {},
        message: error instanceof Error ? error.message : 'Network error',
      },
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * React hook for using AI Agent in components
 */
export function useAIAgent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<NormalizedAgentResponse | null>(null)

  const callAgent = async (
    message: string,
    agent_id: string,
    options?: { user_id?: string; session_id?: string; assets?: string[] }
  ) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    const result = await callAIAgent(message, agent_id, options)

    if (result.success) {
      setResponse(result.response)
    } else {
      setError(result.error || 'Unknown error')
      setResponse(result.response)
    }

    setLoading(false)
    return result
  }

  return {
    callAgent,
    loading,
    error,
    response,
  }
}

/**
 * Extract text from agent response
 */
export function extractText(response: NormalizedAgentResponse): string {
  if (response.message) return response.message
  if (response.result?.text) return response.result.text
  if (response.result?.message) return response.result.message
  if (response.result?.response) return response.result.response
  if (response.result?.answer) return response.result.answer
  if (response.result?.summary) return response.result.summary
  if (response.result?.content) return response.result.content
  if (typeof response.result === 'string') return response.result
  return ''
}
