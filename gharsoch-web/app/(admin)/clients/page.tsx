import { clientService } from '@/lib/services/clientService';
import { ClientsSection } from '@/app/sections/ClientsSection';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { status?: string; source?: string };
}) {
  const clients = await clientService.listClients({
    status: searchParams.status,
    source: searchParams.source,
  });

  return <ClientsSection initialClients={clients} />;
}
