const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db();

  // Promote anuragugargol@gmail.com to admin
  const result = await db.collection('users').updateOne(
    { email: 'anuragugargol@gmail.com' },
    { $set: { role: 'admin', status: 'active', promoted_at: new Date() } }
  );
  console.log('Updated:', result.modifiedCount, 'doc(s)');

  // Verify
  const user = await db.collection('users').findOne({ email: 'anuragugargol@gmail.com' });
  console.log('\nUser after update:');
  console.log(JSON.stringify({ email: user.email, role: user.role, status: user.status }, null, 2));

  await client.close();
}

main().catch(console.error);
