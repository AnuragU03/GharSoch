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
  // Phase 11 — Auth
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
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

/**
 * validateAdminBootstrap — async, run once at server startup.
 *
 * If BOOTSTRAP_ADMIN_EMAIL is not set AND no admin user exists in the DB,
 * we throw a hard error to prevent a production lockout scenario.
 *
 * NOTE: cron-triggered agent runs are NOT blocked by this check —
 * they use x-cron-secret and do not depend on the admin user existing.
 */
export async function validateAdminBootstrap(): Promise<void> {
  if (!shouldValidateNow()) return

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL
  if (bootstrapEmail && bootstrapEmail.trim().length > 0) return // all good

  // No BOOTSTRAP_ADMIN_EMAIL set — check if an admin already exists in DB
  try {
    const { getCollection } = await import('@/lib/mongodb')
    const users = await getCollection('users')
    const adminExists = await users.findOne({ role: 'admin', status: 'active' })
    if (adminExists) return // existing admin, no lockout risk

    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL must be set when no admin user exists. ' +
        'Add BOOTSTRAP_ADMIN_EMAIL=your@email.com to your .env file. ' +
        'This prevents admin lockout on first deploy.'
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes('BOOTSTRAP_ADMIN_EMAIL')) throw err
    // DB connection error during bootstrap check — warn but don't block startup
    console.warn('[envCheck] Could not verify admin bootstrap state:', err)
  }
}
