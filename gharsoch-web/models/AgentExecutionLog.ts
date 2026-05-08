/**
 * Agent Execution Log Model
 * Stores detailed execution traces for debugging and observability
 */

import { ObjectId } from 'mongodb'

export interface ReasoningStep {
  timestamp: string
  step_type: string
  content: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface AgentAction {
  timestamp: string
  action_type: string
  description: string
  parameters?: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
}

export interface AgentExecutionLog {
  _id?: ObjectId
  run_id: string // UUID for this specific execution
  agent_id: string
  agent_name: string
  start_time: string // ISO timestamp
  started_at?: string // ISO timestamp (alias)
  end_time?: string // ISO timestamp
  completed_at?: string // ISO timestamp (alias)
  execution_time_ms?: number
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'error' | 'success'
  
  // Input to the agent
  input_data: Record<string, any>
  
  // AI reasoning trace
  reasoning_steps: ReasoningStep[]
  
  // Actions agent took
  actions: AgentAction[]
  
  // Final output
  output_data?: Record<string, any>
  
  // Errors encountered
  errors: Array<{
    timestamp: string
    error_message: string
    error_type: string
    stack_trace?: string
  }>
  
  // Model and execution metadata
  metadata: {
    model?: string
    provider?: string
    temperature?: number
    max_tokens?: number
    [key: string]: any
  }
  
  created_at: string
  updated_at: string
}

export const DEFAULT_AGENT_EXECUTION_LOG: Omit<AgentExecutionLog, '_id'> = {
  run_id: '',
  agent_id: '',
  agent_name: '',
  start_time: new Date().toISOString(),
  status: 'started',
  input_data: {},
  reasoning_steps: [],
  actions: [],
  errors: [],
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
