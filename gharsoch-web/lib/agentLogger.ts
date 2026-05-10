/**
 * Enhanced Agent Execution Logger
 * Tracks: input → reasoning steps → actions → results with full traceability
 * Stores in MongoDB collection: agent_execution_logs
 *
 * W2: All timestamps stored as BSON Date objects (not ISO strings).
 */

import { v4 as uuidv4 } from 'uuid'
import { getCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

function sanitizeMongoKeys(value: any): any {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeMongoKeys(v))
  }

  if (value instanceof Date) return value

  if (typeof value !== 'object') return value

  const out: Record<string, any> = {}
  for (const [rawKey, rawVal] of Object.entries(value)) {
    let key = rawKey

    // MongoDB does not allow field names that start with '$' or contain '.'
    if (key.startsWith('$')) key = `__${key.slice(1)}`
    if (key.includes('.')) key = key.replace(/\./g, '__dot__')

    out[key] = sanitizeMongoKeys(rawVal)
  }
  return out
}

export interface ReasoningStep {
  timestamp: Date
  step_type: string
  content: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface AgentAction {
  timestamp: Date
  action_type: string
  description: string
  parameters?: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
}

export interface AgentExecutionTrace {
  _id?: ObjectId
  run_id: string
  agent_id: string
  agent_name: string
  start_time: Date
  started_at: Date
  end_time?: Date
  completed_at?: Date
  execution_time_ms?: number
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'error' | 'success'
  input_data: Record<string, any>
  reasoning_steps: ReasoningStep[]
  actions: AgentAction[]
  output_data?: Record<string, any>
  reasoning_summary?: {
    summary: string
    confidence: number
    generated_at: string
  }
  summary_failed?: boolean
  summary_error?: string
  errors: Array<{
    timestamp: Date
    error_message: string
    error_type: string
    stack_trace?: string
  }>
  metadata: {
    model?: string
    provider?: string
    temperature?: number
    max_tokens?: number
    [key: string]: any
  }
  created_at: Date
  updated_at: Date
}

class AgentLogger {
  private currentRun: AgentExecutionTrace | null = null
  private collection: any = null

  /** Initialize logger and get MongoDB collection */
  async initialize() {
    if (!this.collection) {
      this.collection = await getCollection('agent_execution_logs')
    }
  }

