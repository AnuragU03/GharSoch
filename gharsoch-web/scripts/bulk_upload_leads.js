const { MongoClient } = require('mongodb')
const fs = require('fs')

// IMPORTANT: Replace this array with your actual list of "Normal" clients
const newClients = [
  { name: "John Doe", phone: "+919876543210", place: "Mumbai" },
  { name: "Priya Sharma", phone: "+919876543211", place: "Bangalore" },
  // Add as many as you want...
]

const uri = process.env.DATABASE_URL || "mongodb+srv://<replace_with_your_connection_string>"

async function uploadClients() {
  console.log('Connecting to Cosmos DB...')
  const client = new MongoClient(uri)
  
  try {
    await client.connect()
    const db = client.db()
    const leadsCollection = db.collection('leads')

    console.log(`Preparing to upload ${newClients.length} clients...`)

    let uploadedCount = 0
    for (const clientData of newClients) {
      // Check if phone number already exists to avoid duplicates
      const exists = await leadsCollection.findOne({ phone: clientData.phone })
      if (!exists) {
        await leadsCollection.insertOne({
          name: clientData.name,
          phone: clientData.phone,
          email: '',
          source: 'bulk_upload',
          status: 'new', // This means "Normal / Uncontacted"
          dnd_status: false,
          place: clientData.place || '',
          notes: 'Uploaded from bulk script',
          interest_level: 'unknown',
          qualification_status: 'unqualified',
          lead_score: 0,
          total_calls: 0,
          first_call_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        })
        uploadedCount++
        console.log(`✅ Uploaded: ${clientData.name}`)
      } else {
        console.log(`⚠️ Skipped: ${clientData.name} (Phone number already exists)`)
      }
    }

    console.log(`\n🎉 Success! Added ${uploadedCount} new clients to the database.`)
    console.log('You can now go to the Campaigns page on the website, attach these clients to a campaign, and let the AI call them!')

  } catch (err) {
    console.error('Upload failed:', err)
  } finally {
    await client.close()
  }
}

uploadClients()
