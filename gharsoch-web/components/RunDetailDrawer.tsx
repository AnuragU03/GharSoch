'use client'

import { Suspense, useEffect } from 'react'

import { Pill, type PillVariant } from '@/components/Pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { AgentAction, ReasoningStep } from '@/lib/agentLogger'
import type { AgentDashboardRun } from '@/lib/services/agentDashboardService'

function classifyStep(stepType: string) {
  const normalized = stepType.toLowerCase()

  if (normalized.includes('decision') || normalized.includes('result')) {
    return 'decision'
  }

  if (normalized.includes('tool')) {
    return 'tool'
  }

  return 'eval'
}

function normalizeActionKind(action: AgentAction) {
  const type = action.action_type.toLowerCase()

  if (type.includes('openai')) return 'openai_call'
  if (type.includes('kb')) return 'kb_query'
  if (type.includes('vapi')) return 'vapi_call'
  if (type.includes('mongo')) return 'mongo_write'
  return action.action_type
}

function extractTranscriptLines(run: AgentDashboardRun | null) {
  const transcript = run?.input_data?.transcript || run?.output_data?.transcript || run?.output_data?.transcript_excerpt

  if (!transcript) {
    return []
  }

  if (Array.isArray(transcript)) {
    return transcript
      .map((entry) => {
        if (typeof entry === 'string') {
          return { speaker: 'Agent', text: entry }
        }

        if (entry && typeof entry === 'object') {
          return {
            speaker: String(entry.speaker || entry.role || 'Agent'),
            text: String(entry.text || entry.content || ''),
          }
        }

        return null
      })
      .filter((entry): entry is { speaker: string; text: string } => Boolean(entry && entry.text))
  }

  if (typeof transcript === 'string') {
    return transcript
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [speaker, ...rest] = line.split(':')
        if (rest.length === 0) {
          return { speaker: 'Agent', text: line }
        }

        return { speaker: speaker.trim(), text: rest.join(':').trim() }
      })
  }

  return []
}

function isVoiceCallReportRun(run: AgentDashboardRun | null) {
  return run?.agent_id === 'voice_orchestrator' && run?.input_data?.webhook_type === 'end-of-call-report'
}

function confidenceVariant(confidence: number): PillVariant {
  if (confidence >= 0.8) return 'success'
  if (confidence >= 0.6) return 'amber'
  return 'failed'
}

function RunDetailSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((section) => (
        <div className="drawer-section" key={section}>
          <Skeleton className="mb-4 h-4 w-28" />
          <Skeleton className="mb-2 h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}

function ReasoningSummarySection({ run }: { run: AgentDashboardRun }) {
  const summary = run.reasoning_summary

  if (summary?.summary) {
    return (
      <div className="step">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="kind">Generated summary</div>
          <Pill variant={confidenceVariant(summary.confidence)}>
            Confidence {summary.confidence.toFixed(2)}
          </Pill>
        </div>
        <p className="m-0 text-[13px] leading-6 text-ink-2">{summary.summary}</p>
      </div>
    )
  }

  if (run.summary_failed) {
    return (
      <div className="step">
        <div className="kind">Summary generation failed</div>
        <p className="m-0 text-[13px] text-ink-3">Summary generation failed.</p>
        {run.summary_error ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] text-ink-2">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap text-[11.5px] leading-5 text-ink-3">{run.summary_error}</pre>
          </details>
        ) : null}
      </div>
    )
  }

  return (
    <div className="step">
      <div className="kind">Generating summary...</div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
    </div>
  )
}

