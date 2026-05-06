/**
 * Agent Execution Viewer Component
 * Modal that displays detailed execution trace for an agent run
 * Shows input → reasoning steps → actions → results
 */

'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface ReasoningStep {
  timestamp: string
  step_type: 'evaluation' | 'decision' | 'constraint_check' | 'tool_call' | 'result_analysis'
  content: string
  confidence?: number
  metadata?: Record<string, any>
}

interface AgentAction {
  timestamp: string
  action_type: string
  description: string
  parameters?: Record<string, any>
  result?: Record<string, any>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
}

interface ExecutionTrace {
  run_id: string
  agent_name: string
  start_time: string
  end_time?: string
  execution_time_ms?: number
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'error'
  input_data: Record<string, any>
  reasoning_steps: ReasoningStep[]
  actions: AgentAction[]
  output_data?: Record<string, any>
  errors: Array<{ timestamp: string; error_message: string; error_type: string }>
}

interface AgentExecutionViewerProps {
  isOpen: boolean
  onClose: () => void
  runId?: string
  agentId?: string
}

const stepTypeColors: Record<string, string> = {
  evaluation: 'bg-blue-50 border-blue-200',
  decision: 'bg-purple-50 border-purple-200',
  constraint_check: 'bg-orange-50 border-orange-200',
  tool_call: 'bg-green-50 border-green-200',
  result_analysis: 'bg-indigo-50 border-indigo-200',
}

const stepTypeIcons: Record<string, string> = {
  evaluation: '🔍',
  decision: '⚖️',
  constraint_check: '✓',
  tool_call: '🔧',
  result_analysis: '📊',
}

export function AgentExecutionViewer({
  isOpen,
  onClose,
  runId,
  agentId,
}: AgentExecutionViewerProps) {
  const [trace, setTrace] = useState<ExecutionTrace | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    input: true,
    reasoning: true,
    actions: true,
    results: true,
    errors: false,
  })

  useEffect(() => {
    if (!isOpen) return

    const fetchTrace = async () => {
      setLoading(true)
      try {
        const endpoint = runId
          ? `/api/agent/${agentId}/executions?run_id=${runId}`
          : `/api/agent/${agentId}/executions?limit=1`

        const res = await fetch(endpoint)
        const data = await res.json()

        if (data.success) {
          setTrace(runId ? data.data : data.data?.executions[0])
        }
      } catch (error) {
        console.error('Failed to fetch execution trace:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrace()
  }, [isOpen, runId, agentId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {trace?.agent_name || 'Agent Execution Trace'}
            </h2>
            {trace && (
              <p className="text-sm text-gray-500 mt-1">
                Run ID: <code className="bg-gray-100 px-2 py-1 rounded">{trace.run_id}</code>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="animate-spin inline-block mb-2" size={32} />
            <p>Loading execution trace...</p>
          </div>
        ) : trace ? (
          <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
            {/* Status & Timing */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                <div className="flex items-center mt-2">
                  {trace.status === 'completed' ? (
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                  ) : trace.status === 'error' || trace.status === 'failed' ? (
                    <AlertCircle size={16} className="text-red-600 mr-2" />
                  ) : (
                    <Clock size={16} className="text-yellow-600 mr-2" />
                  )}
                  <span className="text-sm font-medium capitalize">{trace.status}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 uppercase">Execution Time</p>
                <p className="text-sm font-medium mt-2">
                  {trace.execution_time_ms
                    ? `${(trace.execution_time_ms / 1000).toFixed(2)}s`
                    : 'N/A'}
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-gray-600 uppercase">Run At</p>
                <p className="text-sm font-medium mt-2">
                  {new Date(trace.start_time).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Input Data */}
            <ExpandableSection
              title="Input Data"
              isExpanded={expandedSections.input}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  input: !prev.input,
                }))
              }
            >
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(trace.input_data, null, 2)}
              </pre>
            </ExpandableSection>

            {/* Reasoning Steps */}
            <ExpandableSection
              title={`Reasoning Steps (${trace.reasoning_steps.length})`}
              isExpanded={expandedSections.reasoning}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  reasoning: !prev.reasoning,
                }))
              }
            >
              <div className="space-y-3">
                {trace.reasoning_steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`border-l-4 p-3 rounded ${
                      stepTypeColors[step.step_type] || 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-600 uppercase">
                          {stepTypeIcons[step.step_type]} {step.step_type}
                        </p>
                        <p className="text-sm mt-2 text-gray-800">{step.content}</p>
                      </div>
                      {step.confidence !== undefined && (
                        <div className="ml-4 text-right">
                          <p className="text-xs text-gray-500">Confidence</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {(step.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                    {step.metadata && Object.keys(step.metadata).length > 0 && (
                      <pre className="bg-white bg-opacity-50 p-2 rounded mt-2 text-xs overflow-x-auto">
                        {JSON.stringify(step.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ExpandableSection>

            {/* Actions */}
            <ExpandableSection
              title={`Actions Taken (${trace.actions.length})`}
              isExpanded={expandedSections.actions}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  actions: !prev.actions,
                }))
              }
            >
              <div className="space-y-3">
                {trace.actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 p-3 rounded-lg bg-white"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{action.action_type}</p>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          action.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : action.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {action.status}
                      </span>
                    </div>
                    {action.parameters && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-gray-600 cursor-pointer">
                          Parameters
                        </summary>
                        <pre className="bg-gray-50 p-2 rounded mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(action.parameters, null, 2)}
                        </pre>
                      </details>
                    )}
                    {action.result && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-gray-600 cursor-pointer">
                          Result
                        </summary>
                        <pre className="bg-gray-50 p-2 rounded mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(action.result, null, 2)}
                        </pre>
                      </details>
                    )}
                    {action.error && (
                      <div className="mt-2 bg-red-50 p-2 rounded text-xs text-red-800">
                        <p className="font-medium">Error: {action.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ExpandableSection>

            {/* Results */}
            <ExpandableSection
              title="Output Data"
              isExpanded={expandedSections.results}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  results: !prev.results,
                }))
              }
            >
              {trace.output_data ? (
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(trace.output_data, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-500">No output data</p>
              )}
            </ExpandableSection>

            {/* Errors */}
            {trace.errors && trace.errors.length > 0 && (
              <ExpandableSection
                title={`Errors (${trace.errors.length})`}
                isExpanded={expandedSections.errors}
                onToggle={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    errors: !prev.errors,
                  }))
                }
              >
                <div className="space-y-2">
                  {trace.errors.map((error, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-red-900">{error.error_type}</p>
                      <p className="text-sm text-red-800 mt-1">{error.error_message}</p>
                      <p className="text-xs text-red-600 mt-1">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </ExpandableSection>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle size={32} className="inline-block mb-2 text-gray-400" />
            <p>No execution trace found</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Expandable Section Helper Component
 */
function ExpandableSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
      >
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isExpanded && <div className="p-4 bg-white border-t border-gray-200">{children}</div>}
    </div>
  )
}
