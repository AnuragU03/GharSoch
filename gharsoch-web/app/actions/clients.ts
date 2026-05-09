'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { requireRole } from '@/lib/auth';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
    const res = await fetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies().toString() },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to create client.' };
    }

    revalidatePath('/clients');
    revalidatePath('/ai-operations');

    return { success: true };
  } catch (error: any) {
    console.error('Server action error:', error);
    return { success: false, error: 'Internal server error during client creation.' };
  }
}
