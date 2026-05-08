/**
 * Follow-up Agent Reasoning Dashboard
 * Shows recent follow-up runs with per-lead reasoning and decision rationale
 */

'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface LeadEvaluation {
  lead_id: string
  phone: string
  status: 'triggered' | 'failed'
  error?: string
  description: string
  timestamp: string
}

interface ExecutionSummary {
  run_id: string
  start_time: string
  end_time?: string
  execution_time_ms?: number
  status: string
  reasoning_steps: Array<{
    timestamp: string
    step_type: string
    content: string
    confidence?: number
  }>
  leads_evaluated: LeadEvaluation[]
  summary?: {
    triggered_calls: number
    total_scanned: number
    success_rate: string
  }
  errors: Array<{
    timestamp: string
    message: string
    type: string
  }>
}

export function FollowupReasoningDashboard() {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({})
  const [expandedLeads, setExpandedLeads] = useState<Record<string, boolean>>({})
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetchExecutionHistory()
  }, [])

  const fetchExecutionHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/follow-ups/execution-history?limit=20&include_stats=true')
      const data = await res.json()

      if (data.success) {
        setExecutions(data.data.executions)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch execution history:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRunExpansion = (runId: string) => {
    setExpandedRuns((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }))
  }

  const toggleLeadExpansion = (leadId: string) => {
    setExpandedLeads((prev) => ({
      ...prev,
      [leadId]: !prev[leadId],
    }))
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Follow-up Agent Reasoning</h2>
          <p className="text-sm text-gray-600 mt-1">
            Detailed execution traces showing reasoning for each lead evaluation
          </p>
        </div>
        <button
          onClick={fetchExecutionHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Runs" value={stats.total_runs} />
          <StatCard label="Successful" value={stats.successful_runs} status="success" />
          <StatCard label="Failed" value={stats.failed_runs} status="error" />
          <StatCard
            label="Avg Execution Time"
            value={`${(stats.avg_execution_time_ms / 1000).toFixed(2)}s`}
          />
        </div>
      )}

      {/* Executions List */}
      <div className="space-y-4">
        {loading && executions.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-gray-500">
            <Clock className="animate-spin mr-2" />
            Loading execution history...
          </div>
        ) : executions.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-gray-500">
            <AlertCircle className="mr-2" />
            No execution history found
          </div>
        ) : (
          executions.map((execution) => (
            <ExecutionCard
              key={execution.run_id}
              execution={execution}
              isExpanded={expandedRuns[execution.run_id] || false}
              onToggle={() => toggleRunExpansion(execution.run_id)}
              expandedLeads={expandedLeads}
              onToggleLead={toggleLeadExpansion}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ExecutionCardProps {
  execution: ExecutionSummary
  isExpanded: boolean
  onToggle: () => void
  expandedLeads: Record<string, boolean>
  onToggleLead: (leadId: string) => void
}

function ExecutionCard({
  execution,
  isExpanded,
  onToggle,
  expandedLeads,
  onToggleLead,
}: ExecutionCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-shrink-0">
            {execution.status === 'completed' ? (
              <CheckCircle size={24} className="text-green-600" />
            ) : execution.status === 'error' ? (
              <AlertCircle size={24} className="text-red-600" />
            ) : (
              <Clock size={24} className="text-yellow-600" />
            )}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">
              Run at {new Date(execution.start_time).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">
              {execution.summary?.triggered_calls} calls triggered ·{' '}
              {execution.summary?.total_scanned} leads scanned ·{' '}
              {execution.summary?.success_rate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {execution.execution_time_ms && (
            <span className="text-sm text-gray-600">
              {(execution.execution_time_ms / 1000).toFixed(2)}s
            </span>
          )}
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          {/* Reasoning Steps */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Reasoning Process</h4>
            <div className="space-y-2">
              {execution.reasoning_steps.map((step, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 uppercase">
                        {step.step_type}
                      </p>
                      <p className="text-sm text-gray-800 mt-1">{step.content}</p>
                    </div>
                    {step.confidence !== undefined && (
                      <div className="text-right ml-2">
                        <p className="text-xs text-gray-500">Confidence</p>
                        <p className="font-semibold text-sm">
                          {(step.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leads Evaluated */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Lead Evaluations</h4>
            <div className="space-y-2">
              {execution.leads_evaluated.map((lead) => (
                <LeadEvaluationCard
                  key={lead.lead_id}
                  lead={lead}
                  isExpanded={expandedLeads[lead.lead_id] || false}
                  onToggle={() => onToggleLead(lead.lead_id)}
                />
              ))}
            </div>
          </div>

          {/* Errors if any */}
          {execution.errors.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-red-700">Errors</h4>
              <div className="space-y-2">
                {execution.errors.map((error, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 p-3 rounded">
                    <p className="font-medium text-red-900">{error.type}</p>
                    <p className="text-sm text-red-800 mt-1">{error.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface LeadEvaluationCardProps {
  lead: LeadEvaluation
  isExpanded: boolean
  onToggle: () => void
}

function LeadEvaluationCard({ lead, isExpanded, onToggle }: LeadEvaluationCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3 flex-1">
          {lead.status === 'triggered' ? (
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">{lead.phone}</p>
            <p className="text-xs text-gray-600">{lead.description}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-600">Lead ID</p>
              <p className="text-xs text-gray-800 font-mono">{lead.lead_id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600">Status</p>
              <p className="text-xs">
                <span
                  className={`inline-block px-2 py-1 rounded font-medium ${
                    lead.status === 'triggered'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {lead.status}
                </span>
              </p>
            </div>
          </div>
          {lead.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs font-medium text-red-900">Error</p>
              <p className="text-xs text-red-800 mt-1">{lead.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Stat Card Helper Component
 */
function StatCard({
  label,
  value,
  status,
}: {
  label: string
  value: string | number
  status?: 'success' | 'error'
}) {
  const bgColor =
    status === 'success'
      ? 'bg-green-50'
      : status === 'error'
      ? 'bg-red-50'
      : 'bg-gray-50'
  const textColor =
    status === 'success'
      ? 'text-green-900'
      : status === 'error'
      ? 'text-red-900'
      : 'text-gray-900'

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <p className="text-xs font-semibold text-gray-600 uppercase">{label}</p>
      <p className={`text-2xl font-bold ${textColor} mt-2`}>{value}</p>
    </div>
  )
}
