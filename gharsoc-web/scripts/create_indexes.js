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

    const collections = ['leads', 'properties', 'appointments', 'calls', 'campaigns'];

    for (const collName of collections) {
      console.log(`Creating indexes for ${collName}...`);
      const collection = db.collection(collName);
      
      try {
        // Create indexes used for sorting in our API
        await collection.createIndex({ created_at: -1 });
        await collection.createIndex({ updated_at: -1 });
        
        if (collName === 'appointments') {
          await collection.createIndex({ scheduled_at: 1 });
        }
        console.log(`✅ Indexes created for ${collName}`);
      } catch (err) {
        console.error(`❌ Failed to create index for ${collName}:`, err.message);
      }
    }

    console.log('\n🎉 All indexes created successfully! The "order-by" Cosmos DB error should be fixed.');

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.close();
  }
}

createIndexes();
