require('dotenv').config()
const { MongoClient } = require('mongodb')

async function chunkedDelete(col, batchSize = 50, label) {
  let totalDeleted = 0
  let attempts = 0

  while (true) {
    attempts++
    const batch = await col.find({}, { projection: { _id: 1 } }).limit(batchSize).toArray()
    if (batch.length === 0) break
    const ids = batch.map((d) => d._id)

    try {
      const r = await col.deleteMany({ _id: { $in: ids } })
      totalDeleted += r.deletedCount
      process.stdout.write('.')
    } catch (err) {
      if (err.code === 16500) {
        process.stdout.write('!')
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      throw err
    }

    await new Promise((r) => setTimeout(r, 300))
    if (attempts > 1000) break
  }

  console.log(`\n[${label}] deleted ${totalDeleted} docs`)
  return totalDeleted
}

async function reset() {
  const c = new MongoClient(process.env.DATABASE_URL)
  await c.connect()
  const db = c.db('test')

  console.log('=== BEFORE RESET ===')
  const before = {
    clients: await db.collection('clients').countDocuments({}),
    leads: await db.collection('leads').countDocuments({}),
    appointments: await db.collection('appointments').countDocuments({}),
    calls: await db.collection('calls').countDocuments({}),
    agent_runs: await db.collection('agent_execution_logs').countDocuments({}),
    campaigns: await db.collection('campaigns').countDocuments({}),
    properties: await db.collection('properties').countDocuments({}),
    users: await db.collection('users').countDocuments({}),
    system_config: await db.collection('system_config').countDocuments({}).catch(() => 0)
  }
  console.log(JSON.stringify(before, null, 2))

  console.log('\n=== CHUNKED DELETE (preserving users, system_config, properties, KB) ===')
  console.log('. = success batch, ! = RU throttle wait\n')

  await chunkedDelete(db.collection('clients'), 50, 'clients')
  await chunkedDelete(db.collection('leads'), 50, 'leads')
  await chunkedDelete(db.collection('appointments'), 50, 'appointments')
  await chunkedDelete(db.collection('calls'), 50, 'calls')
  await chunkedDelete(db.collection('agent_execution_logs'), 50, 'agent_execution_logs')
  await chunkedDelete(db.collection('campaigns'), 50, 'campaigns')

  // Optional collections (may not exist)
  try {
    await chunkedDelete(db.collection('callback_requests'), 50, 'callback_requests')
  } catch (e) {
    // skip
  }

  console.log('\n=== AFTER RESET ===')
  const after = {
    clients: await db.collection('clients').countDocuments({}),
    leads: await db.collection('leads').countDocuments({}),
    appointments: await db.collection('appointments').countDocuments({}),
    calls: await db.collection('calls').countDocuments({}),
    agent_runs: await db.collection('agent_execution_logs').countDocuments({}),
    campaigns: await db.collection('campaigns').countDocuments({}),
    properties: await db.collection('properties').countDocuments({}),
    users: await db.collection('users').countDocuments({}),
    system_config: await db.collection('system_config').countDocuments({}).catch(() => 0)
  }
  console.log(JSON.stringify(after, null, 2))

  console.log('\n=== SANITY ===')
  console.log(
    'Transactional cleared:',
    after.clients === 0 &&
      after.leads === 0 &&
      after.appointments === 0 &&
      after.calls === 0 &&
      after.agent_runs === 0 &&
      after.campaigns === 0
      ? '✅'
      : '❌'
  )
  console.log('Properties preserved:', after.properties === before.properties ? '✅' : '❌')
  console.log('Users preserved:', after.users === before.users ? '✅' : '❌')
  console.log('System config preserved:', after.system_config === before.system_config ? '✅' : '❌')

  await c.close()
  console.log('\n🎉 Ready for fresh T2 verification test')
}

reset().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