function RunDetailBody({ run }: { run: AgentDashboardRun | null }) {
  if (!run) {
    return <RunDetailSkeleton />
  }

  const transcriptLines = extractTranscriptLines(run)
  const showVoiceCallReportTranscript = isVoiceCallReportRun(run) && transcriptLines.length > 0

  return (
    <div className="drawer">
      <div className="drawer-section">
        <h4>Input</h4>
        <pre className="code">{JSON.stringify(run.input_data || {}, null, 2)}</pre>
      </div>

      {showVoiceCallReportTranscript ? (
        <div className="drawer-section">
          <h4>Call transcript</h4>
          {transcriptLines.map((line, index) => {
            const isCustomer = /customer|cust|lead|buyer|client|user/i.test(line.speaker)
            return (
              <div className={`transcript-line${isCustomer ? ' cust' : ''}`} key={`${line.speaker}-${index}`}>
                <b>{line.speaker}:</b> {line.text}
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="drawer-section">
        <h4>Reasoning steps</h4>
        {run.reasoning_steps.length > 0 ? (
          run.reasoning_steps.map((step: ReasoningStep, index) => (
            <div className={`step ${classifyStep(step.step_type)}`} key={`${step.timestamp}-${index}`}>
              <div className="kind">{step.step_type}</div>
              <div>{step.content}</div>
            </div>
          ))
        ) : (
          <div className="step eval">
            <div className="kind">evaluation</div>
            No reasoning steps were recorded for this run.
          </div>
        )}
      </div>

      <div className="drawer-section">
        <h4>Actions</h4>
        {run.actions.length > 0 ? (
          run.actions.map((action, index) => {
            const kind = normalizeActionKind(action)
            return (
              <div className="step tool" key={`${action.timestamp}-${index}`}>
                <div className="kind">{kind}</div>
                <div>{action.description}</div>
                {kind === 'kb_query' && action.parameters && (
                  <div className="mt-2 text-xs">
                    <div className="mb-1">
                      <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[10px]">{action.parameters.collection || 'KB'}</span>
                      <span className="ml-2 text-ink-3">Hits: {action.result?.hit_count ?? 0}</span>
                    </div>
                    <pre className="mb-2 max-h-20 overflow-auto rounded bg-surface-2 p-2 text-[10px] text-ink-2">{JSON.stringify(action.parameters.filter || action.parameters.query || {}, null, 2)}</pre>
                    {action.result?.results_preview && Array.isArray(action.result.results_preview) && action.result.results_preview.length > 0 && (
                      <table className="w-full text-[11px]">
                        <tbody>
                          {action.result.results_preview.map((preview: any, i: number) => (
                            <tr key={i} className="border-t border-hairline">
                              <td className="py-1 text-ink-2 truncate max-w-[120px]">{preview.name}</td>
                              <td className="py-1 text-right text-ink-3 w-16">{preview.score}</td>
                              <td className="py-1 w-12"><div className="h-1 bg-surface-3 rounded overflow-hidden"><div className="h-full bg-ink" style={{ width: `${preview.score || 0}%` }} /></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="step tool">
            <div className="kind">mongo_write</div>
            No tracked actions were recorded for this run.
          </div>
        )}
      </div>

      <div className="drawer-section">
        <h4>Reasoning summary</h4>
        <ReasoningSummarySection run={run} />
      </div>

      <div className="drawer-section">
        <h4>Output</h4>
        <pre className="code">{JSON.stringify(run.output_data || {}, null, 2)}</pre>
      </div>

      {transcriptLines.length > 0 && !showVoiceCallReportTranscript ? (
        <div className="drawer-section">
          <h4>Transcript excerpt</h4>
          {transcriptLines.map((line, index) => {
            const isCustomer = /customer|cust|lead|buyer|client|user/i.test(line.speaker)
            return (
              <div className={`transcript-line${isCustomer ? ' cust' : ''}`} key={`${line.speaker}-${index}`}>
                <b>{line.speaker}:</b> {line.text}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function RunDetailDrawer({
  open,
  onOpenChange,
  run,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: AgentDashboardRun | null
}) {
  const drawerTitle = run ? `${run.agent_name} - ${run.started_at}` : 'Run detail'

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[560px] max-w-[92vw] overflow-y-auto border-hairline bg-surface p-0 shadow-elev-2"
      >
        <div className="drawer-head">
          <div>
            <SheetTitle className="m-0 text-[16px] font-semibold text-ink">{drawerTitle}</SheetTitle>
            <div className="runid">run_id: {run?.run_id || 'loading'}</div>
          </div>
        </div>

        <Suspense fallback={<RunDetailSkeleton />}>
          <RunDetailBody run={run} />
        </Suspense>
      </SheetContent>
    </Sheet>
  )
}
