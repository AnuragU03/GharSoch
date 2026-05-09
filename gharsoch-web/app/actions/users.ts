'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { userService, type BrokerageInput } from '@/lib/services/userService'

type ActionResult = { ok: true } | { ok: false; error: string }

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : 'User management action failed.'
}

async function withAdminAction(callback: (adminUserId: string) => Promise<void>): Promise<ActionResult> {
  try {
    const session = await requireRole(['admin'])
    await callback(session.user.id)
    revalidatePath('/settings/users')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: getMessage(error) }
  }
}

export async function promoteToBrokerAction(
  userId: string,
  brokerageInput: BrokerageInput
): Promise<ActionResult> {
  return withAdminAction(async (adminUserId) => {
    await userService.promoteToBroker(userId, brokerageInput, adminUserId)
  })
}

export async function promoteToTechAction(userId: string): Promise<ActionResult> {
  return withAdminAction(async (adminUserId) => {
    await userService.promoteToTech(userId, adminUserId)
  })
}

export async function promoteToAdminAction(userId: string): Promise<ActionResult> {
  return withAdminAction(async (adminUserId) => {
    await userService.promoteToAdmin(userId, adminUserId)
  })
}

export async function suspendUserAction(userId: string): Promise<ActionResult> {
  return withAdminAction(async (adminUserId) => {
    await userService.suspendUser(userId, adminUserId)
  })
}

export async function reinstateUserAction(userId: string): Promise<ActionResult> {
  return withAdminAction(async (adminUserId) => {
    await userService.reinstateUser(userId, adminUserId)
  })
}
