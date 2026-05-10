'use server';

import { revalidatePath } from 'next/cache';

import { runClientLeadConverter } from '@/lib/agents/clientLeadConverter';
import { runMatchmakerForLead } from '@/lib/agents/matchmaker';
import { requireRole } from '@/lib/auth';
import { clientService } from '@/lib/services/clientService';

export async function createClientAction(formData: FormData) {
  await requireRole(['admin', 'tech']);
  // Phase 11.5: stamp and filter clients by session.user.brokerage_id.
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string | null;
  const source = formData.get('source') as string;
  const property_type = formData.get('property_type') as string;
  const budget_range = formData.get('budget_range') as string;
  const location_pref = formData.get('location_pref') as string;
  const notes = formData.get('notes') as string | null;

  if (!name || !phone) {
    return { success: false, error: 'Name and phone are required.' };
  }

  const payload = {
    name,
    phone,
    email: email || '',
    source: source || 'manual',
    property_type: property_type || '',
    budget_range: budget_range || '',
    location_pref: location_pref || '',
    notes: notes || '',
  };

  try {
    const existingClients = await clientService.listClients({ limit: 1000 });
    if (existingClients.some((client) => client.phone === phone)) {
      return { success: false, error: 'A client with this phone number already exists.' };
    }

    const client = await clientService.createClient(payload);

    queueMicrotask(async () => {
      try {
        const result = await runClientLeadConverter(client._id!.toString());
        if (result.lead_id && !result.rejected && result.score && result.score >= 60) {
          await runMatchmakerForLead(result.lead_id);
        }
      } catch (error) {
        console.error('Converter pipeline failed:', error);
      }
    });

    revalidatePath('/clients');
    revalidatePath('/ai-operations');

    return { success: true };
  } catch (error: any) {
    console.error('Server action error:', error);
    return { success: false, error: 'Internal server error during client creation.' };
  }
}
