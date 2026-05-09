require('dotenv').config();
const { MongoClient } = require('mongodb');

async function createIndexes() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set in .env');
    return;
  }

  console.log('Connecting to Cosmos DB to create indexes...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    const collections = ['leads', 'properties', 'appointments', 'calls', 'campaigns', 'agent_execution_logs', 'clients'];
    // Phase 11 auth collections
    const authCollections = ['users', 'brokerages'];

    for (const collName of collections) {
      console.log(`Creating indexes for ${collName}...`);
      const collection = db.collection(collName);
      
      try {
        // Single-field indexes for Cosmos compatibility
        await collection.createIndex({ created_at: -1 });
        await collection.createIndex({ updated_at: -1 });

        if (collName === 'agent_execution_logs') {
          await collection.createIndex({ run_id: 1 });
          await collection.createIndex({ agent_id: 1 });
          await collection.createIndex({ started_at: -1 });
          // Non-unique compound index (supported in many Cosmos RU configurations)
          await collection.createIndex({ agent_id: 1, started_at: -1 });
        }
        
        if (collName === 'appointments') {
          await collection.createIndex({ scheduled_at: 1 });
        }
        
        if (collName === 'clients') {
          await collection.createIndex({ phone: 1 });
          await collection.createIndex({ conversion_status: 1, created_at: -1 });
          await collection.createIndex({ source: 1, created_at: -1 });
        }
        
        console.log(`✅ Indexes created for ${collName}`);
      } catch (err) {
        console.error(`❌ Failed to create index for ${collName}:`, err.message);
      }
    }

    console.log('\n🎉 All indexes created successfully!')

    // Phase 11 — Auth indexes (users, brokerages)
    console.log('\nCreating Phase 11 auth indexes...')

    try {
      const usersCol = db.collection('users')
      await usersCol.createIndex({ email: 1 }, { unique: true })
      await usersCol.createIndex({ status: 1 })
      await usersCol.createIndex({ role: 1 })
      await usersCol.createIndex({ brokerage_id: 1 })
      console.log('✅ users indexes created')
    } catch (err) {
      console.error('❌ Failed to create users indexes:', err.message)
    }

    try {
      const brokeragesCol = db.collection('brokerages')
      await brokeragesCol.createIndex({ name: 1 })
      console.log('✅ brokerages indexes created')
    } catch (err) {
      console.error('❌ Failed to create brokerages indexes:', err.message)
    }


  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.close();
  }
}

createIndexes();
