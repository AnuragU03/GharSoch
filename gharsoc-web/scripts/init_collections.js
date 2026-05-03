// Run this ONCE to initialize the agent_logs collection in Cosmos DB
// Usage: node scripts/init_collections.js

const { MongoClient } = require('mongodb')

const uri = process.env.DATABASE_URL || require('fs').readFileSync('.env', 'utf8')
  .split('\n')
  .find(l => l.startsWith('DATABASE_URL='))
  ?.split('=').slice(1).join('=')?.trim()

if (!uri) {
  console.error('❌ Could not find DATABASE_URL')
  process.exit(1)
}

async function initCollections() {
  const client = new MongoClient(uri)
  try {
    await client.connect()
    console.log('✅ Connected to Cosmos DB')

    const db = client.db()
    const collections = (await db.listCollections().toArray()).map(c => c.name)
    console.log('📦 Existing collections:', collections)

    // Collections that must exist
    const required = ['agent_logs', 'leads', 'clients', 'properties', 'appointments', 'calls', 'campaigns']

    for (const name of required) {
      if (!collections.includes(name)) {
        // Insert + immediately delete a dummy doc to initialize the collection
        const col = db.collection(name)
        const result = await col.insertOne({ _init: true, created_at: new Date() })
        await col.deleteOne({ _id: result.insertedId })
        console.log(`✅ Initialized collection: ${name}`)
      } else {
        console.log(`✓  Already exists: ${name}`)
      }
    }

    console.log('\n🎉 All collections initialized successfully!')
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.close()
  }
}

initCollections()
