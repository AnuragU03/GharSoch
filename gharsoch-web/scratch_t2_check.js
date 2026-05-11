require('dotenv').config()
const { MongoClient } = require('mongodb')

async function run() {
  const c = new MongoClient(process.env.DATABASE_URL)
  await c.connect()

  const cutoff = new Date(Date.now() - 15 * 60 * 1000)

  console.log('=== APPOINTMENT (T2 critical check) ===')
  const appts = await c
    .db('test')
    .collection('appointments')
    .find({ created_at: { $gte: cutoff } })
    .toArray()
  console.log('Created in last 15 min:', appts.length)
  appts.forEach((a) =>
    console.log({
      lead_id: a.lead_id?.toString(),
      property_id: a.property_id?.toString(),
      scheduled_at: a.scheduled_at,
      source: a.source
    })
  )

  console.log('\n=== book_appointment INVOCATION ===')
  const tools = await c
    .db('test')
    .collection('agent_execution_logs')
    .find({
      'input_data.tool_names': { $in: ['book_appointment'] },
      created_at: { $gte: cutoff }
    })
    .toArray()
  console.log('Count:', tools.length)
  tools.forEach((t) => {
    const args = t.actions?.[0]?.parameters?.args
    console.log('  AI passed property_id:', args?.property_id || 'MISSING')
    console.log('  Output:', JSON.stringify(t.output_data).slice(0, 200))
  })

  console.log('\n=== CALLS ===')
  const calls = await c
    .db('test')
    .collection('calls')
    .find({ direction: 'outbound', created_at: { $gte: cutoff } })
    .sort({ created_at: 1 })
    .toArray()
  console.log('Count:', calls.length, '(expect 2: initial + callback)')
  calls.forEach((c2, i) =>
    console.log(
      'Call ' + (i + 1) + ':',
      JSON.stringify({
        call_type: c2.call_type,
        matches_OUTBOUND: c2.agent_id === process.env.VAPI_ASSISTANT_OUTBOUND_ID,
        matches_REMINDER: c2.agent_id === process.env.VAPI_ASSISTANT_REMINDER_ID,
        has_matched_property_id: !!c2.matched_property_id
      })
    )
  )

  console.log('\n=== VERDICT ===')
  if (appts.length >= 1 && tools.length >= 1 && calls.length >= 2) {
    const apptHasProperty = !!appts[0].property_id
    const aiPassedProperty = tools.some((t) => t.actions?.[0]?.parameters?.args?.property_id)
    const callbackHasProperty =
      calls.find(
        (c2) => c2.matches_REMINDER || c2.agent_id === process.env.VAPI_ASSISTANT_REMINDER_ID
      )?.has_matched_property_id ?? !!calls[1]?.matched_property_id

    console.log('Appointment created:', appts.length >= 1 ? '✅' : '❌')
    console.log('Appointment has property_id:', apptHasProperty ? '✅' : '❌')
    console.log('AI invoked book_appointment:', tools.length >= 1 ? '✅' : '❌')
    console.log('AI used {{matched_property_id}}:', aiPassedProperty ? '✅' : '❌')
    console.log(
      'Callback row has matched_property_id:',
      callbackHasProperty ? '✅ T2 inheritance worked' : '❌ T2 inheritance failed'
    )

    if (apptHasProperty && aiPassedProperty && callbackHasProperty) {
      console.log('\n🎉🎉🎉 PHASE 12 TRULY CLOSED 🎉🎉🎉')
      console.log('Voice agent: takes calls + schedules callbacks + makes callbacks + books appointments')
    }
  }

  await c.close()
}

run().catch((err) => {
  console.error('T2 check failed:', err)
  process.exit(1)
})
