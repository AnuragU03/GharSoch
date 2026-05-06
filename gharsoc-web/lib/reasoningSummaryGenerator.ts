/**
 * Agent Reasoning Summary Generator
 * Generates human-readable explanations of agent reasoning and decisions
 * Can be called after agent actions to provide context
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

interface ReasoningSummaryRequest {
  agent_name: string
  action_type: string
  reasoning_steps: Array<{ step_type: string; content: string; confidence?: number }>
  action_description: string
  action_result?: Record<string, any>
  context?: Record<string, any>
}

interface ReasoningSummary {
  summary: string
  key_insights: string[]
  confidence: number
  implications: string
}

class ReasoningSummaryGenerator {
  /**
   * Generate human-readable explanation of agent reasoning
   */
  async generateSummary(request: ReasoningSummaryRequest): Promise<ReasoningSummary> {
    try {
      const prompt = this.buildSummaryPrompt(request)

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at explaining AI agent decision-making in clear, concise language.
Analyze the agent's reasoning steps and actions, then provide:
1. A one-sentence summary of what the agent decided and why
2. Key insights from the reasoning process (3-5 bullet points)
3. Implications or next steps based on this decision

Format your response as valid JSON with keys: summary, key_insights (array), implications`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      })

      const responseContent = completion.choices[0].message.content
      if (!responseContent) {
        throw new Error('No response from OpenAI')
      }

      const parsed = JSON.parse(responseContent)
      return {
        summary: parsed.summary || '',
        key_insights: parsed.key_insights || [],
        confidence: 0.9,
        implications: parsed.implications || '',
      }
    } catch (error) {
      console.error('[ReasoningSummaryGenerator] Error:', error)
      return {
        summary: `${request.agent_name} performed action: ${request.action_type}`,
        key_insights: [request.action_description],
        confidence: 0.5,
        implications: 'Unable to generate detailed analysis',
      }
    }
  }

  /**
   * Build prompt for reasoning analysis
   */
  private buildSummaryPrompt(request: ReasoningSummaryRequest): string {
    return `
AGENT: ${request.agent_name}
ACTION TYPE: ${request.action_type}

REASONING PROCESS:
${request.reasoning_steps
  .map(
    (step, idx) =>
      `${idx + 1}. [${step.step_type.toUpperCase()}] ${step.content}${
        step.confidence ? ` (Confidence: ${(step.confidence * 100).toFixed(0)}%)` : ''
      }`
  )
  .join('\n')}

ACTION TAKEN:
${request.action_description}

${request.action_result ? `ACTION RESULT:\n${JSON.stringify(request.action_result, null, 2)}\n` : ''}

${request.context ? `CONTEXT:\n${JSON.stringify(request.context, null, 2)}\n` : ''}

Please explain this agent's decision-making in plain language.
`
  }
}

export const reasoningSummaryGenerator = new ReasoningSummaryGenerator()
