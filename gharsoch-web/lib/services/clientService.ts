import clientPromise, { getCollection } from '@/lib/mongodb';
import { Client } from '@/models/Client';
import { ObjectId } from 'mongodb';

const DB_NAME = 'test';
const COLLECTION = 'clients';

export interface CreateClientInput extends Omit<Client, '_id' | 'created_at' | 'updated_at' | 'conversion_status'> {
  broker_id: string;
}

export const clientService = {
  async createClient(data: CreateClientInput): Promise<Client> {
    if (!data.broker_id || typeof data.broker_id !== 'string' || data.broker_id.trim() === '') {
      throw new Error('createClient: valid non-empty broker_id is required');
    }
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);

    const newClient: Client = {
      ...data,
      conversion_status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      broker_id: data.broker_id,
    };

    const result = await collection.insertOne(newClient as any);
    newClient._id = result.insertedId;

    return newClient;
  },

  async getClient(id: string): Promise<Client | null> {
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);
    
    return collection.findOne({ _id: new ObjectId(id) });
  },

  async updateClient(id: string, patch: Partial<Client>): Promise<void> {
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...patch,
          updated_at: new Date() 
        } 
      }
    );
  },

  async listClients(options: { status?: string; source?: string; limit?: number } = {}): Promise<Client[]> {
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);

    const query: any = {
      is_deleted: { $ne: true }, // B16: canonical soft-delete filter
    };
    if (options.status) query.conversion_status = options.status;
    if (options.source) query.source = options.source;

    return collection.find(query)
      .sort({ created_at: -1 })
      .limit(options.limit || 50)
      .toArray();
  },

  async deleteClient(id: string): Promise<void> {
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);

    await collection.deleteOne({ _id: new ObjectId(id) });
  },
};

/**
 * B14: Cascade soft-delete a client and all its dependent records.
 * Canonical soft-delete convention:
 *   - WRITES set BOTH is_deleted: true AND deleted_at: new Date() (audit timestamp)
 *   - READS use is_deleted: { $ne: true } (handles undefined/missing field)
 * Cascade order is important — leads are soft-deleted FIRST so cron stops
 * processing them before we touch dependent records.
 * Returns counts so caller can verify expected impact and surface to UI.
 */
export async function softDeleteClientCascade(
  clientId: string,
  brokerId: string
): Promise<{
  ok: boolean;
  leads_deleted: number;
  appointments_deleted: number;
  calls_superseded: number;
  error?: string;
}> {
  if (!brokerId || typeof brokerId !== 'string' || brokerId.trim() === '') {
    throw new Error('softDeleteClientCascade: brokerId required');
  }
  if (!ObjectId.isValid(clientId)) {
    return { ok: false, leads_deleted: 0, appointments_deleted: 0, calls_superseded: 0, error: 'invalid_client_id' };
  }

  const now = new Date();
  const clientObjId = new ObjectId(clientId);

  const clientsCol = await getCollection('clients');
  const leadsCol = await getCollection('leads');
  const appointmentsCol = await getCollection('appointments');
  const callsCol = await getCollection('calls');

  // First — find all leads belonging to this client (so we know what to cascade to)
  const leads = await leadsCol.find({
    client_id: clientObjId,
    broker_id: brokerId,
    is_deleted: { $ne: true }
  }).project({ _id: 1 }).toArray();

  // If no leads exist, also try string match (in case client_id stored as string)
  if (leads.length === 0) {
    const stringIdLeads = await leadsCol.find({
      client_id: clientId,           // string match for legacy data
      broker_id: brokerId,
      is_deleted: { $ne: true }
    }).project({ _id: 1 }).toArray();
    leads.push(...stringIdLeads);
  }

  // Build $in array with BOTH ObjectId and string representations (Z12 lesson)
  const leadIdsObj = leads.map(l => l._id);
  const leadIdsStr = leads.map(l => l._id.toString());
  const leadIdsAny = [...leadIdsObj, ...leadIdsStr];

  // STEP 1: Soft-delete LEADS first (stops cron processing immediately)
  const leadsResult = await leadsCol.updateMany(
    { _id: { $in: leadIdsObj }, broker_id: brokerId, is_deleted: { $ne: true } },
    { $set: { is_deleted: true, deleted_at: now, updated_at: now } }
  );

  // STEP 2: Soft-delete APPOINTMENTS for these leads
  let appointmentsResult = { modifiedCount: 0 };
  if (leadIdsAny.length > 0) {
    appointmentsResult = await appointmentsCol.updateMany(
      { lead_id: { $in: leadIdsAny }, is_deleted: { $ne: true } },
      { $set: { is_deleted: true, deleted_at: now, status: 'cancelled', updated_at: now } }
    );
  }

  // STEP 3: Mark CALLS as superseded (cooldown bypass for any future re-add)
  let callsResult = { modifiedCount: 0 };
  if (leadIdsAny.length > 0) {
    callsResult = await callsCol.updateMany(
      { lead_id: { $in: leadIdsAny }, superseded: { $ne: true } },
      { $set: { superseded: true, superseded_at: now } }
    );
  }

  // STEP 4: Soft-delete the CLIENT itself (last)
  const clientResult = await clientsCol.updateOne(
    { _id: clientObjId, broker_id: brokerId, is_deleted: { $ne: true } },
    { $set: { is_deleted: true, deleted_at: now, status: 'archived', updated_at: now } }
  );

  if (clientResult.matchedCount === 0) {
    return {
      ok: false,
      leads_deleted: leadsResult.modifiedCount,
      appointments_deleted: appointmentsResult.modifiedCount,
      calls_superseded: callsResult.modifiedCount,
      error: 'client_not_found_or_access_denied'
    };
  }

  return {
    ok: true,
    leads_deleted: leadsResult.modifiedCount,
    appointments_deleted: appointmentsResult.modifiedCount,
    calls_superseded: callsResult.modifiedCount,
  };
}
