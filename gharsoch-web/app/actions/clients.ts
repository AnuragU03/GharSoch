'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { runClientLeadConverter } from '@/lib/agents/clientLeadConverter';
import { runMatchmakerForLead } from '@/lib/agents/matchmaker';
import { requireRole } from '@/lib/auth';
import { getCollection } from '@/lib/mongodb';
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

export async function updateClientAction(formData: FormData) {
  await requireRole(['admin', 'tech']);
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Client ID is required.' };

  const payload: any = {};
  const fields = ['name', 'phone', 'email', 'source', 'property_type', 'budget_range', 'location_pref', 'notes', 'conversion_status'];

  fields.forEach(field => {
    const val = formData.get(field);
    if (val !== null) payload[field] = val;
  });

  try {
    await clientService.updateClient(id, payload);
    revalidatePath('/clients');
    revalidatePath('/ai-operations');
    return { success: true };
  } catch (error: any) {
    console.error('Update client error:', error);
    return { success: false, error: 'Failed to update client.' };
  }
}

export async function deleteClientAction(clientId: string) {
  await requireRole(['admin', 'tech']);
  if (!ObjectId.isValid(clientId)) {
    return { ok: false, error: 'Invalid client ID' };
  }
  try {
    const col = await getCollection('clients');
    const result = await col.updateOne(
      { _id: new ObjectId(clientId) },
      {
        $set: {
          deleted_at: new Date(),
          status: 'archived',
          updated_at: new Date(),
        },
      }
    );
    if (result.matchedCount === 0) {
      return { ok: false, error: 'Client not found' };
    }
    revalidatePath('/clients');
    revalidatePath('/ai-operations');
    return { ok: true };
  } catch (err) {
    console.error('[DELETE_CLIENT]', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
