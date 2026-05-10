'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteClientAction } from '@/app/actions/clients'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Client } from '@/models/Client'
import { useState } from 'react'

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'converted':
      return 'success'
    case 'converting':
      return 'warning'
    case 'rejected':
      return 'destructive'
    case 'pending':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function ClientRow({
  client,
  canManage,
}: {
  client: Client
  canManage: boolean
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  const handleDelete = () => {
    if (!client._id) {
      toast.error('Client is missing an ID')
      return
    }

    startDeleteTransition(async () => {
      const result = await deleteClientAction(client._id!.toString())
      if (!result.ok) {
        toast.error(result.error || 'Failed to delete client')
        return
      }
      toast.success('Client deleted')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <tr className="transition-colors hover:bg-surface-2/50">
        <td className="px-4 py-3">
          <div className="font-medium text-ink">{client.name}</div>
          {client.email ? <div className="text-xs text-ink-3">{client.email}</div> : null}
        </td>
        <td className="px-4 py-3 text-ink-2">{client.phone}</td>
        <td className="px-4 py-3 text-ink-2 capitalize">{client.source.replace('_', ' ')}</td>
        <td className="px-4 py-3 text-ink-2">
          <div className="flex flex-wrap gap-1">
            {client.budget_range ? <Badge variant="outline" className="text-[10px]">{client.budget_range}</Badge> : null}
            {client.location_pref ? <Badge variant="outline" className="text-[10px]">{client.location_pref}</Badge> : null}
            {client.property_type ? <Badge variant="outline" className="text-[10px]">{client.property_type}</Badge> : null}
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant={getStatusBadgeVariant(client.conversion_status)} className="capitalize">
            {client.conversion_status}
          </Badge>
          {client.conversion_status === 'converted' && client.lead_score !== undefined ? (
            <span className="ml-2 text-xs font-medium text-ink-3">Score: {client.lead_score}</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-ink-3">
          {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
        </td>
        {canManage ? (
          <td className="px-4 py-3 text-right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-ink-3 hover:bg-red-50 hover:text-red-600"
              aria-label={`Delete ${client.name}`}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 size={16} strokeWidth={1.8} />
            </Button>
          </td>
        ) : null}
      </tr>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete client?"
        description={`This will remove ${client.name} from the clients list and related dashboard views.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
