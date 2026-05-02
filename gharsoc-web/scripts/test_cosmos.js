const { MongoClient } = require('mongodb');

async function testQuery() {
  const uri = process.env.DATABASE_URL;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    console.log(`Connected to database: ${db.databaseName}`);
    
    // Check existing indexes
    const indexes = await db.collection('leads').indexes();
    console.log('\nIndexes on leads collection:');
    console.log(JSON.stringify(indexes, null, 2));

    // Try a test query WITH sort
    console.log('\nRunning test query with .sort() ...');
    const result = await db.collection('leads').find({}).sort({ created_at: -1 }).limit(1).toArray();
    console.log('Query success! Result count:', result.length);

  } catch (error) {
    console.error('\nQuery failed with error:');
    console.error(error);
  } finally {
    await client.close();
  }
}

testQuery();
