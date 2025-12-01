import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function searchAllCollections() {
  const searchTerm = 'willey';
  const collections = [
    'properties',
    'zillow_imports',
    'cash_deals',
    'agent_outreach_queue',
    'agent_outreach_sent',
  ];

  console.log(`\n🔍 Searching all collections for "${searchTerm}"...\n`);

  for (const collectionName of collections) {
    console.log(`\n=== ${collectionName} ===`);

    try {
      const snapshot = await db.collection(collectionName).get();
      let found = false;

      snapshot.forEach(doc => {
        const data = doc.data();
        const dataStr = JSON.stringify(data).toLowerCase();

        if (dataStr.includes(searchTerm)) {
          found = true;
          console.log(`\n✅ FOUND in ${collectionName}:`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Address: ${data.address || data.streetAddress || 'N/A'}`);
          console.log(`   City: ${data.city || 'N/A'}`);
          console.log(`   Status: ${data.status || 'N/A'}`);
          console.log(`   Deal Type: ${data.dealType || 'N/A'}`);
          console.log(`   Agent Response: ${data.agentResponse || 'N/A'}`);
          console.log(`   Routed To: ${data.routedTo || 'N/A'}`);
          console.log(`   Created: ${data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : data.addedAt || data.importedAt || 'N/A'}`);

          // Full data for debugging
          console.log('\n   Full Data:');
          console.log(JSON.stringify(data, null, 2));
        }
      });

      if (!found) {
        console.log(`   (${snapshot.size} docs, none match)`);
      }
    } catch (error: any) {
      console.log(`   Error: ${error.message}`);
    }
  }

  // Also search by address containing "7526"
  console.log('\n\n🔍 Also searching for "7526"...\n');

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();

      snapshot.forEach(doc => {
        const data = doc.data();
        const dataStr = JSON.stringify(data).toLowerCase();

        if (dataStr.includes('7526')) {
          console.log(`\n✅ FOUND "7526" in ${collectionName}:`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Address: ${data.address || data.streetAddress || 'N/A'}`);
        }
      });
    } catch (error) {
      // ignore
    }
  }
}

searchAllCollections().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
