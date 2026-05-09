const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db();

  const users = await db.collection('users').find({}, {
    projection: { email: 1, role: 1, status: 1, created_at: 1 }
  }).toArray();

  console.log('=== ALL USERS ===');
  users.forEach(u => console.log(JSON.stringify(u, null, 2)));
  console.log('Total:', users.length);

  await client.close();
}
main().catch(console.error);
