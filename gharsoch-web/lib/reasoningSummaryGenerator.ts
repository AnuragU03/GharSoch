import { agentLogger, type AgentExecutionTrace } from '@/lib/agentLogger'
import { getCollection } from '@/lib/mongodb'
import { openaiChatCompletion } from '@/lib/openaiClient'

type GeneratedReasoningSummary = {
  summary: string
  confidence: number
}

const SUMMARY_SYSTEM_PROMPT =
  'Summarize this agent run in 2-3 sentences for a non-technical admin. Focus on: what the agent decided and why. Confidence score 0-1. Return JSON: { summary: string, confidence: number }'

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.5
  }

  return Math.min(1, Math.max(0, value))
}

function truncateForSummary(input: string, maxChars = 12_000) {
  if (input.length <= maxChars) {
    return input
  }

  return `${input.slice(0, maxChars)}\n\n[truncated]`
}

function buildSummaryInput(run: AgentExecutionTrace) {
  return truncateForSummary(
    JSON.stringify(
      {
        agent_name: run.agent_name,
        status: run.status,
        reasoning_steps: run.reasoning_steps?.map((step) => ({
          step_type: step.step_type,
          content: step.content,
          confidence: step.confidence,
        })),
        actions: run.actions?.map((action) => ({
          action_type: action.action_type,
          description: action.description,
          status: action.status,
          error: action.error,
          result: action.result,
        })),
        output: run.output_data || {},
      },
      null,
      2
    )
  )
}

function parseSummaryResponse(content: string): GeneratedReasoningSummary {
  const parsed = JSON.parse(content)

  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0) {
    throw new Error('Summary response did not include a summary')
  }

  return {
    summary: parsed.summary.trim(),
    confidence: clampConfidence(parsed.confidence),
  }
}

class ReasoningSummaryGenerator {
  async generate(runId: string): Promise<void> {
    const collection = await getCollection<AgentExecutionTrace>('agent_execution_logs')
    const run = await collection.findOne({ run_id: runId })

    if (!run) {
      throw new Error(`Agent run not found: ${runId}`)
    }

    const { content } = await openaiChatCompletion({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 300,
      timeoutMs: 8_000,
      maxRetries: 0,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: buildSummaryInput(run) },
      ],
    })

    const summary = parseSummaryResponse(content)
    await agentLogger.attachSummary(runId, {
      ...summary,
      generated_at: new Date().toISOString(),
    })
  }
}

export const reasoningSummaryGenerator = new ReasoningSummaryGenerator()
