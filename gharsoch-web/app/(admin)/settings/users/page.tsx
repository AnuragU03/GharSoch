import { requireRole } from '@/lib/auth'
import { userService } from '@/lib/services/userService'
import { UserManagementSection } from '@/app/sections/UserManagementSection'

export const dynamic = 'force-dynamic'

type UserTab = 'pending' | 'active' | 'suspended'

const STATUS_BY_TAB = {
  pending: 'pending_approval',
  active: 'active',
  suspended: 'suspended',
} as const

function normalizeTab(value?: string): UserTab {
  if (value === 'active' || value === 'suspended') return value
  return 'pending'
}

function getAssistantOptions() {
  return [
    { label: 'Outbound', id: process.env.VAPI_ASSISTANT_OUTBOUND_ID || '' },
    { label: 'Inbound', id: process.env.VAPI_ASSISTANT_INBOUND_ID || '' },
    { label: 'Reminder', id: process.env.VAPI_ASSISTANT_REMINDER_ID || '' },
  ].filter((assistant) => Boolean(assistant.id))
}

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  await requireRole(['admin'])

  const activeTab = normalizeTab(searchParams.tab)
  const [users, brokerages, pendingCount] = await Promise.all([
    userService.listUsers({ status: STATUS_BY_TAB[activeTab] }),
    userService.listBrokerages(),
    userService.countPendingUsers(),
  ])

  return (
    <UserManagementSection
      users={users}
      brokerages={brokerages}
      assistantOptions={getAssistantOptions()}
      activeTab={activeTab}
      pendingCount={pendingCount}
    />
  )
}