  /** Start a new agent execution run */
  async startAgentRun(
    agent_id: string,
    agent_name: string,
    input_data: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<string> {
    await this.initialize()

    const run_id = uuidv4()
    const now = new Date() // W2: Date object, not ISO string

    this.currentRun = {
      run_id,
      agent_id,
      agent_name,
      start_time: now,
      started_at: now,
      status: 'started',
      input_data: sanitizeMongoKeys(input_data),
      reasoning_steps: [],
      actions: [],
      errors: [],
      metadata: sanitizeMongoKeys(metadata || {}),
      created_at: now,
      updated_at: now,
    }

    await this.collection.insertOne(this.currentRun)
    return run_id
  }

  /** Log a reasoning step during agent execution */
  async logAgentThinking(
    runId: string,
    step_type: ReasoningStep['step_type'],
    content: string,
    confidence?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.initialize()

    const reasoning_step: ReasoningStep = {
      timestamp: new Date(), // W2
      step_type,
      content,
      confidence,
      metadata: metadata ? sanitizeMongoKeys(metadata) : undefined,
    }

    await this.collection.updateOne(
      { run_id: runId },
      {
        $push: { reasoning_steps: reasoning_step },
        $set: { updated_at: new Date() }, // W2
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.reasoning_steps.push(reasoning_step)
    }
  }

  /** Log an agent action (tool-call, API request, database operation, etc.) */
  async logAgentAction(
    runId: string,
    action_type: string,
    description: string,
    parameters?: Record<string, any>,
    result?: Record<string, any>,
    error?: string
  ): Promise<void> {
    await this.initialize()

    const action: AgentAction = {
      timestamp: new Date(), // W2
      action_type,
      description,
      parameters: parameters ? sanitizeMongoKeys(parameters) : undefined,
      result: result ? sanitizeMongoKeys(result) : undefined,
      status: error ? 'failed' : result ? 'completed' : 'pending',
      error,
    }

    await this.collection.updateOne(
      { run_id: runId },
      {
        $push: { actions: action },
        $set: { updated_at: new Date() }, // W2
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.actions.push(action)
    }
  }

  /** Log an error that occurred during execution */
  async logError(
    runId: string,
    error_message: string,
    error_type: string,
    stack_trace?: string
  ): Promise<void> {
    await this.initialize()

    const error_record = {
      timestamp: new Date(), // W2
      error_message,
      error_type,
      stack_trace,
    }

    await this.collection.updateOne(
      { run_id: runId },
      {
        $push: { errors: error_record },
        $set: { status: 'error', updated_at: new Date() }, // W2
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.errors.push(error_record)
      this.currentRun.status = 'error'
    }
  }

  /** Complete an agent execution run */
  async completeAgentRun(
    runId: string,
    output_data: Record<string, any>,
    status: 'completed' | 'failed' | 'error' | 'success' = 'completed',
    executionTimeMs?: number
  ): Promise<void> {
    await this.initialize()

    const end_time = new Date() // W2

    // Best-effort execution time calculation if not provided by caller.
    let computedExecutionTimeMs = executionTimeMs
    if (computedExecutionTimeMs === undefined) {
      const run = await this.collection.findOne({ run_id: runId }, { projection: { start_time: 1, created_at: 1 } })
      const start = run?.start_time || run?.created_at
      computedExecutionTimeMs = start
        ? Date.now() - (start instanceof Date ? start.getTime() : Date.parse(start))
        : undefined
    }

    await this.collection.updateOne(
      { run_id: runId },
      {
        $set: {
          status,
          output_data: sanitizeMongoKeys(output_data),
          end_time,
          completed_at: end_time,
          execution_time_ms: computedExecutionTimeMs,
          updated_at: end_time, // W2
        },
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.status = status
      this.currentRun.output_data = sanitizeMongoKeys(output_data)
      this.currentRun.end_time = end_time
      this.currentRun.completed_at = end_time
      this.currentRun.execution_time_ms = computedExecutionTimeMs
    }
  }

  async attachSummary(
    runId: string,
    payload: { summary: string; confidence: number; generated_at: string }
  ): Promise<void> {
    await this.initialize()

    const sanitizedPayload = sanitizeMongoKeys(payload)
    await this.collection.updateOne(
      { run_id: runId },
      {
        $set: {
          reasoning_summary: sanitizedPayload,
          summary_failed: false,
          summary_error: null,
          updated_at: new Date(), // W2
        },
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.reasoning_summary = sanitizedPayload
      this.currentRun.summary_failed = false
      this.currentRun.summary_error = undefined
    }
  }

  async markSummaryFailed(runId: string, errorMessage: string): Promise<void> {
    await this.initialize()

    await this.collection.updateOne(
      { run_id: runId },
      {
        $set: {
          summary_failed: true,
          summary_error: errorMessage,
          updated_at: new Date(), // W2
        },
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.summary_failed = true
      this.currentRun.summary_error = errorMessage
    }
  }

  /** Mark an agent run as failed (non-throwing helper for callers) */
  async failAgentRun(
    runId: string,
    err: { message: string; type?: string; stack?: string },
    executionTimeMs?: number
  ): Promise<void> {
    await this.initialize()

    const end_time = new Date() // W2
    const error_record = {
      timestamp: end_time,
      error_message: err.message,
      error_type: err.type || 'Error',
      stack_trace: err.stack,
    }

    await this.collection.updateOne(
      { run_id: runId },
      {
        $push: { errors: error_record },
        $set: {
          status: 'failed',
          end_time,
          completed_at: end_time,
          execution_time_ms: executionTimeMs,
          updated_at: end_time, // W2
        },
      }
    )

    if (this.currentRun?.run_id === runId) {
      this.currentRun.errors.push(error_record)
      this.currentRun.status = 'failed'
      this.currentRun.end_time = end_time
      this.currentRun.completed_at = end_time
      this.currentRun.execution_time_ms = executionTimeMs
    }
  }

  /** Retrieve execution trace for a specific run */
  async getExecutionTrace(runId: string): Promise<AgentExecutionTrace | null> {
    await this.initialize()
    return await this.collection.findOne({ run_id: runId })
  }

  /** Retrieve recent execution traces for an agent */
  async getAgentExecutionHistory(
    agent_id: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<AgentExecutionTrace[]> {
    await this.initialize()
    return await this.collection
      .find({ agent_id })
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .toArray()
  }

  /** Get execution traces by status */
  async getExecutionsByStatus(
    status: string,
    limit: number = 50
  ): Promise<AgentExecutionTrace[]> {
    await this.initialize()
    return await this.collection
      .find({ status })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()
  }

  /** Calculate execution statistics for an agent */
  async getAgentStats(agent_id: string, days: number = 7): Promise<{
    total_runs: number
    successful_runs: number
    failed_runs: number
    error_runs: number
    avg_execution_time_ms: number
    most_common_errors: Array<{ error_type: string; count: number }>
  }> {
    await this.initialize()

    const cutoff_date = new Date()
    cutoff_date.setDate(cutoff_date.getDate() - days)

    const executions = await this.collection
      .find({
        agent_id,
        created_at: { $gte: cutoff_date }, // W2: compare Date to Date
      })
      .toArray()

    const total_runs = executions.length
    const successful_runs = executions.filter((e: any) => e.status === 'completed' || e.status === 'success').length
    const failed_runs = executions.filter((e: any) => e.status === 'failed').length
    const error_runs = executions.filter((e: any) => e.status === 'error').length

    const execution_times = executions
      .filter((e: any) => e.execution_time_ms)
      .map((e: any) => e.execution_time_ms)
    const avg_execution_time_ms =
      execution_times.length > 0 ? execution_times.reduce((a: number, b: number) => a + b, 0) / execution_times.length : 0

    const error_types: Record<string, number> = {}
    executions.forEach((e: any) => {
      e.errors?.forEach((err: any) => {
        error_types[err.error_type] = (error_types[err.error_type] || 0) + 1
      })
    })

    const most_common_errors = Object.entries(error_types)
      .map(([error_type, count]) => ({ error_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      total_runs,
      successful_runs,
      failed_runs,
      error_runs,
      avg_execution_time_ms,
      most_common_errors,
    }
  }

  /** Clear current run context */
  clearCurrentRun(): void {
    this.currentRun = null
  }
}

// Singleton instance
export const agentLogger = new AgentLogger()
