import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function cleanupEmptyDocs() {
  try {
    const snapshot = await db.collection('zillow_imports').get();
    console.log(`Found ${snapshot.size} documents in zillow_imports`);

    const batch = db.batch();
    let deleted = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Delete if url is empty
      if (!data.url || data.url === '') {
        batch.delete(doc.ref);
        deleted++;
        console.log(`  Marking for deletion: ${doc.id} (empty URL)`);
      }
    });

    if (deleted > 0) {
      await batch.commit();
      console.log(`\n✅ Deleted ${deleted} empty documents`);
    } else {
      console.log('\nNo empty documents to delete');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupEmptyDocs();
