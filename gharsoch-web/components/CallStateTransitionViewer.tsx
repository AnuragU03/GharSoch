/**
 * Call State Transition Viewer Component
 * Timeline showing call → sync → validation → state update
 */

'use client'

import React, { useState } from 'react'
import { AlertCircle, CheckCircle, Clock, ArrowRight } from 'lucide-react'

interface StateTransition {
  _id?: string
  lead_id: string
  previous_state: {
    status: string
    qualification_status?: string
    interest_level?: string
    follow_up_required?: boolean
  }
  new_state: {
    status: string
    qualification_status?: string
    interest_level?: string
    follow_up_required?: boolean
  }
  trigger: {
    type: 'call_sync' | 'agent_action' | 'manual_update' | 'cron_job'
    agent_name?: string
    call_id?: string
    cron_job_name?: string
  }
  validation: {
    status: 'valid' | 'conflict' | 'needs_review'
    issues?: string[]
    corrections_applied?: Record<string, any>
  }
  created_at: string
}

interface CallStateTransitionViewerProps {
  transition: StateTransition
}

export function CallStateTransitionViewer({
  transition,
}: CallStateTransitionViewerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('validation')

  const validationStatusColors: Record<string, string> = {
    valid: 'text-green-600 bg-green-50 border-green-200',
    conflict: 'text-red-600 bg-red-50 border-red-200',
    needs_review: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">State Transition Timeline</p>
            <p className="text-xs text-gray-600 mt-1">
              Lead ID: <code className="bg-white px-2 py-1 rounded">{transition.lead_id}</code>
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {new Date(transition.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 space-y-6">
        {/* Trigger */}
        <TimelineStep
          step={1}
          title="Trigger"
          isOpen={expandedSection === 'trigger'}
          onToggle={() => setExpandedSection(
            expandedSection === 'trigger' ? null : 'trigger'
          )}
          icon={<Clock size={20} className="text-blue-600" />}
          content={
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">Type:</p>
                <p className="text-gray-600 capitalize">{transition.trigger.type}</p>
              </div>
              {transition.trigger.agent_name && (
                <div>
                  <p className="font-medium text-gray-900">Agent:</p>
                  <p className="text-gray-600">{transition.trigger.agent_name}</p>
                </div>
              )}
              {transition.trigger.call_id && (
                <div>
                  <p className="font-medium text-gray-900">Call ID:</p>
                  <p className="text-gray-600 font-mono text-xs">
                    {transition.trigger.call_id}
                  </p>
                </div>
              )}
              {transition.trigger.cron_job_name && (
                <div>
                  <p className="font-medium text-gray-900">Cron Job:</p>
                  <p className="text-gray-600">{transition.trigger.cron_job_name}</p>
                </div>
              )}
            </div>
          }
        />

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight size={24} className="text-gray-300 transform rotate-90" />
        </div>

        {/* Previous State */}
        <StateCard
          title="Previous State"
          state={transition.previous_state}
          isOpen={expandedSection === 'previous'}
          onToggle={() => setExpandedSection(
            expandedSection === 'previous' ? null : 'previous'
          )}
        />

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight size={24} className="text-gray-300 transform rotate-90" />
        </div>

        {/* Validation */}
        <TimelineStep
          step={2}
          title="Validator Review"
          isOpen={expandedSection === 'validation'}
          onToggle={() => setExpandedSection(
            expandedSection === 'validation' ? null : 'validation'
          )}
          icon={
            transition.validation.status === 'valid' ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : transition.validation.status === 'conflict' ? (
              <AlertCircle size={20} className="text-red-600" />
            ) : (
              <Clock size={20} className="text-yellow-600" />
            )
          }
          content={
            <div className="space-y-3">
              <div
                className={`border rounded-lg p-3 ${
                  validationStatusColors[transition.validation.status]
                }`}
              >
                <p className="font-semibold capitalize">
                  Status: {transition.validation.status}
                </p>
              </div>

              {transition.validation.issues && transition.validation.issues.length > 0 && (
                <div>
                  <p className="font-medium text-gray-900">Issues Found:</p>
                  <ul className="mt-2 space-y-1">
                    {transition.validation.issues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-red-700 flex gap-2">
                        <span className="font-bold">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {transition.validation.corrections_applied &&
                Object.keys(transition.validation.corrections_applied).length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900">Corrections Applied:</p>
                    <div className="mt-2 bg-white bg-opacity-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      {JSON.stringify(transition.validation.corrections_applied, null, 2)}
                    </div>
                  </div>
                )}
            </div>
          }
        />

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight size={24} className="text-gray-300 transform rotate-90" />
        </div>

        {/* New State */}
        <StateCard
          title="New State"
          state={transition.new_state}
          isOpen={expandedSection === 'new'}
          onToggle={() => setExpandedSection(
            expandedSection === 'new' ? null : 'new'
          )}
        />
      </div>
    </div>
  )
}

/**
 * Timeline Step Component
 */
function TimelineStep({
  step,
  title,
  isOpen,
  onToggle,
  icon,
  content,
}: {
  step: number
  title: string
  isOpen: boolean
  onToggle: () => void
  icon: React.ReactNode
  content: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition"
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-100">
          {icon}
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-gray-900">{title}</p>
        </div>
      </button>
      {isOpen && (
        <div className="ml-11 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {content}
        </div>
      )}
    </div>
  )
}

/**
 * State Card Component
 */
function StateCard({
  title,
  state,
  isOpen,
  onToggle,
}: {
  title: string
  state: Record<string, any>
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
      >
        <p className="font-semibold text-gray-900">{title}</p>
        <span className="text-sm text-gray-600">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="space-y-2 text-sm">
            {Object.entries(state).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <p className="font-medium text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </p>
                <p className="text-gray-900 font-mono">
                  {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
