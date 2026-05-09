'use server'

import { runMatchmaker } from '@/lib/agents/matchmaker'
import { requireRole } from '@/lib/auth'
// Note: we can import other agents here as needed

export async function forceRunAgent(agent: string) {
  await requireRole(['admin', 'tech'])
  // Phase 11.5: scope manual agent runs to session.user.brokerage_id when multi-tenant lands.
  if (agent === 'matchmaker') {
    await runMatchmaker()
  } else {
    // Other agents could be wired here
    console.log('Force run not implemented for agent:', agent)
  }
}
