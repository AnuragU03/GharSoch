import clientPromise from '@/lib/mongodb';
import { Client } from '@/models/Client';
import { ObjectId } from 'mongodb';

const DB_NAME = 'test';
const COLLECTION = 'clients';

export const clientService = {
  async createClient(data: Omit<Client, '_id' | 'created_at' | 'updated_at' | 'conversion_status'>): Promise<Client> {
    const mongo = await clientPromise;
    const db = mongo.db(DB_NAME);
    const collection = db.collection<Client>(COLLECTION);

    const newClient: Client = {
      ...data,
      conversion_status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
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

    const query: any = {};
    if (options.status) query.conversion_status = options.status;
    if (options.source) query.source = options.source;

    return collection.find(query)
      .sort({ created_at: -1 })
      .limit(options.limit || 50)
      .toArray();
  }
};
