import OpenAI from 'openai'

export type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export type OpenAIChatResponse = {
  content: string
  raw: unknown
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    })
  }
  return client
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(status: number | undefined): boolean {
  if (!status) return false
  return status === 429 || (status >= 500 && status <= 599)
}

export async function openaiChatCompletion(opts: {
  model: string
  messages: OpenAIChatMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' } | { type: 'text' }
  timeoutMs?: number
  maxRetries?: number
}): Promise<OpenAIChatResponse> {
  const {
    model,
    messages,
    temperature,
    max_tokens,
    response_format,
    timeoutMs = 45_000,
    maxRetries = 2,
  } = opts

  const openai = getOpenAIClient()

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const completion = await openai.chat.completions.create(
        {
          model,
          messages,
          temperature,
          max_tokens,
          response_format,
        },
        { signal: controller.signal }
      )

      const content = completion.choices?.[0]?.message?.content ?? ''

      return {
        content,
        raw: completion,
        usage: completion.usage,
      }
    } catch (err: any) {
      lastErr = err

      const status = err?.status
      const retryable = isRetryableStatus(status)

      if (!retryable || attempt >= maxRetries) throw err

      // Basic exponential backoff w/ jitter
      const baseMs = 400 * Math.pow(2, attempt)
      const jitterMs = Math.floor(Math.random() * 200)
      await sleep(baseMs + jitterMs)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('OpenAI request failed')
}
