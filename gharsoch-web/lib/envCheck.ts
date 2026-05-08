/**
 * Env validation (runtime)
 *
 * Goals:
 * - Fail fast at runtime when required configuration is missing.
 * - Do NOT break `next build` (Phase Gates require builds to pass even without secrets).
 */

export type EnvCheckResult = {
  ok: boolean
  missing: string[]
}

function isBuildTime(): boolean {
  // Next.js sets NEXT_PHASE during build/export.
  const phase = process.env.NEXT_PHASE
  return phase === 'phase-production-build' || phase === 'phase-production-export'
}

function shouldValidateNow(): boolean {
  // Only validate on the server.
  if (typeof window !== 'undefined') return false

  // Do not break builds.
  if (isBuildTime()) return false

  // Unit tests commonly run without full env.
  if (process.env.NODE_ENV === 'test') return false

  return true
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'VAPI_API_KEY',
  'VAPI_PHONE_NUMBER_ID',
  'VAPI_ASSISTANT_OUTBOUND_ID',
  'VAPI_ASSISTANT_REMINDER_ID',
] as const

export function checkEnv(): EnvCheckResult {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = process.env[key]
    return !value || value.trim().length === 0
  })

  return { ok: missing.length === 0, missing: [...missing] }
}

export function validateEnv(): void {
  if (!shouldValidateNow()) return

  const result = checkEnv()
  if (result.ok) return

  // Do not leak any secret values; only list missing keys.
  throw new Error(
    `Missing required environment variables: ${result.missing.join(', ')}. ` +
      `Set them in your environment (or .env.local) before running the server.`
  )
}
