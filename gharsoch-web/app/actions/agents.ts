'use server'

import { runMatchmaker } from '@/lib/agents/matchmaker'
// Note: we can import other agents here as needed

export async function forceRunAgent(agent: string) {
  if (agent === 'matchmaker') {
    await runMatchmaker()
  } else {
    // Other agents could be wired here
    console.log('Force run not implemented for agent:', agent)
  }
}
