'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { NewClientModal } from '@/components/modals/NewClientModal';
import { Client } from '@/models/Client';
import { useUserRole } from '@/lib/auth/useUserRole';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Converting', value: 'converting' },
  { label: 'Converted', value: 'converted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Pending', value: 'pending' },
];

export function ClientsSection({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || '';
  const [modalOpen, setModalOpen] = useState(false);
  const { role } = useUserRole();
  const canAdd = role === 'admin' || role === 'tech';

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`/clients?${params.toString()}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'converted': return 'success';
      case 'converting': return 'warning';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clients</h1>
          <p className="text-sm text-ink-3">Raw prospects before qualification</p>
        </div>
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow hover:bg-accent/90 transition-colors"
          >
            + New Client
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-hairline px-6 py-3">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleStatusFilter(filter.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              currentStatus === filter.value
                ? 'bg-ink text-white'
                : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Preferences</th>
                <th className="px-4 py-3 font-medium">Conversion</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {initialClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                    No clients found matching the criteria.
                  </td>
                </tr>
              ) : (
                initialClients.map((client) => (
                  <tr key={client._id?.toString()} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{client.name}</div>
                      {client.email && <div className="text-xs text-ink-3">{client.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{client.phone}</td>
                    <td className="px-4 py-3 text-ink-2 capitalize">{client.source.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-ink-2">
                      <div className="flex flex-wrap gap-1">
                        {client.budget_range && <Badge variant="outline" className="text-[10px]">{client.budget_range}</Badge>}
                        {client.location_pref && <Badge variant="outline" className="text-[10px]">{client.location_pref}</Badge>}
                        {client.property_type && <Badge variant="outline" className="text-[10px]">{client.property_type}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(client.conversion_status)} className="capitalize">
                        {client.conversion_status}
                      </Badge>
                      {client.conversion_status === 'converted' && client.lead_score !== undefined && (
                        <span className="ml-2 text-xs font-medium text-ink-3">Score: {client.lead_score}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-3">
                      {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export default ClientsSection;
