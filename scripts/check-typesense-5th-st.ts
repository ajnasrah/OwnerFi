import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';
import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const client = getTypesenseAdminClient();
  if (!client) { console.log('No Typesense client'); return; }

  const id = 'zpid_904492';

  try {
    const doc = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents(id).retrieve();
    console.log(`✅ Typesense HAS ${id}`);
    console.log(`  primaryImage: ${(doc as any).primaryImage || '(none)'}`);
    console.log(`  isActive (TS): ${(doc as any).isActive}`);
    console.log(`  isOwnerfinance: ${(doc as any).isOwnerfinance}`);
    console.log(`  dealTypes: ${JSON.stringify((doc as any).dealTypes)}`);
    console.log(`  city: ${(doc as any).city}`);
  } catch (e: any) {
    console.log(`❌ Typesense MISSING ${id}: ${e.message}`);
    console.log('\nRe-indexing now...');
    const fsDoc = await db.collection('properties').doc(id).get();
    if (fsDoc.exists) {
      await indexRawFirestoreProperty(id, fsDoc.data()!, 'properties');
      console.log('  ✅ Re-indexed');
      // Verify
      try {
        const verify = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents(id).retrieve();
        console.log(`  ✅ Now in Typesense: isActive=${(verify as any).isActive}  isOwnerfinance=${(verify as any).isOwnerfinance}`);
      } catch (ve: any) {
        console.log(`  ❌ Still missing after re-index: ${ve.message}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
