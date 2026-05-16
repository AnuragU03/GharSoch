require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function importData() {
    const uri = process.env.NEW_DATABASE_URL;
    if (!uri) {
        console.error('NEW_DATABASE_URL not found in environment');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to NEW MongoDB');
        
        const db = client.db('test');
        const dumpDir = path.join(process.cwd(), 'mongo_dump');
        
        if (!fs.existsSync(dumpDir)) {
            console.error('Dump directory not found');
            process.exit(1);
        }

        const files = fs.readdirSync(dumpDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const name = file.replace('.json', '');
            console.log(`Importing collection: ${name}`);
            const data = JSON.parse(fs.readFileSync(path.join(dumpDir, file), 'utf8'));
            
            if (data.length > 0) {
                // Drop existing if any to avoid duplicates on retry
                try { await db.collection(name).drop(); } catch (e) {}
                
                await db.collection(name).insertMany(data);
                console.log(`Imported ${data.length} documents into ${name}`);
            } else {
                console.log(`Collection ${name} is empty, skipping.`);
            }
        }
        
        console.log('Import completed!');
    } catch (err) {
        console.error('Import failed:', err);
    } finally {
        await client.close();
    }
}

importData();
