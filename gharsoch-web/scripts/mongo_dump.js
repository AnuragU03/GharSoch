require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function dump() {
    const uri = process.env.DATABASE_URL;
    if (!uri) {
        console.error('DATABASE_URL not found in .env');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('test');
        const collectionNames = ['leads', 'properties', 'calls', 'appointments', 'callbacks', 'clients'];
        
        const dumpDir = path.join(process.cwd(), 'mongo_dump');
        if (!fs.existsSync(dumpDir)) {
            fs.mkdirSync(dumpDir);
        }

        for (const name of collectionNames) {
            console.log(`Dumping collection: ${name}`);
            try {
                const docs = await db.collection(name).find({}).toArray();
                fs.writeFileSync(
                    path.join(dumpDir, `${name}.json`),
                    JSON.stringify(docs, null, 2)
                );
            } catch (colErr) {
                console.error(`Failed to dump collection ${name}:`, colErr.message);
            }
        }
        
        console.log(`Dump completed! Files saved to: ${dumpDir}`);
    } catch (err) {
        console.error('Dump failed:', err);
    } finally {
        await client.close();
    }
}

dump();
