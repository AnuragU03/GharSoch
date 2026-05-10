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

export interface ValidateEnvOpts {
  checkAdminBootstrap?: boolean
}

export async function validateEnv(opts?: ValidateEnvOpts): Promise<void> {
  if (!shouldValidateNow()) return

  if (!process.env.OUTBOUND_COOLDOWN_MINUTES) {
    process.env.OUTBOUND_COOLDOWN_MINUTES = '240'
  }

  if (process.env.NODE_ENV === 'production' && !process.env.VAPI_WEBHOOK_SECRET) {
    console.warn('[BOOT] VAPI_WEBHOOK_SECRET not set — webhook signature validation disabled. Set VAPI_WEBHOOK_SECRET + configure on Vapi assistants to enable.')
  }

  // 1. Synchronous env var check (fast, no I/O)
  const result = checkEnv()
  if (!result.ok) {
    throw new Error(
      `Missing required environment variables: ${result.missing.join(', ')}. ` +
        `Set them in your environment (or .env.local) before running the server.`
    )
  }

  // 2. Optional async admin bootstrap check (requires DB)
  if (opts?.checkAdminBootstrap) {
    try {
      await validateAdminBootstrap()
    } catch (err) {
      if (process.env.NODE_ENV === 'production') throw err
      // In dev, warn but do not crash the server — dev env may not have DB yet
      console.warn(
        '[BOOT] Admin bootstrap check failed (non-fatal in dev):',
        err instanceof Error ? err.message : err
      )
    }
  }
}

/**
 * validateAdminBootstrap — async, called once per cold boot via validateEnv().
 *
 * Two distinct cases:
 *   A) BOOTSTRAP_ADMIN_EMAIL is SET → log info if no admin yet (first-boot notice)
 *   B) BOOTSTRAP_ADMIN_EMAIL is UNSET AND no admin exists → throw (lockout prevention)
 *   C) admin exists in DB → silent (all good regardless of env var)
 *
 * Mongo errors are caught and warned — a Cosmos blip at boot must not crash the server.
 *
 * NOTE: cron-triggered agent runs are NOT affected by this check —
 * they use x-cron-secret and operate on system behalf, independent of any user.
 */
export async function validateAdminBootstrap(): Promise<void> {
  if (!shouldValidateNow()) return

  try {
    const { getCollection } = await import('@/lib/mongodb')
    const users = await getCollection('users')
    const adminCount = await users.countDocuments({ role: 'admin', status: 'active' })

    if (adminCount >= 1) return // admin exists — all good, silent

    // No active admin found
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()

    if (bootstrapEmail) {
      // Email is configured — first sign-in will auto-promote; this is expected on fresh deploy
      console.log(
        `[BOOT] No admin user yet. First sign-in by ${bootstrapEmail} will be auto-promoted to admin.`
      )
      return
    }

    // No email AND no admin — production lockout risk
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL must be set when no admin user exists. ' +
        'Set to anurag.ugargol@gm.com in your .env or Azure App Service config. ' +
        'This prevents admin lockout on first deploy.'
    )
  } catch (err) {
    // Re-throw our own lockout error — it must propagate
    if (err instanceof Error && err.message.includes('BOOTSTRAP_ADMIN_EMAIL')) throw err
    // Any other error (Cosmos unreachable, timeout, etc.) — warn and continue
    console.warn('[BOOT] Could not verify admin bootstrap state (DB may be unreachable):', err)
  }
}

