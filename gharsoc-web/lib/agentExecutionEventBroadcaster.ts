/**
 * Agent Execution Event Broadcaster
 * Emits real-time events during agent execution for WebSocket clients
 * Phase 7: Real-time agent monitoring
 */

import { EventEmitter } from 'events'

export interface AgentExecutionEvent {
  type: 'execution_started' | 'thinking' | 'action' | 'execution_completed' | 'execution_error'
  run_id: string
  agent_id: string
  agent_name: string
  timestamp: string
  data: Record<string, any>
}

class AgentExecutionEventBroadcaster extends EventEmitter {
  private static instance: AgentExecutionEventBroadcaster

  private constructor() {
    super()
    this.setMaxListeners(100)
  }

  static getInstance(): AgentExecutionEventBroadcaster {
    if (!AgentExecutionEventBroadcaster.instance) {
      AgentExecutionEventBroadcaster.instance = new AgentExecutionEventBroadcaster()
    }
    return AgentExecutionEventBroadcaster.instance
  }

  /**
   * Broadcast execution started event
   */
  broadcastExecutionStarted(
    runId: string,
    agentId: string,
    agentName: string,
    inputData: Record<string, any>
  ): void {
    const event: AgentExecutionEvent = {
      type: 'execution_started',
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      timestamp: new Date().toISOString(),
      data: {
        input_data: inputData,
      },
    }
    this.emit('agent_event', event)
    this.emit(`agent:${agentId}`, event)
    this.emit(`run:${runId}`, event)
  }

  /**
   * Broadcast thinking/reasoning event
   */
  broadcastThinking(
    runId: string,
    agentId: string,
    agentName: string,
    stepType: string,
    content: string,
    confidence?: number
  ): void {
    const event: AgentExecutionEvent = {
      type: 'thinking',
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      timestamp: new Date().toISOString(),
      data: {
        step_type: stepType,
        content,
        confidence: confidence || 0.8,
      },
    }
    this.emit('agent_event', event)
    this.emit(`agent:${agentId}`, event)
    this.emit(`run:${runId}`, event)
  }

  /**
   * Broadcast action event
   */
  broadcastAction(
    runId: string,
    agentId: string,
    agentName: string,
    actionType: string,
    description: string,
    status: 'pending' | 'completed' | 'failed'
  ): void {
    const event: AgentExecutionEvent = {
      type: 'action',
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      timestamp: new Date().toISOString(),
      data: {
        action_type: actionType,
        description,
        status,
      },
    }
    this.emit('agent_event', event)
    this.emit(`agent:${agentId}`, event)
    this.emit(`run:${runId}`, event)
  }

  /**
   * Broadcast execution completed event
   */
  broadcastExecutionCompleted(
    runId: string,
    agentId: string,
    agentName: string,
    outputData: Record<string, any>,
    executionTimeMs: number
  ): void {
    const event: AgentExecutionEvent = {
      type: 'execution_completed',
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      timestamp: new Date().toISOString(),
      data: {
        output_data: outputData,
        execution_time_ms: executionTimeMs,
        status: 'success',
      },
    }
    this.emit('agent_event', event)
    this.emit(`agent:${agentId}`, event)
    this.emit(`run:${runId}`, event)
  }

  /**
   * Broadcast execution error event
   */
  broadcastExecutionError(
    runId: string,
    agentId: string,
    agentName: string,
    errorMessage: string,
    errorType: string
  ): void {
    const event: AgentExecutionEvent = {
      type: 'execution_error',
      run_id: runId,
      agent_id: agentId,
      agent_name: agentName,
      timestamp: new Date().toISOString(),
      data: {
        error_message: errorMessage,
        error_type: errorType,
        status: 'failed',
      },
    }
    this.emit('agent_event', event)
    this.emit(`agent:${agentId}`, event)
    this.emit(`run:${runId}`, event)
  }

  /**
   * Get all current listeners for monitoring
   */
  getListenerCount(eventName?: string): number {
    if (eventName) {
      return this.listenerCount(eventName)
    }
    return this.eventNames().length
  }
}

export const executionEventBroadcaster = AgentExecutionEventBroadcaster.getInstance()
