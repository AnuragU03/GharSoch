'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import {
  promoteToAdminAction,
  promoteToTechAction,
  reinstateUserAction,
  suspendUserAction,
} from '@/app/actions/users'
import { Pill, type PillVariant } from '@/components/Pill'
import {
  PromoteToBrokerModal,
  type AssistantOption,
} from '@/components/modals/PromoteToBrokerModal'
import { toast } from '@/lib/toast'
import type { SerializedBrokerage, SerializedUser } from '@/lib/services/userService'

type UserTab = 'pending' | 'active' | 'suspended'

const TABS: { key: UserTab; label: string; status: string }[] = [
  { key: 'pending', label: 'Pending approval', status: 'pending_approval' },
  { key: 'active', label: 'Active users', status: 'active' },
  { key: 'suspended', label: 'Suspended', status: 'suspended' },
]

function roleVariant(role: string): PillVariant {
  if (role === 'admin') return 'violet'
  if (role === 'tech') return 'warm'
  return 'idle'
}

function statusVariant(status: string): PillVariant {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'failed'
  return 'amber'
}

function formatRelative(value: string) {
  if (!value) return 'Never'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function initials(name: string, email: string) {
  const source = name || email || 'User'
  return source
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function UserAvatar({ user }: { user: SerializedUser }) {
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={`${user.name || user.email} avatar`}
        className="avatar"
        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }}
      />
    )
  }

  return <div className="avatar" style={{ width: 36, height: 36 }}>{initials(user.name, user.email)}</div>
}

function ActionButton({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={tone === 'danger' ? 'btn ghost text-red' : 'btn ghost'}
      style={{ minHeight: 30, padding: '6px 9px', fontSize: 12 }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function UserManagementSection({
  users,
  brokerages,
  assistantOptions,
  activeTab,
  pendingCount,
}: {
  users: SerializedUser[]
  brokerages: SerializedBrokerage[]
  assistantOptions: AssistantOption[]
  activeTab: UserTab
  pendingCount: number
}) {
  const router = useRouter()
  const [brokerModalUser, setBrokerModalUser] = useState<SerializedUser | null>(null)
  const [isPending, startTransition] = useTransition()

  const runAction = (message: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error || "You don't have permission for this action.")
        return
      }

      toast.success(message)
      router.refresh()
    })
  }

  return (
    <>
      <section className="page active">
        <div className="crumb">Settings · Users</div>
        <div className="head">
          <div>
            <h1 className="title">User management</h1>
            <p className="sub">Approve new signups, manage roles, and oversee active sessions.</p>
          </div>
          <div className="actions">
            <Link href="/settings" className="btn">
              Back to settings
            </Link>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="User status">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/settings/users?tab=${tab.key}`}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 ? (
                <span
                  className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-soft px-1.5 py-0.5 text-[10px] font-semibold text-red"
                  aria-label={`${pendingCount} pending approvals`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">
                {TABS.find((tab) => tab.key === activeTab)?.label}
              </div>
              <div className="panel-sub">
                {activeTab === 'pending'
                  ? 'New Google signups waiting for an admin decision.'
                  : activeTab === 'active'
                    ? 'Users who can currently access the Operations Center.'
                    : 'Users blocked from accessing the workspace.'}
              </div>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Signup / login</th>
                <th>Role</th>
                <th>Status</th>
                <th>Brokerage</th>
                <th style={{ width: 300 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>
                    No users in this tab yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div>
                          <div className="name">{user.name || 'Unnamed user'}</div>
                          <div className="meta">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="name">{formatRelative(user.created_at)}</div>
                      <div className="meta">Last login {formatRelative(user.last_login_at)}</div>
                    </td>
                    <td>
                      <Pill variant={roleVariant(user.role)}>{user.role}</Pill>
                    </td>
                    <td>
                      <Pill variant={statusVariant(user.status)}>{user.status.replace('_', ' ')}</Pill>
                    </td>
                    <td>
                      <div className="name">{user.brokerage?.name || '—'}</div>
                      {user.brokerage?.city ? <div className="meta">{user.brokerage.city}</div> : null}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {activeTab === 'pending' ? (
                          <>
                            <ActionButton disabled={isPending} onClick={() => setBrokerModalUser(user)}>
                              Promote to broker
                            </ActionButton>
                            <ActionButton
                              disabled={isPending}
                              onClick={() => runAction(`${user.name || user.email} promoted to tech`, () => promoteToTechAction(user._id))}
                            >
                              Promote to tech
                            </ActionButton>
                            <ActionButton
                              disabled={isPending}
                              onClick={() => runAction(`${user.name || user.email} promoted to admin`, () => promoteToAdminAction(user._id))}
                            >
                              Promote to admin
                            </ActionButton>
                            <ActionButton
                              tone="danger"
                              disabled={isPending}
                              onClick={() => runAction(`${user.name || user.email} suspended`, () => suspendUserAction(user._id))}
                            >
                              Suspend
                            </ActionButton>
                          </>
                        ) : activeTab === 'active' ? (
                          <ActionButton
                            tone="danger"
                            disabled={isPending}
                            onClick={() => runAction(`${user.name || user.email} suspended`, () => suspendUserAction(user._id))}
                          >
                            Suspend
                          </ActionButton>
                        ) : (
                          <ActionButton
                            disabled={isPending}
                            onClick={() => runAction(`${user.name || user.email} reinstated`, () => reinstateUserAction(user._id))}
                          >
                            Reinstate
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PromoteToBrokerModal
        user={brokerModalUser}
        brokerages={brokerages}
        assistantOptions={assistantOptions}
        open={Boolean(brokerModalUser)}
        onClose={() => {
          setBrokerModalUser(null)
          router.refresh()
        }}
      />
    </>
  )
}
