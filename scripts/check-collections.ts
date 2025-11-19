import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkCollections() {
  console.log('\n📊 Checking Firebase Collections\n');
  console.log('='.repeat(80));

  const collections = await db.listCollections();

  console.log('\nAvailable collections:\n');

  for (const collection of collections) {
    const snapshot = await collection.limit(1).get();
    const count = (await collection.count().get()).data().count;
    console.log(`  ${collection.id}: ${count} documents`);

    if (snapshot.docs.length > 0) {
      const sampleData = snapshot.docs[0].data();
      const fields = Object.keys(sampleData).slice(0, 10);
      console.log(`    Sample fields: ${fields.join(', ')}`);
    }
    console.log();
  }

  console.log('='.repeat(80));
}

checkCollections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
